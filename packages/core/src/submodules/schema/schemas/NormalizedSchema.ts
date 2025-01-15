import type { MemberSchema, Schema as ISchema, SchemaRef, SchemaTraits } from "@smithy/types";

import { deref } from "../deref";
import { ListSchema } from "./ListSchema";
import { MapSchema } from "./MapSchema";
import { Schema } from "./Schema";
import { StructureSchema } from "./StructureSchema";

/**
 * Wraps SchemaRef values for easier handling.
 * @internal
 */
export class NormalizedSchema {
  private _isMemberSchema: boolean;
  private schema: Exclude<ISchema, MemberSchema>;
  private memberTraits: SchemaTraits = {};

  public constructor(
    public ref: SchemaRef,
    private memberName?: string
  ) {
    this._isMemberSchema = Schema.isMemberSchema(deref(ref));
    if (this._isMemberSchema) {
      this.schema = deref((ref as MemberSchema)[0]) as Exclude<ISchema, MemberSchema>;
      this.memberTraits = (ref as MemberSchema)[1] ?? {};
    } else {
      this.schema = deref(ref) as Exclude<ISchema, MemberSchema>;
    }
  }

  public static of(ref: SchemaRef, memberName?: string): NormalizedSchema {
    return new NormalizedSchema(ref, memberName);
  }

  public getSchema(): ISchema {
    return this.schema;
  }

  public getName(): string | undefined {
    return (typeof this.schema === "object" ? this.schema?.name : void 0) ?? this.memberName;
  }

  public isMemberSchema(): boolean {
    return this._isMemberSchema;
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
    if (typeof this.schema !== "string") {
      return this.schema?.traits ?? {};
    }
    return {};
  }

  public getMemberSchema(member?: string): NormalizedSchema {
    if ("members" in (this.schema as StructureSchema)) {
      if (typeof member === "undefined") {
        throw new Error("cannot call getMemberSchema(void) with StructureSchema");
      }
      return NormalizedSchema.of((this.schema as StructureSchema).members[member], member as string);
    }
    if ('valueSchema' in (this.schema as MapSchema | ListSchema)) {
      if (typeof member !== "undefined") {
        throw new Error("cannot call getMemberSchema(string) with List or Map Schema");
      }
      return NormalizedSchema.of((this.schema as MapSchema | ListSchema).valueSchema);
    }
    return NormalizedSchema.of(void 0);
  }
}
