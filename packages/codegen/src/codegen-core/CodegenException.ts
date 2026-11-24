/**
 * @internal
 */
export class CodegenException extends Error {
  public constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "CodegenException";
    if (cause !== undefined) {
      (this as { cause?: unknown }).cause = cause;
    }
  }
}
