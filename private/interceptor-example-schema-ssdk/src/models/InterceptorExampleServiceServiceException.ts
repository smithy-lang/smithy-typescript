// smithy-typescript generated code
import {
  type ServiceExceptionOptions as __ServiceExceptionOptions,
  ServiceException as __ServiceException,
} from "@smithy/core/client";

export type { __ServiceExceptionOptions };

export { __ServiceException };

/**
 * @public
 *
 * Base exception class for all service exceptions from InterceptorExampleService service.
 */
export class InterceptorExampleServiceServiceException extends __ServiceException {
  public static readonly shapeId: string = "smithy.ts.sdk.synthetic.example.interceptors#InterceptorExampleServiceServiceException";
  /**
   * @internal
   */
  constructor(options: __ServiceExceptionOptions) {
    super(options);
    Object.setPrototypeOf(this, InterceptorExampleServiceServiceException.prototype);
  }
}
