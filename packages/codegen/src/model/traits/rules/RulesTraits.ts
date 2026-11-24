import { Nodes } from "../../node/Nodes";
import { ShapeId } from "../../shapes/ShapeId";
import { ShapeTypes } from "../../shapes/ShapeType";
import type { ShapeType } from "../../shapes/ShapeType";
import { Trait } from "../Trait";

class ClientContextParamDefinition {
  private readonly _type: ShapeType | undefined;
  private readonly _documentation: string | undefined;

  constructor(value: unknown) {
    const object = Nodes.expectObject(value);
    this._type = ShapeTypes.fromString(Nodes.expectString(Nodes.expectMember(object, "type")));
    this._documentation = Nodes.getString(object, "documentation");
  }

  public getType(): ShapeType | undefined {
    return this._type;
  }

  public getDocumentation(): string | undefined {
    return this._documentation;
  }
}

class StaticContextParamDefinition {
  private readonly _value: unknown;

  constructor(value: unknown) {
    this._value = Nodes.expectMember(Nodes.expectObject(value), "value");
  }

  public getValue(): unknown {
    return this._value;
  }
}

class OperationContextParamDefinition {
  private readonly _path: string;

  constructor(value: unknown) {
    this._path = Nodes.expectString(Nodes.expectMember(Nodes.expectObject(value), "path"));
  }

  public getPath(): string {
    return this._path;
  }
}

/**
 * @internal
 */
export class ClientContextParamsTrait extends Trait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.rules#clientContextParams");

  private readonly _parameters: Map<string, ClientContextParamDefinition>;

  constructor(value: unknown) {
    super(ClientContextParamsTrait.ID, value);
    this._parameters = RulesTraitsInternal.definitions(value, (entry) => new ClientContextParamDefinition(entry));
  }

  public getParameters(): ReadonlyMap<string, ClientContextParamDefinition> {
    return this._parameters;
  }
}

/**
 * @internal
 */
export class StaticContextParamsTrait extends Trait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.rules#staticContextParams");

  private readonly _parameters: Map<string, StaticContextParamDefinition>;

  constructor(value: unknown) {
    super(StaticContextParamsTrait.ID, value);
    this._parameters = RulesTraitsInternal.definitions(value, (entry) => new StaticContextParamDefinition(entry));
  }

  public getParameters(): ReadonlyMap<string, StaticContextParamDefinition> {
    return this._parameters;
  }
}

/**
 * @internal
 */
export class OperationContextParamsTrait extends Trait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.rules#operationContextParams");

  private readonly _parameters: Map<string, OperationContextParamDefinition>;

  constructor(value: unknown) {
    super(OperationContextParamsTrait.ID, value);
    this._parameters = RulesTraitsInternal.definitions(value, (entry) => new OperationContextParamDefinition(entry));
  }

  public getParameters(): ReadonlyMap<string, OperationContextParamDefinition> {
    return this._parameters;
  }
}

/**
 * @internal
 */
export class ContextParamTrait extends Trait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.rules#contextParam");

  private readonly _name: string;

  constructor(value: unknown) {
    super(ContextParamTrait.ID, value);
    this._name = Nodes.expectString(Nodes.expectMember(Nodes.expectObject(value), "name"));
  }

  public getName(): string {
    return this._name;
  }
}

/**
 * The rule set is kept as raw JSON because the rules engine language is not ported.
 *
 * @internal
 */
export class EndpointRuleSetTrait extends Trait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.rules#endpointRuleSet");

  constructor(value: unknown) {
    super(EndpointRuleSetTrait.ID, value);
  }

  public getRuleSet(): unknown {
    return this.toNode();
  }
}

/**
 * The BDD is kept as raw JSON because the rules engine language is not ported.
 *
 * @internal
 */
export class EndpointBddTrait extends Trait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.rules#endpointBdd");

  constructor(value: unknown) {
    super(EndpointBddTrait.ID, value);
  }
}

class RulesTraitsInternal {
  public static definitions<T>(value: unknown, create: (entry: unknown) => T): Map<string, T> {
    const object = Nodes.expectObject(value);
    const result = new Map<string, T>();
    for (const key of Object.keys(object)) {
      result.set(key, create(object[key]));
    }
    return result;
  }
}
