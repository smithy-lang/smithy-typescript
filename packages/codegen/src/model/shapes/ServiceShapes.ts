import { Shape } from "./Shape";
import type { ShapeInit } from "./Shape";
import { UnitTypeTrait } from "../traits/UnitTypeTrait";
import type { ShapeId, ToShapeId } from "./ShapeId";
import type { ShapeType } from "./ShapeType";
import type { ShapeVisitor } from "./ShapeVisitor";

interface EntityShapeInit extends ShapeInit {
  operations?: readonly ShapeId[];
  resources?: readonly ShapeId[];
}

interface ServiceShapeInit extends EntityShapeInit {
  version?: string;
  rename?: ReadonlyMap<ShapeId, string>;
  errors?: readonly ShapeId[];
}

interface ResourceShapeInit extends EntityShapeInit {
  identifiers?: ReadonlyMap<string, ShapeId>;
  properties?: ReadonlyMap<string, ShapeId>;
  put?: ShapeId;
  create?: ShapeId;
  read?: ShapeId;
  update?: ShapeId;
  delete?: ShapeId;
  list?: ShapeId;
  collectionOperations?: readonly ShapeId[];
}

interface OperationShapeInit extends ShapeInit {
  input?: ShapeId;
  output?: ShapeId;
  errors?: readonly ShapeId[];
}

/**
 * A shape that binds operations and resources, the base of service and resource shapes.
 */
abstract class EntityShape extends Shape {
  private readonly _resources: ShapeId[];
  private readonly _introducedResources: ShapeId[];
  private readonly _operations: ShapeId[];
  private readonly _introducedOperations: ShapeId[];

  protected constructor(init: EntityShapeInit) {
    super(init.id, init.traits ?? [], init.mixins ?? [], false);
    this._introducedResources = init.resources === undefined ? [] : init.resources.slice();
    this._introducedOperations = init.operations === undefined ? [] : init.operations.slice();
    const mixins = init.mixins ?? [];
    if (mixins.length === 0) {
      this._resources = this._introducedResources;
      this._operations = this._introducedOperations;
    } else {
      const resources = new Set<ShapeId>();
      const operations = new Set<ShapeId>();
      for (const mixin of mixins) {
        const entity = mixin as EntityShape;
        entity.getResources().forEach((id) => resources.add(id));
        entity.getOperations().forEach((id) => operations.add(id));
      }
      this._introducedResources.forEach((id) => resources.add(id));
      this._introducedOperations.forEach((id) => operations.add(id));
      this._resources = Array.from(resources);
      this._operations = Array.from(operations);
    }
  }

  public getResources(): readonly ShapeId[] {
    return this._resources;
  }

  public getIntroducedResources(): readonly ShapeId[] {
    return this._introducedResources;
  }

  public getOperations(): readonly ShapeId[] {
    return this._operations;
  }

  public getIntroducedOperations(): readonly ShapeId[] {
    return this._introducedOperations;
  }
}

/**
 * @internal
 */
export class ServiceShape extends EntityShape {
  private readonly _version: string;
  private readonly _introducedVersion: string;
  private readonly _rename: Map<ShapeId, string>;
  private readonly _introducedRename: Map<ShapeId, string>;
  private readonly _errors: ShapeId[];
  private readonly _introducedErrors: ShapeId[];

  constructor(init: ServiceShapeInit) {
    super(init);
    this._introducedVersion = init.version ?? "";
    this._introducedRename = new Map<ShapeId, string>(init.rename === undefined ? [] : Array.from(init.rename));
    this._introducedErrors = init.errors === undefined ? [] : init.errors.slice();
    const mixins = init.mixins ?? [];
    if (mixins.length === 0) {
      this._version = this._introducedVersion;
      this._rename = this._introducedRename;
      this._errors = this._introducedErrors;
    } else {
      let version = "";
      const rename = new Map<ShapeId, string>();
      const errors = new Set<ShapeId>();
      for (const mixin of mixins) {
        if (mixin instanceof ServiceShape) {
          if (mixin._version.length > 0) {
            version = mixin._version;
          }
          mixin._rename.forEach((value, key) => rename.set(key, value));
          mixin._errors.forEach((id) => errors.add(id));
        }
      }
      if (this._introducedVersion.length > 0) {
        version = this._introducedVersion;
      }
      this._introducedRename.forEach((value, key) => rename.set(key, value));
      this._introducedErrors.forEach((id) => errors.add(id));
      this._version = version;
      this._rename = rename;
      this._errors = Array.from(errors);
    }
  }

  public getType(): ShapeType {
    return "service";
  }

  public accept<R>(visitor: ShapeVisitor<R>): R {
    return visitor.serviceShape(this);
  }

  public getVersion(): string {
    return this._version;
  }

  public getIntroducedVersion(): string {
    return this._introducedVersion;
  }

  public getIntroducedRename(): ReadonlyMap<ShapeId, string> {
    return this._introducedRename;
  }

  public getErrorsSet(): readonly ShapeId[] {
    return this._errors;
  }

  public getIntroducedErrorsSet(): readonly ShapeId[] {
    return this._introducedErrors;
  }

  public getContextualName(shape: ToShapeId): string {
    const id = shape.toShapeId();
    const renamed = this._rename.get(id);
    return renamed === undefined ? id.getName() : renamed;
  }
}

/**
 * @internal
 */
export class ResourceShape extends EntityShape {
  private readonly _identifiers: Map<string, ShapeId>;
  private readonly _properties: Map<string, ShapeId>;
  private readonly _put: ShapeId | undefined;
  private readonly _create: ShapeId | undefined;
  private readonly _read: ShapeId | undefined;
  private readonly _update: ShapeId | undefined;
  private readonly _delete: ShapeId | undefined;
  private readonly _list: ShapeId | undefined;
  private readonly _collectionOperations: ShapeId[];
  private readonly _allOperations: ShapeId[];

  constructor(init: ResourceShapeInit) {
    super(init);
    this._identifiers = new Map<string, ShapeId>(init.identifiers === undefined ? [] : Array.from(init.identifiers));
    this._properties = new Map<string, ShapeId>(init.properties === undefined ? [] : Array.from(init.properties));
    this._put = init.put;
    this._create = init.create;
    this._read = init.read;
    this._update = init.update;
    this._delete = init.delete;
    this._list = init.list;
    this._collectionOperations = init.collectionOperations === undefined ? [] : init.collectionOperations.slice();
    const all = new Set<ShapeId>();
    this.getOperations().forEach((id) => all.add(id));
    this._collectionOperations.forEach((id) => all.add(id));
    for (const lifecycle of [this._put, this._create, this._read, this._update, this._delete, this._list]) {
      if (lifecycle !== undefined) {
        all.add(lifecycle);
      }
    }
    this._allOperations = Array.from(all);
  }

  public getType(): ShapeType {
    return "resource";
  }

  public accept<R>(visitor: ShapeVisitor<R>): R {
    return visitor.resourceShape(this);
  }

  public getCollectionOperations(): readonly ShapeId[] {
    return this._collectionOperations;
  }

  public getIdentifiers(): ReadonlyMap<string, ShapeId> {
    return this._identifiers;
  }

  public getProperties(): ReadonlyMap<string, ShapeId> {
    return this._properties;
  }

  public getPut(): ShapeId | undefined {
    return this._put;
  }

  public getCreate(): ShapeId | undefined {
    return this._create;
  }

  public getRead(): ShapeId | undefined {
    return this._read;
  }

  public getUpdate(): ShapeId | undefined {
    return this._update;
  }

  public getDelete(): ShapeId | undefined {
    return this._delete;
  }

  public getList(): ShapeId | undefined {
    return this._list;
  }
}

/**
 * @internal
 */
export class OperationShape extends Shape {
  private readonly _input: ShapeId;
  private readonly _output: ShapeId;
  private readonly _errors: ShapeId[];
  private readonly _introducedErrors: ShapeId[];

  constructor(init: OperationShapeInit) {
    super(init.id, init.traits ?? [], init.mixins ?? [], false);
    this._input = init.input ?? UnitTypeTrait.UNIT;
    this._output = init.output ?? UnitTypeTrait.UNIT;
    this._introducedErrors = init.errors === undefined ? [] : init.errors.slice();
    const mixins = init.mixins ?? [];
    if (mixins.length === 0) {
      this._errors = this._introducedErrors;
    } else {
      const errors = new Set<ShapeId>();
      for (const mixin of mixins) {
        if (mixin instanceof OperationShape) {
          mixin._errors.forEach((id) => errors.add(id));
        }
      }
      this._introducedErrors.forEach((id) => errors.add(id));
      this._errors = Array.from(errors);
    }
  }

  public getType(): ShapeType {
    return "operation";
  }

  public accept<R>(visitor: ShapeVisitor<R>): R {
    return visitor.operationShape(this);
  }

  /**
   * Returns the input shape ID, or undefined when the input is `smithy.api#Unit`.
   */
  public getInput(): ShapeId | undefined {
    return this._input === UnitTypeTrait.UNIT ? undefined : this._input;
  }

  public getOutput(): ShapeId | undefined {
    return this._output === UnitTypeTrait.UNIT ? undefined : this._output;
  }

  public getInputShape(): ShapeId {
    return this._input;
  }

  public getOutputShape(): ShapeId {
    return this._output;
  }

  public getErrorsSet(): readonly ShapeId[] {
    return this._errors;
  }

  /**
   * Returns the errors of the service followed by the errors of this operation, without duplicates.
   */
  public getErrors(service?: ServiceShape): ShapeId[] {
    if (service === undefined) {
      return this._errors.slice();
    }
    const result = new Set<ShapeId>(service.getErrorsSet());
    this._errors.forEach((id) => result.add(id));
    return Array.from(result);
  }
}
