/**
 * A general SDK error that does not fall into a more specific category.
 *
 * @public
 */
export class SmithyError extends Error {
  public name = "SmithyError";
  public readonly $source: string = errors.$source;
}

/**
 * A value had the wrong type or could not be interpreted as the expected type.
 *
 * @public
 */
export class SmithyTypeError extends TypeError {
  public name = "SmithyTypeError";
  public readonly $source: string = errors.$source;
}

/**
 * A value was the correct type but fell outside its allowed range or bounds.
 *
 * @public
 */
export class SmithyRangeError extends RangeError {
  public name = "SmithyRangeError";
  public readonly $source: string = errors.$source;
}

/**
 * @public
 */
export type ErrorConstructor<E extends Error = Error> = new (message?: string) => E;

/**
 * @public
 */
export interface ErrorContainer {
  readonly $source: string;
  readonly Error: ErrorConstructor<SmithyError>;
  readonly TypeError: ErrorConstructor<SmithyTypeError>;
  readonly RangeError: ErrorConstructor<SmithyRangeError>;
}

/**
 * @public
 */
export const errors: ErrorContainer = {
  $source: "smithy",
  Error: SmithyError,
  TypeError: SmithyTypeError,
  RangeError: SmithyRangeError,
};
