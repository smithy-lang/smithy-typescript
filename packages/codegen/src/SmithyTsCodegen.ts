import { JsonParser } from "./model/node/JsonParser";
import { FileManifest } from "./codegen-core";
import { Model, ModelLoader } from "./model";
import { DirectedTypeScriptCodegen } from "./typescript/DirectedTypeScriptCodegen";
import { createBuiltinIntegrations } from "./typescript/integration/BuiltinIntegrations";
import type { TypeScriptIntegration } from "./typescript/integration/TypeScriptIntegration";
import { TypeScriptGenerationPlan } from "./typescript/TypeScriptGenerationPlan";
import { type ArtifactType, type JsonObject, TypeScriptSettings } from "./typescript/TypeScriptSettings";

/**
 * Inputs for generating one projection of a Smithy model.
 *
 * @public
 */
export interface SmithyTsCodegenOptions {
  /**
   * The parsed smithy-build.json.
   */
  smithyBuildConfig: JsonObject;
  /**
   * The Smithy JSON AST after projection transforms. Pass the JSON text to keep number precision and formatting
   * from the source, since a parsed object has already rounded numbers to doubles.
   */
  model: Model | JsonObject | string;
  /**
   * The smithy-build projection whose plugin settings apply. Defaults to the top-level plugins.
   */
  projection?: string;
}

/**
 * Generates a TypeScript client package from a Smithy JSON AST and smithy-build plugin settings.
 *
 * @example
 * const codegen = new SmithyTsCodegen({ smithyBuildConfig, model, projection: "my-projection" });
 * await codegen.writeToPath("./out");
 *
 * @public
 */
export class SmithyTsCodegen {
  private readonly _model: Model;
  private readonly _settings: TypeScriptSettings;
  private readonly _integrations: TypeScriptIntegration[] = [];

  public constructor(options: SmithyTsCodegenOptions) {
    this._model =
      options.model instanceof Model
        ? options.model
        : ModelLoader.load(typeof options.model === "string" ? JsonParser.parse(options.model) : options.model);
    this._settings = SmithyTsCodegen._readSettings(this._model, options);
    this._integrations.push(...createBuiltinIntegrations());
  }

  /**
   * Registers an integration that customizes the generated package. Built-in integrations are already registered.
   */
  public addIntegration(integration: TypeScriptIntegration): this {
    this._integrations.push(integration);
    return this;
  }

  /**
   * Generates the package files in memory.
   */
  public generate(): FileManifest {
    const manifest = new FileManifest();
    new DirectedTypeScriptCodegen(
      this._model,
      this._settings,
      manifest,
      this._integrations,
      new TypeScriptGenerationPlan()
    ).run();
    return manifest;
  }

  /**
   * Generates the package files and writes them below the given directory.
   */
  public async writeToPath(filePath: string): Promise<void> {
    await this.generate().writeTo(filePath);
  }

  private static _readSettings(model: Model, options: SmithyTsCodegenOptions): TypeScriptSettings {
    const config = options.smithyBuildConfig;
    const projections = (config.projections ?? {}) as Record<string, JsonObject>;
    const plugins = (options.projection !== undefined ? projections[options.projection]?.plugins : config.plugins) as
      | Record<string, JsonObject>
      | undefined;
    if (plugins === undefined) {
      throw new Error(`No plugins found in smithy-build config for projection '${options.projection}'`);
    }
    for (const [name, artifactType] of Object.entries(PLUGIN_ARTIFACT_TYPES)) {
      const pluginSettings = plugins[name];
      if (pluginSettings !== undefined) {
        return artifactType === undefined
          ? TypeScriptSettings.fromWithModes(model, pluginSettings)
          : TypeScriptSettings.from(model, pluginSettings, artifactType);
      }
    }
    throw new Error("No typescript codegen plugin settings found in smithy-build config");
  }
}

const PLUGIN_ARTIFACT_TYPES: Record<string, ArtifactType | undefined> = {
  "typescript-client-codegen": "CLIENT",
  "typescript-server-codegen": "SSDK",
  "typescript-codegen": undefined,
};
