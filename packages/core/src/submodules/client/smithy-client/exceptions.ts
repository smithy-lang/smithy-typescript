import type { HttpResponse, MetadataBearer, ResponseMetadata, RetryableTrait, SmithyException } from "@smithy/types";

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
 * Base exception class for the exceptions from the server-side.
 *
 * @public
 */
export class ServiceException extends Error implements SmithyException, MetadataBearer {
  public static readonly shapeId: string = "smithy.ts.sdk.synthetic.nonamespace.client#ServiceException";
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
      ServiceException.prototype.isPrototypeOf(candidate) ||
      (Boolean(candidate.$fault) &&
        Boolean(candidate.$metadata) &&
        (candidate.$fault === "client" || candidate.$fault === "server"))
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
    if (ServiceException.isInstance(instance)) {
      if (this.prototype.isPrototypeOf(instance)) {
        return true;
      }

      const targetId: string | undefined = Object.prototype.hasOwnProperty.call(this, "shapeId")
        ? this.shapeId
        : undefined;
      let candidateHasShapeId = false;
      if (targetId) {
        let proto = Object.getPrototypeOf(candidate);
        while (proto && proto !== Object.prototype) {
          const ctor = proto.constructor;
          const candidateId: string | undefined =
            ctor !== ServiceException && Object.prototype.hasOwnProperty.call(ctor, "shapeId")
              ? ctor?.shapeId
              : undefined;
          if (candidateId) {
            candidateHasShapeId = true;
            if (candidateId === targetId) {
              return true;
            }
          }
          proto = Object.getPrototypeOf(proto);
        }
      }

      // candidate stamped means do not proceed to name-comparison fallback.
      if (targetId && candidateHasShapeId) {
        return false;
      }

      // This part is only for pre-schema clients that don't register error schemas.
      // We will require that the name length is at least 6.
      const targetName = this.name;
      if (targetName && targetName.length >= 6) {
        if (candidate.name === targetName) {
          return true;
        }
        let proto = Object.getPrototypeOf(candidate);
        while (proto && proto !== Object.prototype) {
          const ctorName: string | undefined = proto.constructor?.name;
          if (ctorName && ctorName !== "Error" && ctorName === targetName) {
            return true;
          }
          proto = Object.getPrototypeOf(proto);
        }
      }
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
