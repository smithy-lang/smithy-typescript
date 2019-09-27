export const TYPE = "__type";

/**
 * Checks if the given value is a Smithy structure of the given type.
 */
export function isa<T>(o: any, ...ids: string[]): o is T {
  return typeof o === "object" && TYPE in o && ids.indexOf(o[TYPE]) > -1;
}

/**
 * Type that is implemented by all Smithy shapes marked with the
 * error trait.
 */
export interface SmithyException {
  /**
   * The shape ID of the exception.
   */
  readonly __type: string;

  /**
   * Whether the client or server are at fault.
   */
  readonly $fault: "client" | "server";

  /**
   * The name of the error.
   */
  readonly $name: string;

  /**
   * The service that encountered the exception.
   */
  readonly $service?: string;
}

/**
 * Smithy document type values.
 */
export namespace DocumentType {
  export type Value = Scalar | Structure | List;
  export type Scalar = string | number | boolean | null | Uint8Array | Date;
  export type Structure = { [member: string]: Value };
  export interface List extends Array<Value> {}
}

/**
 * Contains an unknown variant for a tagged union.
 *
 * This type allows tagged unions to not lose unknown data encountered
 * when deserializing types.
 */
export interface UnknownVariant {
  /**
   * A tuple containing the name of the unknown tag followed by the
   * value of the unknown tag.
   */
  $unknown?: [string, any];
}

/**
 * Represents a tagged union where only one member of an object can be
 * specified at any given time.
 *
 * Unknown variant tags are always stored in the `$unknown` property
 * defined by the [[UnknownVariant]] interface.
 */
export type TaggedUnion<T> = TaggedUnionHelper<T>;

type TaggedUnionHelper<_T, T = UnknownVariant & _T> =
  Pick<T, Exclude<keyof T, keyof T>>
  & { [K in keyof T]-?: ExactlyOne<T, K> }[keyof T];

type ExactlyOne<T, K extends keyof T> =
  Required<Pick<T, K>>
  & Partial<Record<Exclude<keyof T, K>, undefined>>;
