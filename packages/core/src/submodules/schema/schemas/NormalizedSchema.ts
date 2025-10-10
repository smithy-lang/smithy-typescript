import type {
  BigDecimalSchema,
  BigIntegerSchema,
  BlobSchema,
  BooleanSchema,
  DocumentSchema,
  ListSchemaModifier,
  MapSchemaModifier,
  MemberSchema,
  NormalizedSchema as INormalizedSchema,
  NumericSchema,
  Schema as ISchema,
  SchemaRef,
  SchemaTraits,
  SchemaTraitsObject,
  StaticErrorSchema,
  StaticListSchema,
  StaticMapSchema,
  StaticOperationSchema,
  StaticSchema,
  StaticSchemaId,
  StaticSimpleSchema,
  StaticStructureSchema,
  StreamingBlobSchema,
  StringSchema,
  TimestampDefaultSchema,
  TimestampEpochSecondsSchema,
  UnitSchema,
} from "@smithy/types";
import type { IdempotencyTokenBitMask, TraitBitVector } from "@smithy/types/src/schema/traits";

import { deref } from "../deref";
import type { ErrorSchema } from "./ErrorSchema";
import { error } from "./ErrorSchema";
import { list, ListSchema } from "./ListSchema";
import { map, MapSchema } from "./MapSchema";
import type { OperationSchema } from "./OperationSchema";
import { op } from "./OperationSchema";
import { Schema } from "./Schema";
import type { SimpleSchema } from "./SimpleSchema";
import { sim } from "./SimpleSchema";
import { struct, StructureSchema } from "./StructureSchema";
import { translateTraits } from "./translateTraits";

/**
 * Wraps both class instances, numeric sentinel values, and member schema pairs.
 * Presents a consistent interface for interacting with polymorphic schema representations.
 *
 * @alpha
 */
export class NormalizedSchema implements INormalizedSchema {
  // ========================
  //
  // This class implementation may be a little bit code-golfed to save space.
  // This class is core to all clients in schema-serde mode.
  // For readability, add comments rather than code.
  //
  // ========================
  public static readonly symbol = Symbol.for("@smithy/nor");
  protected readonly symbol = NormalizedSchema.symbol;

  private readonly name!: string;
  private readonly schema!: Exclude<ISchema, MemberSchema | INormalizedSchema>;
  private readonly _isMemberSchema: boolean;

  private readonly traits!: SchemaTraits;
  private readonly memberTraits: SchemaTraits;
  private normalizedTraits?: SchemaTraitsObject;

  /**
   * @param ref - a polymorphic SchemaRef to be dereferenced/normalized.
   * @param memberName - optional memberName if this NormalizedSchema should be considered a member schema.
   */
  private constructor(
    readonly ref: SchemaRef,
    private readonly memberName?: string
  ) {
    const traitStack = [] as SchemaTraits[];
    let _ref = ref;
    let schema = ref;
    this._isMemberSchema = false;

    while (isMemberSchema(_ref)) {
      traitStack.push(_ref[1]);
      _ref = _ref[0];
      schema = deref(_ref);
      this._isMemberSchema = true;
    }

    if (isStaticSchema(schema)) schema = hydrate(schema);

    if (traitStack.length > 0) {
      this.memberTraits = {};
      for (let i = traitStack.length - 1; i >= 0; --i) {
        const traitSet = traitStack[i];
        Object.assign(this.memberTraits, translateTraits(traitSet));
      }
    } else {
      this.memberTraits = 0;
    }

    if (schema instanceof NormalizedSchema) {
      const computedMemberTraits = this.memberTraits;
      Object.assign(this, schema);
      this.memberTraits = Object.assign({}, computedMemberTraits, schema.getMemberTraits(), this.getMemberTraits());
      this.normalizedTraits = void 0;
      this.memberName = memberName ?? schema.memberName;
      return;
    }

    this.schema = deref(schema) as Exclude<ISchema, MemberSchema | INormalizedSchema>;

    if (this.schema && typeof this.schema === "object") {
      // excluded by the checked hydrate call above.
      this.traits = (this.schema as Exclude<typeof this.schema, StaticSchema>)?.traits ?? {};
    } else {
      this.traits = 0;
    }

    this.name = (this.schema instanceof Schema ? this.schema.getName?.() : void 0) ?? this.memberName ?? String(schema);

    if (this._isMemberSchema && !memberName) {
      throw new Error(`@smithy/core/schema - NormalizedSchema member init ${this.getName(true)} missing member name.`);
    }
  }

  public static [Symbol.hasInstance](lhs: unknown): lhs is NormalizedSchema {
    return Schema[Symbol.hasInstance].bind(this)(lhs);
  }

  /**
   * Static constructor that attempts to avoid wrapping a NormalizedSchema within another.
   */
  public static of(ref: SchemaRef): NormalizedSchema {
    const sc = deref(ref);
    if (sc instanceof NormalizedSchema) {
      return sc;
    }
    if (isMemberSchema(sc)) {
      const [ns, traits] = sc;
      if (ns instanceof NormalizedSchema) {
        Object.assign(ns.getMergedTraits(), translateTraits(traits));
        return ns;
      }
      // An aggregate schema must be initialized with members and the member retrieved through the aggregate
      // container.
      throw new Error(`@smithy/core/schema - may not init unwrapped member schema=${JSON.stringify(ref, null, 2)}.`);
    }
    return new NormalizedSchema(sc);
  }

  /**
   * @returns the underlying non-normalized schema.
   */
  public getSchema(): Exclude<ISchema, MemberSchema | INormalizedSchema> {
    return deref((this.schema as SimpleSchema)?.schemaRef ?? this.schema) as Exclude<
      ISchema,
      MemberSchema | INormalizedSchema
    >;
  }

  /**
   * @param withNamespace - qualifies the name.
   * @returns e.g. `MyShape` or `com.namespace#MyShape`.
   */
  public getName(withNamespace = false): string | undefined {
    const { name } = this;
    const short = !withNamespace && name && name.includes("#");
    // empty name should return as undefined
    return short ? name.split("#")[1] : name || undefined;
  }

  /**
   * @returns the member name if the schema is a member schema.
   */
  public getMemberName(): string {
    return this.memberName!;
  }

  public isMemberSchema(): boolean {
    return this._isMemberSchema;
  }

  /**
   * boolean methods on this class help control flow in shape serialization and deserialization.
   */
  public isListSchema(): boolean {
    const sc = this.getSchema();
    return typeof sc === "number"
      ? sc >= (64 satisfies ListSchemaModifier) && sc < (128 satisfies MapSchemaModifier)
      : sc instanceof ListSchema;
  }

  public isMapSchema(): boolean {
    const sc = this.getSchema();
    return typeof sc === "number"
      ? sc >= (128 satisfies MapSchemaModifier) && sc <= 0b1111_1111
      : sc instanceof MapSchema;
  }

  public isStructSchema(): boolean {
    const sc = this.getSchema();
    return (sc !== null && typeof sc === "object" && "members" in sc) || sc instanceof StructureSchema;
  }

  public isBlobSchema(): boolean {
    const sc = this.getSchema();
    return sc === (21 satisfies BlobSchema) || sc === (42 satisfies StreamingBlobSchema);
  }

  public isTimestampSchema(): boolean {
    const sc = this.getSchema();
    return (
      typeof sc === "number" &&
      sc >= (4 satisfies TimestampDefaultSchema) &&
      sc <= (7 satisfies TimestampEpochSecondsSchema)
    );
  }

  public isUnitSchema(): boolean {
    return this.getSchema() === ("unit" satisfies UnitSchema);
  }

  public isDocumentSchema(): boolean {
    return this.getSchema() === (15 satisfies DocumentSchema);
  }

  public isStringSchema(): boolean {
    return this.getSchema() === (0 satisfies StringSchema);
  }

  public isBooleanSchema(): boolean {
    return this.getSchema() === (2 satisfies BooleanSchema);
  }

  public isNumericSchema(): boolean {
    return this.getSchema() === (1 satisfies NumericSchema);
  }

  public isBigIntegerSchema(): boolean {
    return this.getSchema() === (17 satisfies BigIntegerSchema);
  }

  public isBigDecimalSchema(): boolean {
    return this.getSchema() === (19 satisfies BigDecimalSchema);
  }

  public isStreaming(): boolean {
    const { streaming } = this.getMergedTraits();
    return !!streaming || this.getSchema() === (42 satisfies StreamingBlobSchema);
  }

  /**
   * This is a shortcut to avoid calling `getMergedTraits().idempotencyToken` on every string.
   * @returns whether the schema has the idempotencyToken trait.
   */
  public isIdempotencyToken(): boolean {
    // it is ok to perform the & operation on a trait object,
    // since its int32 representation is 0.
    const match = (traits?: SchemaTraits) =>
      ((traits as TraitBitVector) & (0b0100 satisfies IdempotencyTokenBitMask)) === 0b0100 ||
      !!(traits as SchemaTraitsObject)?.idempotencyToken;

    const { normalizedTraits, traits, memberTraits } = this;
    return match(normalizedTraits) || match(traits) || match(memberTraits);
  }

  /**
   * @returns own traits merged with member traits, where member traits of the same trait key take priority.
   * This method is cached.
   */
  public getMergedTraits(): SchemaTraitsObject {
    return (
      this.normalizedTraits ??
      (this.normalizedTraits = {
        ...this.getOwnTraits(),
        ...this.getMemberTraits(),
      })
    );
  }

  /**
   * @returns only the member traits. If the schema is not a member, this returns empty.
   */
  public getMemberTraits(): SchemaTraitsObject {
    return translateTraits(this.memberTraits);
  }

  /**
   * @returns only the traits inherent to the shape or member target shape if this schema is a member.
   * If there are any member traits they are excluded.
   */
  public getOwnTraits(): SchemaTraitsObject {
    return translateTraits(this.traits);
  }

  /**
   * @returns the map's key's schema. Returns a dummy Document schema if this schema is a Document.
   *
   * @throws Error if the schema is not a Map or Document.
   */
  public getKeySchema(): NormalizedSchema {
    const [isDoc, isMap] = [this.isDocumentSchema(), this.isMapSchema()];
    if (!isDoc && !isMap) {
      throw new Error(`@smithy/core/schema - cannot get key for non-map: ${this.getName(true)}`);
    }
    const schema = this.getSchema();
    const memberSchema = isDoc
      ? (15 satisfies DocumentSchema)
      : (schema as MapSchema)?.keySchema ?? (0 satisfies StringSchema);
    return member([memberSchema, 0], "key");
  }

  /**
   * @returns the schema of the map's value or list's member.
   * Returns a dummy Document schema if this schema is a Document.
   *
   * @throws Error if the schema is not a Map, List, nor Document.
   */
  public getValueSchema(): NormalizedSchema {
    const sc = this.getSchema();
    const [isDoc, isMap, isList] = [this.isDocumentSchema(), this.isMapSchema(), this.isListSchema()];
    const memberSchema =
      typeof sc === "number"
        ? 0b0011_1111 & sc
        : sc && typeof sc === "object" && (isMap || isList)
          ? ((sc as MapSchema | ListSchema).valueSchema as typeof sc)
          : isDoc
            ? (15 satisfies DocumentSchema)
            : void 0;
    if (memberSchema != null) {
      return member([memberSchema, 0], isMap ? "value" : "member");
    }
    throw new Error(`@smithy/core/schema - ${this.getName(true)} has no value member.`);
  }

  /**
   * @returns the NormalizedSchema for the given member name. The returned instance will return true for `isMemberSchema()`
   * and will have the member name given.
   * @param memberName - which member to retrieve and wrap.
   *
   * @throws Error if member does not exist or the schema is neither a document nor structure.
   * Note that errors are assumed to be structures and unions are considered structures for these purposes.
   */
  public getMemberSchema(memberName: string): NormalizedSchema {
    const struct = this.getSchema() as StructureSchema;
    if (this.isStructSchema() && struct.memberNames.includes(memberName)) {
      const i = struct.memberNames.indexOf(memberName);
      const memberSchema = struct.memberList[i];
      return member(isMemberSchema(memberSchema) ? memberSchema : [memberSchema, 0], memberName);
    }
    if (this.isDocumentSchema()) {
      return member([15 satisfies DocumentSchema, 0], memberName);
    }
    throw new Error(`@smithy/core/schema - ${this.getName(true)} has no no member=${memberName}.`);
  }

  /**
   * This can be used for checking the members as a hashmap.
   * Prefer the structIterator method for iteration.
   *
   * This does NOT return list and map members, it is only for structures.
   *
   * @deprecated use (checked) structIterator instead.
   *
   * @returns a map of member names to member schemas (normalized).
   */
  public getMemberSchemas(): Record<string, NormalizedSchema> {
    const buffer = {} as any;
    try {
      for (const [k, v] of this.structIterator()) {
        buffer[k] = v;
      }
    } catch (ignored) {}
    return buffer;
  }

  /**
   * @returns member name of event stream or empty string indicating none exists or this
   * isn't a structure schema.
   */
  public getEventStreamMember(): string {
    if (this.isStructSchema()) {
      for (const [memberName, memberSchema] of this.structIterator()) {
        if (memberSchema.isStreaming() && memberSchema.isStructSchema()) {
          return memberName;
        }
      }
    }
    return "";
  }

  /**
   * Allows iteration over members of a structure schema.
   * Each yield is a pair of the member name and member schema.
   *
   * This avoids the overhead of calling Object.entries(ns.getMemberSchemas()).
   */
  public *structIterator(): Generator<[string, NormalizedSchema], undefined, undefined> {
    if (this.isUnitSchema()) {
      return;
    }
    if (!this.isStructSchema()) {
      throw new Error("@smithy/core/schema - cannot iterate non-struct schema.");
    }
    const struct = this.getSchema() as StructureSchema;
    for (let i = 0; i < struct.memberNames.length; ++i) {
      yield [struct.memberNames[i], member([struct.memberList[i], 0], struct.memberNames[i])];
    }
  }
}

/**
 * Creates a normalized member schema from the given schema and member name.
 *
 * @internal
 */
function member(memberSchema: NormalizedSchema | [SchemaRef, SchemaTraits], memberName: string): NormalizedSchema {
  if (memberSchema instanceof NormalizedSchema) {
    return Object.assign(memberSchema, {
      memberName,
      _isMemberSchema: true,
    });
  }
  const internalCtorAccess = NormalizedSchema as any;
  return new internalCtorAccess(memberSchema, memberName);
}

/**
 * @internal
 * @returns a class instance version of a static schema.
 */
export function hydrate(ss: StaticSimpleSchema): SimpleSchema;
export function hydrate(ss: StaticListSchema): ListSchema;
export function hydrate(ss: StaticMapSchema): MapSchema;
export function hydrate(ss: StaticStructureSchema): StructureSchema;
export function hydrate(ss: StaticErrorSchema): ErrorSchema;
export function hydrate(ss: StaticOperationSchema): OperationSchema;
export function hydrate(
  ss: StaticSchema
): SimpleSchema | ListSchema | MapSchema | StructureSchema | ErrorSchema | OperationSchema;
export function hydrate(
  ss: StaticSchema
): SimpleSchema | ListSchema | MapSchema | StructureSchema | ErrorSchema | OperationSchema {
  const [id, ...rest] = ss;
  return (
    {
      [0 satisfies StaticSchemaId.Simple]: sim,
      [1 satisfies StaticSchemaId.List]: list,
      [2 satisfies StaticSchemaId.Map]: map,
      [3 satisfies StaticSchemaId.Struct]: struct,
      [-3 satisfies StaticSchemaId.Error]: error,
      [9 satisfies StaticSchemaId.Operation]: op,
    }[id] as Function
  ).call(null, ...rest);
}

/**
 * @internal
 */
const isMemberSchema = (sc: SchemaRef): sc is MemberSchema => Array.isArray(sc) && sc.length === 2;

/**
 * @internal
 */
export const isStaticSchema = (sc: SchemaRef): sc is StaticSchema => Array.isArray(sc) && sc.length >= 5;
