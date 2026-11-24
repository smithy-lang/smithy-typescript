import { SourceException } from "../exceptions/exceptions";
import { Nodes } from "../node/Nodes";
import type { JsonObject } from "../node/Nodes";
import { ShapeId } from "../shapes/ShapeId";
import { Trait } from "./Trait";

/**
 * One entry of the deprecated `@enum` trait.
 *
 * @internal
 */
export class EnumDefinition {
  private readonly _value: string;
  private readonly _name: string | undefined;
  private readonly _documentation: string | undefined;
  private readonly _tags: string[];
  private readonly _deprecated: boolean;

  constructor(value: string, name?: string, documentation?: string, tags: string[] = [], deprecated = false) {
    this._value = value;
    this._name = name;
    this._documentation = documentation;
    this._tags = tags;
    this._deprecated = deprecated;
  }

  public static fromNode(node: unknown): EnumDefinition {
    const object = Nodes.expectObject(node);
    return new EnumDefinition(
      Nodes.expectString(Nodes.expectMember(object, "value")),
      Nodes.getString(object, "name"),
      Nodes.getString(object, "documentation"),
      Nodes.getStringArray(object, "tags") ?? [],
      Nodes.getBooleanOrDefault(object, "deprecated")
    );
  }

  public getValue(): string {
    return this._value;
  }

  public getName(): string | undefined {
    return this._name;
  }

  public getDocumentation(): string | undefined {
    return this._documentation;
  }

  public toNode(): JsonObject {
    const result: JsonObject = { value: this._value };
    if (this._name !== undefined) {
      result.name = this._name;
    }
    if (this._documentation !== undefined) {
      result.documentation = this._documentation;
    }
    if (this._tags.length > 0) {
      result.tags = this._tags;
    }
    if (this._deprecated) {
      result.deprecated = true;
    }
    return result;
  }
}

let syntheticAliases: readonly ShapeId[] | undefined;

/**
 * @internal
 */
export class EnumTrait extends Trait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.api#enum");

  private readonly _definitions: EnumDefinition[];

  constructor(value: unknown, id: ShapeId = EnumTrait.ID) {
    super(id, value);
    this._definitions = Nodes.expectArray(value).map((entry) => EnumDefinition.fromNode(entry));
    if (this._definitions.length === 0) {
      throw new SourceException("enum must have at least one entry");
    }
  }

  /**
   * Lookups by class also match the synthetic trait that enum shapes carry.
   */
  public static get ALIASES(): readonly ShapeId[] {
    if (syntheticAliases === undefined) {
      syntheticAliases = [SyntheticEnumTrait.ID];
    }
    return syntheticAliases;
  }

  public getValues(): EnumDefinition[] {
    return this._definitions;
  }

  public getEnumDefinitionValues(): string[] {
    return this._definitions.map((definition) => definition.getValue());
  }

  public hasNames(): boolean {
    return this._definitions.every((definition) => definition.getName() !== undefined);
  }
}

/**
 * The enum trait that enum shapes expose in place of `@enum`, derived from their members.
 */
export class SyntheticEnumTrait extends EnumTrait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.synthetic#enum");

  constructor(value: unknown) {
    super(value, SyntheticEnumTrait.ID);
  }
}

export class EnumValueTrait extends Trait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.api#enumValue");

  constructor(value: unknown) {
    super(EnumValueTrait.ID, value);
  }

  public getStringValue(): string | undefined {
    const value = this.toNode();
    return typeof value === "string" ? value : undefined;
  }

  public expectStringValue(): string {
    const value = this.getStringValue();
    if (value === undefined) {
      throw new SourceException("Expected enumValue trait to be a string");
    }
    return value;
  }

  public getIntValue(): number | undefined {
    const value = this.toNode();
    return typeof value === "number" ? value : undefined;
  }

  public expectIntValue(): number {
    const value = this.getIntValue();
    if (value === undefined) {
      throw new SourceException("Expected enumValue trait to be an integer");
    }
    return value;
  }
}
