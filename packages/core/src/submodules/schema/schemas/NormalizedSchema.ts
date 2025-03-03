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
import { Schema } from "./Schema";
import { SCHEMA } from "./sentinels";
import { StructureSchema } from "./StructureSchema";

/**
 * Wraps SchemaRef values for easier handling.
 * @internal
 */
export class NormalizedSchema implements INormalizedSchema {
  public readonly name: string;
  public readonly traits: SchemaTraits;
  private readonly _isMemberSchema: boolean;
  private readonly schema: Exclude<ISchema, MemberSchema>;
  private readonly memberTraits: SchemaTraits;
  private normalizedTraits?: SchemaTraitsObject;

  public constructor(
    public ref: SchemaRef,
    private memberName?: string
  ) {
    const schema: ISchema = deref(ref);
    this._isMemberSchema = Schema.isMemberSchema(schema);
    if (this._isMemberSchema) {
      const [schemaRef, traits] = schema as MemberSchema;
      this.schema = deref(schemaRef) as Exclude<ISchema, MemberSchema>;
      this.memberTraits = traits ?? {};
    } else {
      this.schema = schema as Exclude<ISchema, MemberSchema>;
      this.memberTraits = 0;
    }
    if (this.schema && typeof this.schema === "object") {
      this.traits = this.schema?.traits ?? {};
    } else {
      this.traits = 0;
    }
    this.name =
      (typeof this.schema === "object" ? this.schema?.name : void 0) ?? this.memberName ?? this.getSchemaName();
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

  public getSchema(): ISchema {
    return this.schema;
  }

  public getName(): string | undefined {
    // empty name should return as undefined
    return this.name || undefined;
  }

  public isMemberSchema(): boolean {
    return this._isMemberSchema;
  }

  public isListSchema(): boolean {
    if (typeof this.schema === "number") {
      return this.schema >> 6 === SCHEMA.LIST_MODIFIER >> 6;
    }
    return this.schema instanceof ListSchema;
  }

  public isMapSchema(): boolean {
    if (typeof this.schema === "number") {
      return this.schema >> 6 === SCHEMA.MAP_MODIFIER >> 6;
    }
    return this.schema instanceof MapSchema;
  }

  public isDocumentSchema(): boolean {
    return this.schema === SCHEMA.DOCUMENT;
  }

  public isStructSchema(): boolean {
    return (
      (this.schema !== null && typeof this.schema === "object" && "members" in this.schema) ||
      this.schema instanceof StructureSchema
    );
  }

  public isBlobSchema(): boolean {
    return this.schema === SCHEMA.BLOB || this.schema === SCHEMA.STREAMING_BLOB;
  }

  public isTimestampSchema(): boolean {
    return (
      typeof this.schema === "number" &&
      this.schema >= SCHEMA.TIMESTAMP_DEFAULT &&
      this.schema <= SCHEMA.TIMESTAMP_EPOCH_SECONDS
    );
  }

  public isStringSchema(): boolean {
    return this.schema === SCHEMA.STRING;
  }

  public isBooleanSchema(): boolean {
    return this.schema === SCHEMA.BOOLEAN;
  }

  public isNumericSchema(): boolean {
    return this.schema === SCHEMA.NUMERIC;
  }

  public isBigIntegerSchema(): boolean {
    return this.schema === SCHEMA.BIG_INTEGER;
  }

  public isBigDecimalSchema(): boolean {
    return this.schema === SCHEMA.BIG_DECIMAL;
  }

  public isStreaming(): boolean {
    return !!this.getMergedTraits().streaming || this.getSchema() === SCHEMA.STREAMING_BLOB;
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

  public getValueSchema(): NormalizedSchema {
    if (typeof this.schema === "number" && (this.isMapSchema() || this.isListSchema())) {
      return NormalizedSchema.of(0b0011_1111 & this.schema);
    }
    if (this.schema && typeof this.schema === "object") {
      if (this.isStructSchema()) {
        throw new Error(`cannot call getValueSchema() with StructureSchema ${this.name}`);
      }
      const collection = this.schema as MapSchema | ListSchema;
      if ("valueSchema" in collection) {
        return NormalizedSchema.of(collection.valueSchema);
      }
    }
    if (this.isDocumentSchema()) {
      return NormalizedSchema.of(SCHEMA.DOCUMENT);
    }
    throw new Error(`@smithy/core/schema - the schema ${this.name} does not have a value member.`);
  }

  public getMemberSchema(member: string): NormalizedSchema | undefined {
    if (this.schema && typeof this.schema === "object") {
      const struct = this.schema as StructureSchema;
      if ("members" in struct) {
        if (typeof member === "undefined") {
          throw new Error(`cannot call getMemberSchema(void) with StructureSchema ${this.name}`);
        }
        if (!(member in struct.members)) {
          // indicates the member is not recognized.
          return undefined;
        }
        return NormalizedSchema.of(struct.members[member], member as string);
      }
    }
    if (this.isDocumentSchema()) {
      return NormalizedSchema.of(SCHEMA.DOCUMENT);
    }
    throw new Error(`@smithy/core/schema - the schema ${this.name} does not have members.`);
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
    if (typeof this.schema === "number") {
      const schema = 0b0011_1111 & this.schema;
      const container = 0b1100_0000 & this.schema;
      const type =
        Object.entries(SCHEMA).find(([, value]) => {
          return value === schema;
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
