import type {
  MemberSchema,
  NormalizedSchema as INormalizedSchema,
  Schema as ISchema,
  SchemaRef,
  SchemaTraits,
} from "@smithy/types";

import { deref } from "../deref";
import { ListSchema } from "./ListSchema";
import { MapSchema } from "./MapSchema";
import { Schema } from "./Schema";
import { StructureSchema } from "./StructureSchema";

/**
 * Wraps SchemaRef values for easier handling.
 * @internal
 */
export class NormalizedSchema implements INormalizedSchema {
  public name: string;
  public traits: SchemaTraits = {};
  private _isMemberSchema: boolean;
  private schema: Exclude<ISchema, MemberSchema>;
  private memberTraits: SchemaTraits = {};

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
    }
    if (this.schema && typeof this.schema === "object") {
      this.traits = this.schema?.traits ?? {};
    }
    this.name = (typeof this.schema === "object" ? this.schema?.name : void 0) ?? this.memberName ?? "";
  }

  public static of(ref: SchemaRef, memberName?: string): NormalizedSchema {
    if (ref instanceof NormalizedSchema) {
      return ref;
    }
    return new NormalizedSchema(ref, memberName);
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
      return this.schema >> 6 === 0b01;
    }
    return this.schema instanceof ListSchema;
  }

  public isMapSchema(): boolean {
    if (typeof this.schema === "number") {
      return this.schema >> 6 === 0b10;
    }
    return this.schema instanceof MapSchema;
  }

  public isDocumentSchema(): boolean {
    return this.schema === 15;
  }

  public isStructSchema(): boolean {
    return (
      (this.schema !== null && typeof this.schema === "object" && "members" in this.schema) ||
      this.schema instanceof StructureSchema
    );
  }

  public isBlobSchema(): boolean {
    return this.schema === 21 || this.schema === 42;
  }

  public isTimestampSchema(): boolean {
    return typeof this.schema === "number" && this.schema >= 4 && this.schema <= 7;
  }

  public isStringSchema(): boolean {
    return this.schema === 0;
  }

  public isBooleanSchema(): boolean {
    return this.schema === 2;
  }

  public isNumericSchema(): boolean {
    return this.schema === 1;
  }

  public isBigIntegerSchema(): boolean {
    return this.schema === 17;
  }

  public isBigDecimalSchema(): boolean {
    return this.schema === 19;
  }

  public isStreaming(): boolean {
    return !!this.getMergedTraits().streaming || this.getSchema() === 42;
  }

  public getMergedTraits(): SchemaTraits {
    return {
      ...this.getOwnTraits(),
      ...this.getMemberTraits(),
    };
  }

  public getMemberTraits(): SchemaTraits {
    return this.memberTraits;
  }

  public getOwnTraits(): SchemaTraits {
    return this.traits;
  }

  public getValueSchema(): NormalizedSchema {
    if (typeof this.schema === "number" && this.schema >= 0b0010_0000) {
      return NormalizedSchema.of(0b0011_1111 & this.schema);
    }
    if (this.schema && typeof this.schema === "object") {
      if (this.isStructSchema()) {
        throw new Error("cannot call getValueSchema() with StructureSchema");
      }
      const collection = this.schema as MapSchema | ListSchema;
      if ("valueSchema" in collection) {
        return NormalizedSchema.of(collection.valueSchema);
      }
    }
    if (this.isDocumentSchema()) {
      return NormalizedSchema.of(15);
    }
    throw new Error("@smithy/core/schema - the schema does not have a value member.");
  }

  public getMemberSchema(member: string): NormalizedSchema | undefined {
    if (this.schema && typeof this.schema === "object") {
      const struct = this.schema as StructureSchema;
      if ("members" in struct) {
        if (typeof member === "undefined") {
          throw new Error("cannot call getMemberSchema(void) with StructureSchema");
        }
        if (!(member in struct.members)) {
          // indicates the member is not recognized.
          return undefined;
        }
        return NormalizedSchema.of(struct.members[member], member as string);
      }
    }
    if (this.isDocumentSchema()) {
      return NormalizedSchema.of(15);
    }
    throw new Error("@smithy/core/schema - the schema does not have members.");
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
}
