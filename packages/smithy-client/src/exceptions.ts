import { HttpResponse, MetadataBearer, ResponseMetadata, RetryableTrait, SmithyException } from "@smithy/types";

/**
 * The type of the exception class constructor parameter. The returned type contains the properties
 * in the `ExceptionType` but not in the `BaseExceptionType`. If the `BaseExceptionType` contains
 * `$metadata` and `message` properties, it's also included in the returned type.
 * @internal
 */
export type ExceptionOptionType<ExceptionType extends Error, BaseExceptionType extends Error> = Omit<
  ExceptionType,
  Exclude<keyof BaseExceptionType, "$metadata" | "message">
>;

/**
 * @public
 */
export interface ServiceExceptionOptions extends SmithyException, MetadataBearer {
  message?: string;
}

/**
 * @public
 *
 * Base exception class for the exceptions from the server-side.
 */
export class ServiceException extends Error implements SmithyException, MetadataBearer {
  readonly $fault: "client" | "server";

  $response?: HttpResponse;
  $retryable?: RetryableTrait;
  $metadata: ResponseMetadata;

  constructor(options: ServiceExceptionOptions) {
    super(options.message);
    Object.setPrototypeOf(this, Object.getPrototypeOf(this).constructor.prototype);
    this.name = options.name;
    this.$fault = options.$fault;
    this.$metadata = options.$metadata;
  }

  /**
   * Checks if a value is an instance of ServiceException (duck typed)
   */
  public static isInstance(value: unknown): value is ServiceException {
    if (!value) return false;
    const candidate = value as ServiceException;
    return (
      Boolean(candidate.$fault) &&
      Boolean(candidate.$metadata) &&
      (candidate.$fault === "client" || candidate.$fault === "server")
    );
  }

  /**
   * Custom instanceof check to support the operator for ServiceException base class
   */
  public static [Symbol.hasInstance](instance: unknown): boolean {
    // Handle null/undefined
    if (!instance) return false;
    const candidate = instance as ServiceException;
    // For ServiceException, check only $-props
    if (this === ServiceException) {
      return ServiceException.isInstance(instance);
    }
    // For subclasses, check both prototype chain and name match
    // Note: instance must be ServiceException first (having $-props)
    if (ServiceException.isInstance(instance)) {
      return this.prototype.isPrototypeOf(instance) || candidate.name === this.name;
    }
    return false;
  }
}

/**
 * This method inject unmodeled member to a deserialized SDK exception,
 * and load the error message from different possible keys('message',
 * 'Message').
 *
 * @internal
 */
export const decorateServiceException = <E extends ServiceException>(
  exception: E,
  additions: Record<string, any> = {}
): E => {
  // apply additional properties to deserialized ServiceException object
  Object.entries(additions)
    .filter(([, v]) => v !== undefined)
    .forEach(([k, v]) => {
      // @ts-ignore examine unmodeled keys
      if (exception[k] == undefined || exception[k] === "") {
        // @ts-ignore assign unmodeled keys
        exception[k] = v;
      }
    });
  // load error message from possible locations
  // @ts-expect-error message could exist in Message key.
  const message = exception.message || exception.Message || "UnknownError";
  exception.message = message;
  // @ts-expect-error
  delete exception.Message;
  return exception;
};
