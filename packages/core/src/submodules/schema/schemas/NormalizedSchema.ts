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
import { SimpleSchema } from "./SimpleSchema";
import { StructureSchema } from "./StructureSchema";

/**
 * Wraps both class instances, numeric sentinel values, and member schema pairs.
 * Presents a consistent interface for interacting with polymorphic schema representations.
 *
 * @alpha
 */
export class NormalizedSchema implements INormalizedSchema {
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
      Object.assign(this, schema);
      this.memberTraits = Object.assign({}, schema.getMemberTraits(), this.getMemberTraits());
      this.normalizedTraits = void 0;
      this.memberName = memberName ?? schema.memberName;
      return;
    }

    this.schema = deref(schema) as Exclude<ISchema, MemberSchema | INormalizedSchema>;

    if (this.schema && typeof this.schema === "object") {
      this.traits = this.schema?.traits ?? {};
    } else {
      this.traits = 0;
    }

    this.name =
      (this.schema instanceof Schema ? this.schema.getName?.() : void 0) ?? this.memberName ?? this.getSchemaName();

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
    if (ref instanceof NormalizedSchema) {
      return ref;
    }
    if (Array.isArray(ref)) {
      const [ns, traits] = ref;
      if (ns instanceof NormalizedSchema) {
        Object.assign(ns.getMergedTraits(), NormalizedSchema.translateTraits(traits));
        return ns;
      }
      // An aggregate schema must be initialized with members and the member retrieved through the aggregate
      // container.
      throw new Error(`@smithy/core/schema - may not init unwrapped member schema=${JSON.stringify(ref, null, 2)}.`);
    }
    return new NormalizedSchema(ref);
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
    let i = 0;
    for (const trait of [
      "httpLabel",
      "idempotent",
      "idempotencyToken",
      "sensitive",
      "httpPayload",
      "httpResponseCode",
      "httpQueryParams",
    ] as Array<keyof SchemaTraitsObject>) {
      if (((indicator >> i++) & 1) === 1) {
        traits[trait] = 1;
      }
    }
    return traits;
  }

  /**
   * @returns the underlying non-normalized schema.
   */
  public getSchema(): Exclude<ISchema, MemberSchema | INormalizedSchema> {
    if (this.schema instanceof NormalizedSchema) {
      Object.assign(this, { schema: this.schema.getSchema() });
      return this.schema;
    }
    if (this.schema instanceof SimpleSchema) {
      return deref(this.schema.schemaRef) as Exclude<ISchema, MemberSchema | INormalizedSchema>;
    }
    return deref(this.schema) as Exclude<ISchema, MemberSchema | INormalizedSchema>;
  }

  /**
   * @param withNamespace - qualifies the name.
   * @returns e.g. `MyShape` or `com.namespace#MyShape`.
   */
  public getName(withNamespace = false): string | undefined {
    if (!withNamespace) {
      if (this.name && this.name.includes("#")) {
        return this.name.split("#")[1];
      }
    }
    // empty name should return as undefined
    return this.name || undefined;
  }

  /**
   * @returns the member name if the schema is a member schema.
   * @throws Error when the schema isn't a member schema.
   */
  public getMemberName(): string {
    if (!this.isMemberSchema()) {
      throw new Error(`@smithy/core/schema - non-member schema: ${this.getName(true)}`);
    }
    return this.memberName!;
  }

  public isMemberSchema(): boolean {
    return this._isMemberSchema;
  }

  public isUnitSchema(): boolean {
    return this.getSchema() === ("unit" as const);
  }

  /**
   * boolean methods on this class help control flow in shape serialization and deserialization.
   */
  public isListSchema(): boolean {
    const inner = this.getSchema();
    if (typeof inner === "number") {
      return inner >= SCHEMA.LIST_MODIFIER && inner < SCHEMA.MAP_MODIFIER;
    }
    return inner instanceof ListSchema;
  }

  public isMapSchema(): boolean {
    const inner = this.getSchema();
    if (typeof inner === "number") {
      return inner >= SCHEMA.MAP_MODIFIER && inner <= 0b1111_1111;
    }
    return inner instanceof MapSchema;
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

  public isDocumentSchema(): boolean {
    return this.getSchema() === SCHEMA.DOCUMENT;
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

  /**
   * This is a shortcut to avoid calling `getMergedTraits().idempotencyToken` on every string.
   * @returns whether the schema has the idempotencyToken trait.
   */
  public isIdempotencyToken(): boolean {
    if (typeof this.traits === "number") {
      return (this.traits & 0b0100) === 0b0100;
    } else if (typeof this.traits === "object") {
      return !!this.traits.idempotencyToken;
    }
    return false;
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
    return NormalizedSchema.translateTraits(this.memberTraits);
  }

  /**
   * @returns only the traits inherent to the shape or member target shape if this schema is a member.
   * If there are any member traits they are excluded.
   */
  public getOwnTraits(): SchemaTraitsObject {
    return NormalizedSchema.translateTraits(this.traits);
  }

  /**
   * @returns the map's key's schema. Returns a dummy Document schema if this schema is a Document.
   *
   * @throws Error if the schema is not a Map or Document.
   */
  public getKeySchema(): NormalizedSchema {
    if (this.isDocumentSchema()) {
      return this.memberFrom([SCHEMA.DOCUMENT, 0], "key");
    }
    if (!this.isMapSchema()) {
      throw new Error(`@smithy/core/schema - cannot get key for non-map: ${this.getName(true)}`);
    }
    const schema = this.getSchema();
    if (typeof schema === "number") {
      return this.memberFrom([0b0011_1111 & schema, 0], "key");
    }
    return this.memberFrom([(schema as MapSchema).keySchema, 0], "key");
  }

  /**
   * @returns the schema of the map's value or list's member.
   * Returns a dummy Document schema if this schema is a Document.
   *
   * @throws Error if the schema is not a Map, List, nor Document.
   */
  public getValueSchema(): NormalizedSchema {
    const schema = this.getSchema();

    if (typeof schema === "number") {
      if (this.isMapSchema()) {
        return this.memberFrom([0b0011_1111 & schema, 0], "value");
      } else if (this.isListSchema()) {
        return this.memberFrom([0b0011_1111 & schema, 0], "member");
      }
    }

    if (schema && typeof schema === "object") {
      if (this.isStructSchema()) {
        throw new Error(`may not getValueSchema() on structure ${this.getName(true)}`);
      }
      const collection = schema as MapSchema | ListSchema;
      if ("valueSchema" in collection) {
        if (this.isMapSchema()) {
          return this.memberFrom([collection.valueSchema, 0], "value");
        } else if (this.isListSchema()) {
          return this.memberFrom([collection.valueSchema, 0], "member");
        }
      }
    }

    if (this.isDocumentSchema()) {
      return this.memberFrom([SCHEMA.DOCUMENT, 0], "value");
    }

    throw new Error(`@smithy/core/schema - ${this.getName(true)} has no value member.`);
  }

  /**
   * @param member - to query.
   * @returns whether there is a memberSchema with the given member name. False if not a structure (or union).
   */
  public hasMemberSchema(member: string): boolean {
    if (this.isStructSchema()) {
      const struct = this.getSchema() as StructureSchema;
      return struct.memberNames.includes(member);
    }
    return false;
  }

  /**
   * @returns the NormalizedSchema for the given member name. The returned instance will return true for `isMemberSchema()`
   * and will have the member name given.
   * @param member - which member to retrieve and wrap.
   *
   * @throws Error if member does not exist or the schema is neither a document nor structure.
   * Note that errors are assumed to be structures and unions are considered structures for these purposes.
   */
  public getMemberSchema(member: string): NormalizedSchema {
    if (this.isStructSchema()) {
      const struct = this.getSchema() as StructureSchema;
      if (!struct.memberNames.includes(member)) {
        throw new Error(`@smithy/core/schema - ${this.getName(true)} has no member=${member}.`);
      }
      const i = struct.memberNames.indexOf(member);
      const memberSchema = struct.memberList[i];
      return this.memberFrom(Array.isArray(memberSchema) ? memberSchema : [memberSchema, 0], member);
    }
    if (this.isDocumentSchema()) {
      return this.memberFrom([SCHEMA.DOCUMENT, 0], member);
    }
    throw new Error(`@smithy/core/schema - ${this.getName(true)} has no members.`);
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
      yield [struct.memberNames[i], this.memberFrom([struct.memberList[i], 0], struct.memberNames[i])];
    }
  }

  /**
   * Creates a normalized member schema from the given schema and member name.
   */
  private memberFrom(memberSchema: NormalizedSchema | [SchemaRef, SchemaTraits], memberName: string): NormalizedSchema {
    if (memberSchema instanceof NormalizedSchema) {
      return Object.assign(memberSchema, {
        memberName,
        _isMemberSchema: true,
      });
    }
    return new NormalizedSchema(memberSchema, memberName);
  }

  /**
   * @returns a last-resort human-readable name for the schema if it has no other identifiers.
   */
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
