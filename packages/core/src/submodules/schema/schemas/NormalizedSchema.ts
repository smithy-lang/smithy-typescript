import type {
  $MemberSchema,
  $Schema,
  $SchemaRef,
  BigDecimalSchema,
  BigIntegerSchema,
  BlobSchema,
  BooleanSchema,
  DocumentSchema,
  ListSchemaModifier,
  MapSchemaModifier,
  NormalizedSchema as INormalizedSchema,
  NumericSchema,
  SchemaRef,
  SchemaTraits,
  SchemaTraitsObject,
  SimpleSchema,
  StaticListSchema,
  StaticMapSchema,
  StaticSchema,
  StaticSchemaIdError,
  StaticSchemaIdList,
  StaticSchemaIdMap,
  StaticSchemaIdStruct,
  StaticSchemaIdUnion,
  StaticSimpleSchema,
  StaticStructureSchema,
  StreamingBlobSchema,
  StringSchema,
  TimestampDefaultSchema,
  TimestampEpochSecondsSchema,
  UnitSchema,
} from "@smithy/types";

import { deref } from "../deref";
import { translateTraits } from "./translateTraits";

/**
 * Annotations for cacheable schema-derived data.
 * @internal
 */
const anno = {
  // reference to structure's member iterator.
  it: Symbol.for("@smithy/nor-struct-it"),
};

/**
 * Wraps both class instances, numeric sentinel values, and member schema pairs.
 * Presents a consistent interface for interacting with polymorphic schema representations.
 *
 * @public
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
  private readonly schema!: Exclude<$Schema, $MemberSchema | INormalizedSchema>;
  private readonly _isMemberSchema: boolean;

  private readonly traits!: SchemaTraits;
  private readonly memberTraits: SchemaTraits;
  private normalizedTraits?: SchemaTraitsObject;

  /**
   * @param ref - a polymorphic SchemaRef to be dereferenced/normalized.
   * @param memberName - optional memberName if this NormalizedSchema should be considered a member schema.
   */
  private constructor(
    readonly ref: $SchemaRef,
    private readonly memberName?: string
  ) {
    const traitStack = [] as SchemaTraits[];
    let _ref = ref;
    let schema = ref;
    this._isMemberSchema = false;

    while (isMemberSchema(_ref)) {
      traitStack.push(_ref[1]);
      _ref = _ref[0] as $SchemaRef;
      schema = deref(_ref) as $Schema;
      this._isMemberSchema = true;
    }

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

    this.schema = deref(schema) as Exclude<$Schema, $MemberSchema | INormalizedSchema>;

    if (isStaticSchema(this.schema)) {
      this.name = `${this.schema[1]}#${this.schema[2]}`;
      this.traits = this.schema[3];
    } else {
      this.name = this.memberName ?? String(schema);
      this.traits = 0;
    }

    if (this._isMemberSchema && !memberName) {
      throw new Error(`@smithy/core/schema - NormalizedSchema member init ${this.getName(true)} missing member name.`);
    }
  }

  public static [Symbol.hasInstance](lhs: unknown): lhs is NormalizedSchema {
    const isPrototype = this.prototype.isPrototypeOf(lhs as any);
    if (!isPrototype && typeof lhs === "object" && lhs !== null) {
      const ns = lhs as any;
      return ns.symbol === (this as any).symbol;
    }
    return isPrototype;
  }

  /**
   * Static constructor that attempts to avoid wrapping a NormalizedSchema within another.
   */
  public static of(ref: SchemaRef | $SchemaRef): NormalizedSchema {
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
    return new NormalizedSchema(sc as $SchemaRef);
  }

  /**
   * @returns the underlying non-normalized schema.
   */
  public getSchema(): Exclude<$Schema, $MemberSchema | INormalizedSchema> {
    const sc = this.schema;
    // array check is to prevent autoboxing or something like that.
    if (Array.isArray(sc) && (sc as StaticSimpleSchema)[0] === 0) {
      return (sc as StaticSimpleSchema)[4] as SimpleSchema;
    }
    return sc as Exclude<$Schema, $MemberSchema | INormalizedSchema>;
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
      : (sc as StaticSchema)[0] === (1 satisfies StaticSchemaIdList);
  }

  public isMapSchema(): boolean {
    const sc = this.getSchema();
    return typeof sc === "number"
      ? sc >= (128 satisfies MapSchemaModifier) && sc <= 0b1111_1111
      : (sc as StaticSchema)[0] === (2 satisfies StaticSchemaIdMap);
  }

  /**
   * To simplify serialization logic, static union schemas are considered a specialization
   * of structs in the TypeScript typings and JS runtime, as well as static error schemas
   * which have a different identifier.
   */
  public isStructSchema(): boolean {
    const sc = this.getSchema();
    if (typeof sc !== "object") {
      return false;
    }
    const id = (sc satisfies StaticSchema)[0];
    return (
      id === (3 satisfies StaticSchemaIdStruct) ||
      id === (-3 satisfies StaticSchemaIdError) ||
      id === (4 satisfies StaticSchemaIdUnion)
    );
  }

  public isUnionSchema(): boolean {
    const sc = this.getSchema();
    if (typeof sc !== "object") {
      return false;
    }
    return (sc satisfies StaticSchema)[0] === (4 satisfies StaticSchemaIdUnion);
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
   * @returns whether the schema has the idempotencyToken trait.
   */
  public isIdempotencyToken(): boolean {
    /*
    It's faster to create the normalized trait object than to
    attempt to match against multiple value types.
     */
    return !!this.getMergedTraits().idempotencyToken;
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
      : (schema as StaticMapSchema)[4] ?? (0 satisfies StringSchema);
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
          ? ((sc as StaticMapSchema | StaticListSchema)[3 + (sc as StaticSchema)[0]] as typeof sc)
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
    const struct = this.getSchema() as StaticStructureSchema;
    if (this.isStructSchema() && struct[4].includes(memberName)) {
      const i = struct[4].indexOf(memberName);
      const memberSchema = struct[5][i];
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
    const struct = this.getSchema() as StaticStructureSchema & {
      // the static structure may have a cached iterator list of
      // its members.
      [anno.it]?: Array<[string, NormalizedSchema]>;
    };

    const z = struct[4].length;
    let it = struct[anno.it];

    // to yield the cached iterator, it must exist and be
    // the same length as the current member list.
    if (it && z === it.length) {
      yield* it;
      return;
    }

    it = Array(z);
    for (let i = 0; i < z; ++i) {
      const k = struct[4][i];
      const v = member([struct[5][i], 0], k);
      yield (it[i] = [k, v]);
    }

    // cache the iterator only if all uncached items were iterated successfully.
    struct[anno.it] = it;
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
 */
const isMemberSchema = (sc: SchemaRef): sc is $MemberSchema => Array.isArray(sc) && sc.length === 2;

/**
 * @internal
 */
export const isStaticSchema = (sc: SchemaRef): sc is StaticSchema => Array.isArray(sc) && sc.length >= 5;
