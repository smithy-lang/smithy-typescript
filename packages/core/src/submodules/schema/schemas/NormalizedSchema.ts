import type {
  MemberSchema,
  NormalizedSchema as INormalizedSchema,
  Schema as ISchema,
  SchemaRef,
  SchemaTraits,
  SchemaTraitsObject,
} from "@smithy/types";

import { deref } from "../deref";
import { ListSchema } from "./ListSchema";
import { MapSchema } from "./MapSchema";
import { SCHEMA } from "./sentinels";
import { SimpleSchema } from "./SimpleSchema";
import { StructureSchema } from "./StructureSchema";

/**
 * Wraps SchemaRef values for easier handling.
 * @internal
 */
export class NormalizedSchema implements INormalizedSchema {
  public readonly name: string;
  public readonly traits: SchemaTraits;

  private _isMemberSchema: boolean;
  private schema: Exclude<ISchema, MemberSchema>;
  private memberTraits: SchemaTraits;
  private normalizedTraits?: SchemaTraitsObject;

  public constructor(
    public readonly ref: SchemaRef,
    private memberName?: string
  ) {
    const traitStack = [] as SchemaTraits[];
    let _ref = ref;
    let schema = ref;
    this._isMemberSchema = false;

    while (Array.isArray(_ref)) {
      traitStack.push(_ref[1]);
      _ref = _ref[0];
      schema = deref(_ref);
      this._isMemberSchema = true;
    }

    if (traitStack.length > 0) {
      this.memberTraits = {};
      for (let i = traitStack.length - 1; i >= 0; --i) {
        const traitSet = traitStack[i];
        Object.assign(this.memberTraits, NormalizedSchema.translateTraits(traitSet));
      }
    } else {
      this.memberTraits = 0;
    }

    if (schema instanceof NormalizedSchema) {
      this.name = schema.name;
      this.traits = schema.traits;
      this._isMemberSchema = schema._isMemberSchema;
      this.schema = schema.schema;
      this.memberTraits = Object.assign({}, schema.getMemberTraits(), this.getMemberTraits());
      this.normalizedTraits = void 0;
      this.ref = schema.ref;
      this.memberName = memberName ?? schema.memberName;
      return;
    }

    this.schema = deref(schema) as Exclude<ISchema, MemberSchema>;

    if (this.schema && typeof this.schema === "object") {
      this.traits = this.schema?.traits ?? {};
    } else {
      this.traits = 0;
    }

    this.name =
      (typeof this.schema === "object" ? this.schema?.name : void 0) ?? this.memberName ?? this.getSchemaName();

    if (this._isMemberSchema && !memberName) {
      throw new Error(
        `@smithy/core/schema - NormalizedSchema member schema ${this.getName(true)} must initialize with memberName argument.`
      );
    }
  }

  public static of(ref: SchemaRef, memberName?: string): NormalizedSchema {
    if (ref instanceof NormalizedSchema) {
      return ref;
    }
    return new NormalizedSchema(ref, memberName);
  }

  /**
   * @param indicator - numeric indicator for preset trait combination.
   * @returns equivalent trait object.
   */
  public static translateTraits(indicator: SchemaTraits): SchemaTraitsObject {
    if (typeof indicator === "object") {
      return indicator;
    }
    indicator = indicator | 0;
    const traits = {} as SchemaTraitsObject;
    if ((indicator & 1) === 1) {
      traits.httpLabel = 1;
    }
    if (((indicator >> 1) & 1) === 1) {
      traits.idempotent = 1;
    }
    if (((indicator >> 2) & 1) === 1) {
      traits.idempotencyToken = 1;
    }
    if (((indicator >> 3) & 1) === 1) {
      traits.sensitive = 1;
    }
    if (((indicator >> 4) & 1) === 1) {
      traits.httpPayload = 1;
    }
    if (((indicator >> 5) & 1) === 1) {
      traits.httpResponseCode = 1;
    }
    if (((indicator >> 6) & 1) === 1) {
      traits.httpQueryParams = 1;
    }
    return traits;
  }

  private static memberFrom(memberSchema: [SchemaRef, SchemaTraits], memberName: string): NormalizedSchema {
    if (memberSchema instanceof NormalizedSchema) {
      memberSchema.memberName = memberName;
      memberSchema._isMemberSchema = true;
      return memberSchema;
    }
    return new NormalizedSchema(memberSchema, memberName);
  }

  public getSchema(): ISchema {
    if (this.schema instanceof NormalizedSchema) {
      return this.schema.getSchema();
    }
    if (this.schema instanceof SimpleSchema) {
      return deref(this.schema.schemaRef);
    }
    return deref(this.schema);
  }

  public getName(withNamespace = false): string | undefined {
    if (!withNamespace) {
      if (this.name && this.name.includes("#")) {
        return this.name.split("#")[1];
      }
    }
    // empty name should return as undefined
    return this.name || undefined;
  }

  public getMemberName(): string {
    if (!this.isMemberSchema()) {
      throw new Error(`@smithy/core/schema - cannot get member name on non-member schema: ${this.getName(true)}`);
    }
    return this.memberName!;
  }

  public isMemberSchema(): boolean {
    return this._isMemberSchema;
  }

  public isUnitSchema(): boolean {
    return this.getSchema() === ("unit" as const);
  }

  public isListSchema(): boolean {
    const inner = this.getSchema();
    if (typeof inner === "number") {
      return inner >> 6 === SCHEMA.LIST_MODIFIER >> 6;
    }
    return inner instanceof ListSchema;
  }

  public isMapSchema(): boolean {
    const inner = this.getSchema();
    if (typeof inner === "number") {
      return inner >> 6 === SCHEMA.MAP_MODIFIER >> 6;
    }
    return inner instanceof MapSchema;
  }

  public isDocumentSchema(): boolean {
    return this.getSchema() === SCHEMA.DOCUMENT;
  }

  public isStructSchema(): boolean {
    const inner = this.getSchema();
    return (inner !== null && typeof inner === "object" && "members" in inner) || inner instanceof StructureSchema;
  }

  public isBlobSchema(): boolean {
    return this.getSchema() === SCHEMA.BLOB || this.getSchema() === SCHEMA.STREAMING_BLOB;
  }

  public isTimestampSchema(): boolean {
    const schema = this.getSchema();
    return typeof schema === "number" && schema >= SCHEMA.TIMESTAMP_DEFAULT && schema <= SCHEMA.TIMESTAMP_EPOCH_SECONDS;
  }

  public isStringSchema(): boolean {
    return this.getSchema() === SCHEMA.STRING;
  }

  public isBooleanSchema(): boolean {
    return this.getSchema() === SCHEMA.BOOLEAN;
  }

  public isNumericSchema(): boolean {
    return this.getSchema() === SCHEMA.NUMERIC;
  }

  public isBigIntegerSchema(): boolean {
    return this.getSchema() === SCHEMA.BIG_INTEGER;
  }

  public isBigDecimalSchema(): boolean {
    return this.getSchema() === SCHEMA.BIG_DECIMAL;
  }

  public isStreaming(): boolean {
    const streaming = !!this.getMergedTraits().streaming;
    if (streaming) {
      return true;
    }
    return this.getSchema() === SCHEMA.STREAMING_BLOB;
  }

  public getMergedTraits(): SchemaTraitsObject {
    if (this.normalizedTraits) {
      return this.normalizedTraits;
    }
    this.normalizedTraits = {
      ...this.getOwnTraits(),
      ...this.getMemberTraits(),
    };
    return this.normalizedTraits;
  }

  public getMemberTraits(): SchemaTraitsObject {
    return NormalizedSchema.translateTraits(this.memberTraits);
  }

  public getOwnTraits(): SchemaTraitsObject {
    return NormalizedSchema.translateTraits(this.traits);
  }

  public getKeySchema(): NormalizedSchema {
    if (this.isDocumentSchema()) {
      return NormalizedSchema.memberFrom([SCHEMA.DOCUMENT, 0], "key");
    }
    if (!this.isMapSchema()) {
      throw new Error(`@smithy/core/schema - cannot get key schema for non-map schema: ${this.getName(true)}`);
    }
    const schema = this.getSchema();
    if (typeof schema === "number") {
      return NormalizedSchema.memberFrom([0b0011_1111 & schema, 0], "key");
    }
    return NormalizedSchema.memberFrom([(schema as MapSchema).keySchema, 0], "key");
  }

  public getValueSchema(): NormalizedSchema {
    const schema = this.getSchema();

    if (typeof schema === "number") {
      if (this.isMapSchema()) {
        return NormalizedSchema.memberFrom([0b0011_1111 & schema, 0], "value");
      } else if (this.isListSchema()) {
        return NormalizedSchema.memberFrom([0b0011_1111 & schema, 0], "member");
      }
    }

    if (schema && typeof schema === "object") {
      if (this.isStructSchema()) {
        throw new Error(`cannot call getValueSchema() with StructureSchema ${this.getName(true)}`);
      }
      const collection = schema as MapSchema | ListSchema;
      if ("valueSchema" in collection) {
        if (this.isMapSchema()) {
          return NormalizedSchema.memberFrom([collection.valueSchema, 0], "value");
        } else if (this.isListSchema()) {
          return NormalizedSchema.memberFrom([collection.valueSchema, 0], "member");
        }
      }
    }

    if (this.isDocumentSchema()) {
      return NormalizedSchema.memberFrom([SCHEMA.DOCUMENT, 0], "value");
    }

    throw new Error(`@smithy/core/schema - the schema ${this.getName(true)} does not have a value member.`);
  }

  public getMemberSchema(member: string): NormalizedSchema | undefined {
    if (this.isStructSchema()) {
      const struct = this.getSchema() as StructureSchema;
      if (!(member in struct.members)) {
        // indicates the member is not recognized.
        return undefined;
      }
      return NormalizedSchema.memberFrom(struct.members[member], member);
    }
    if (this.isDocumentSchema()) {
      return NormalizedSchema.memberFrom([SCHEMA.DOCUMENT, 0], member);
    }
    throw new Error(`@smithy/core/schema - the schema ${this.getName(true)} does not have members.`);
  }

  public getMemberSchemas(): Record<string, NormalizedSchema> {
    const { schema } = this;
    const struct = schema as StructureSchema;
    if (!struct || typeof struct !== "object") {
      return {};
    }
    if ("members" in struct) {
      const buffer = {} as Record<string, NormalizedSchema>;
      for (const member of struct.memberNames) {
        buffer[member] = this.getMemberSchema(member)!;
      }
      return buffer;
    }
    return {};
  }

  private getSchemaName(): string {
    const schema = this.getSchema();
    if (typeof schema === "number") {
      const _schema = 0b0011_1111 & schema;
      const container = 0b1100_0000 & schema;
      const type =
        Object.entries(SCHEMA).find(([, value]) => {
          return value === _schema;
        })?.[0] ?? "Unknown";
      switch (container) {
        case SCHEMA.MAP_MODIFIER:
          return `${type}Map`;
        case SCHEMA.LIST_MODIFIER:
          return `${type}List`;
        case 0:
          return type;
      }
    }
    return "Unknown";
  }
}
