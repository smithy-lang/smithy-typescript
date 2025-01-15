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
    return this.schema === 2 || this.schema instanceof ListSchema;
  }

  public isMapSchema(): boolean {
    return this.schema === 4 || this.schema instanceof MapSchema;
  }

  public isStructSchema(): boolean {
    return (
      this.schema === 8 ||
      (this.schema !== null && typeof this.schema === "object" && "members" in this.schema) ||
      this.schema instanceof StructureSchema
    );
  }

  public isBlobSchema(): boolean {
    return this.schema === "blob" || this.schema === "streaming-blob";
  }

  public isStreaming(): boolean {
    return !!this.getMergedTraits().streaming || this.getSchema() === "streaming-blob";
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

  public getMemberSchema(member?: string): NormalizedSchema {
    if (typeof this.schema !== "object") {
      return NormalizedSchema.of(void 0, member as string);
    }
    if ("members" in (this.schema as StructureSchema)) {
      if (typeof member === "undefined") {
        throw new Error("cannot call getMemberSchema(void) with StructureSchema");
      }
      return NormalizedSchema.of((this.schema as StructureSchema).members[member], member as string);
    }
    if ("valueSchema" in (this.schema as MapSchema | ListSchema)) {
      if (typeof member !== "undefined") {
        throw new Error("cannot call getMemberSchema(string) with List or Map Schema");
      }
      return NormalizedSchema.of((this.schema as MapSchema | ListSchema).valueSchema);
    }
    return NormalizedSchema.of(void 0, member as string);
  }

  public getMemberSchemas(): Record<string, NormalizedSchema> {
    const { schema } = this;
    if (!schema || typeof schema !== "object") {
      return {};
    }
    if ("members" in (schema as StructureSchema)) {
      const buffer = {} as Record<string, NormalizedSchema>;
      for (const member of Object.keys((schema as StructureSchema).members)) {
        buffer[member] = this.getMemberSchema(member);
      }
      return buffer;
    }
    return {};
  }
}
