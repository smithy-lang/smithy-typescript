import type { FileManifest, SymbolProvider } from "../codegen-core";
import { SymbolDependency, SymbolProviderUtils } from "../codegen-core";
import { TopologicalIndex } from "../codegen-core/TopologicalIndex";
import type { Model, Shape, ShapeId, StructureShape, UnionShape, EnumShape, IntEnumShape, StringShape } from "../model";
import { ModelTransformer, ServiceShape, ShapeVisitorDefault, EnumTrait, ErrorTrait, Walker } from "../model";
import { ApplicationProtocol } from "./ApplicationProtocol";
import { sortIntegrations } from "./integration/IntegrationTopologicalSort";
import type { ProtocolGenerator } from "./integration/ProtocolGenerator";
import type { RuntimeClientPlugin } from "./integration/RuntimeClientPlugin";
import type { TypeScriptIntegration } from "./integration/TypeScriptIntegration";
import { PackageJsonGenerator } from "./PackageJsonGenerator";
import { SymbolVisitor } from "./SymbolVisitor";
import { TypeScriptCodegenContext } from "./TypeScriptCodegenContext";
import { TypeScriptDelegator } from "./TypeScriptDelegator";
import type { TypeScriptSettings } from "./TypeScriptSettings";
import { type JsonObject, UnresolvableProtocolException } from "./TypeScriptSettings";
import { TypeScriptUtils } from "./TypeScriptUtils";
import { TSCONFIG_CJS, TSCONFIG_TYPES } from "./TypeScriptResources";

export interface GenerationPlan {
  generateStructure?(context: TypeScriptCodegenContext, shape: StructureShape): void;
  generateError?(context: TypeScriptCodegenContext, shape: StructureShape): void;
  generateUnion?(context: TypeScriptCodegenContext, shape: UnionShape): void;
  generateEnum?(context: TypeScriptCodegenContext, shape: StringShape | EnumShape): void;
  generateIntEnum?(context: TypeScriptCodegenContext, shape: IntEnumShape): void;
  generateService?(context: TypeScriptCodegenContext, service: ServiceShape): void;
  customizeBeforeIntegrations?(context: TypeScriptCodegenContext, service: ServiceShape, shapes: Shape[]): void;
}

/**
 * Runs the directed code generation flow for a single service client.
 */
export class DirectedTypeScriptCodegen {
  private readonly _model: Model;
  private readonly _settings: TypeScriptSettings;
  private readonly _fileManifest: FileManifest;
  private readonly _integrations: TypeScriptIntegration[];
  private readonly _plan: GenerationPlan;

  public constructor(
    model: Model,
    settings: TypeScriptSettings,
    fileManifest: FileManifest,
    integrations: TypeScriptIntegration[],
    plan: GenerationPlan
  ) {
    this._model = model;
    this._settings = settings;
    this._fileManifest = fileManifest;
    this._integrations = integrations;
    this._plan = plan;
  }

  public run(): void {
    const settings = this._settings;
    const service = settings.getService();
    let model = this._performModelTransforms(this._model, service);

    const integrations = sortIntegrations(this._integrations.filter((i) => i.matchesSettings(settings)));
    for (const integration of integrations) {
      model = integration.preprocessModel(model, settings);
    }

    const serviceShape = model.expectShape(service, ServiceShape) as ServiceShape;
    let provider: SymbolProvider = new SymbolVisitor(model, settings);
    for (const integration of integrations) {
      provider = integration.decorateSymbolProvider(model, settings, provider);
    }
    provider = SymbolProviderUtils.cache(provider);

    const context = this._createContext(model, serviceShape, provider, integrations);
    context.writerDelegator().setInterceptors(integrations.flatMap((i) => i.interceptors(context)));

    const shapes = this._generateShapes(context, serviceShape);
    this._plan.generateService?.(context, serviceShape);
    this._customizeBeforeIntegrations(context, serviceShape, shapes);
    for (const integration of integrations) {
      integration.customize(context);
    }
    this._customizeAfterIntegrations(context);
    context.writerDelegator().flushWriters();
  }

  private _performModelTransforms(model: Model, service: ShapeId): Model {
    const transformer = ModelTransformer.create();
    const serviceShape = model.expectShape(service, ServiceShape) as ServiceShape;
    model = transformer.copyServiceErrorsToOperations(model, serviceShape);
    return transformer.flattenAndRemoveMixins(model);
  }

  private _createContext(
    model: Model,
    service: ServiceShape,
    symbolProvider: SymbolProvider,
    integrations: TypeScriptIntegration[]
  ): TypeScriptCodegenContext {
    const settings = this._settings;
    const runtimePlugins: RuntimeClientPlugin[] = [];
    for (const integration of integrations) {
      for (const plugin of integration.getClientPlugins()) {
        if (plugin.matchesSettings(model, service, settings)) {
          runtimePlugins.push(plugin);
        }
      }
    }
    for (const integration of integrations) {
      integration.mutateClientPlugins(runtimePlugins);
    }

    const protocolGenerator = this._resolveProtocolGenerator(integrations, model, service);
    if (protocolGenerator !== undefined) {
      settings.setProtocol(protocolGenerator.getProtocol());
    }
    const applicationProtocol =
      protocolGenerator === undefined
        ? ApplicationProtocol.createDefaultHttpApplicationProtocol()
        : protocolGenerator.getApplicationProtocol();

    return new TypeScriptCodegenContext({
      model,
      settings,
      symbolProvider,
      fileManifest: this._fileManifest,
      writerDelegator: new TypeScriptDelegator(this._fileManifest, symbolProvider),
      integrations,
      runtimePlugins,
      protocolGenerator,
      applicationProtocol,
    });
  }

  private _resolveProtocolGenerator(
    integrations: TypeScriptIntegration[],
    model: Model,
    service: ServiceShape
  ): ProtocolGenerator | undefined {
    const generators = new Map<string, ProtocolGenerator>();
    for (const integration of integrations) {
      for (const generator of integration.getProtocolGenerators()) {
        const key = generator.getProtocol().toString();
        generators.delete(key);
        generators.set(key, generator);
      }
    }
    let protocolName: ShapeId | undefined;
    try {
      protocolName = this._settings.resolveServiceProtocol(
        model,
        service,
        [...generators.values()].map((g) => g.getProtocol())
      );
    } catch (e) {
      if (!(e instanceof UnresolvableProtocolException)) {
        throw e;
      }
      console.warn(`Unable to find a protocol generator for ${service.getId()}: ${e.message}`);
    }
    return protocolName === undefined ? undefined : generators.get(protocolName.toString());
  }

  private _generateShapes(context: TypeScriptCodegenContext, service: ServiceShape): Shape[] {
    const model = context.model();
    const shapes = new Set<Shape>(Walker.walkShapes(model, service));
    const topological = TopologicalIndex.of(model);
    const ordered: Shape[] = [];
    for (const shape of topological.getOrderedShapes()) {
      if (shapes.has(shape)) {
        ordered.push(shape);
      }
    }
    for (const shape of topological.getRecursiveShapes()) {
      if (shapes.has(shape)) {
        ordered.push(shape);
      }
    }
    const generator = new ShapeGenerator(context, this._plan);
    for (const shape of ordered) {
      shape.accept(generator);
    }
    return [...shapes];
  }

  private _customizeBeforeIntegrations(
    context: TypeScriptCodegenContext,
    service: ServiceShape,
    shapes: Shape[]
  ): void {
    const manifest = this._fileManifest;
    manifest.writeFile("tsconfig.json", TypeScriptUtils.loadResourceAsString("tsconfig.json"));
    manifest.writeFile("tsconfig.cjs.json", JSON.stringify(TSCONFIG_CJS, null, 2) + "\n");
    manifest.writeFile("tsconfig.es.json", TypeScriptUtils.loadResourceAsString("tsconfig.es.json"));
    manifest.writeFile("tsconfig.types.json", this._generateTsconfigTypes());
    this._plan.customizeBeforeIntegrations?.(context, service, shapes);
  }

  private _customizeAfterIntegrations(context: TypeScriptCodegenContext): void {
    PackageJsonGenerator.writePackageJson(
      this._settings,
      this._fileManifest,
      SymbolDependency.gatherDependencies(context.writerDelegator().getDependencies())
    );
  }

  private _generateTsconfigTypes(): string {
    const node = structuredClone(TSCONFIG_TYPES);
    if (this._settings.isolatedModules()) {
      node.compilerOptions = { ...(node.compilerOptions as JsonObject), isolatedModules: true };
    }
    return JSON.stringify(node, null, 2) + "\n";
  }
}

class ShapeGenerator extends ShapeVisitorDefault<void> {
  private readonly _context: TypeScriptCodegenContext;
  private readonly _plan: GenerationPlan;

  public constructor(context: TypeScriptCodegenContext, plan: GenerationPlan) {
    super();
    this._context = context;
    this._plan = plan;
  }

  public structureShape(shape: StructureShape): void {
    if (shape.hasTrait(ErrorTrait)) {
      this._plan.generateError?.(this._context, shape);
    } else {
      this._plan.generateStructure?.(this._context, shape);
    }
  }

  public unionShape(shape: UnionShape): void {
    this._plan.generateUnion?.(this._context, shape);
  }

  public stringShape(shape: StringShape): void {
    if (shape.hasTrait(EnumTrait)) {
      this._plan.generateEnum?.(this._context, shape);
    }
  }

  public enumShape(shape: EnumShape): void {
    this._plan.generateEnum?.(this._context, shape);
  }

  public intEnumShape(shape: IntEnumShape): void {
    this._plan.generateIntEnum?.(this._context, shape);
  }

  protected getDefault(_shape: Shape): void {}
}
