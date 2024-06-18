import { AbortHandler, AbortSignal as DeprecatedAbortSignal } from "@smithy/types";

/**
 * @public
 */
export { AbortHandler, DeprecatedAbortSignal as IAbortSignal };

/**
 * @public
 */
export class AbortSignal implements DeprecatedAbortSignal {
  public onabort: AbortHandler | null = null;
  private _aborted = false;

  constructor() {
    Object.defineProperty(this, "_aborted", {
      value: false,
      writable: true,
    });
  }

  /**
   * Whether the associated operation has already been cancelled.
   */
  get aborted(): boolean {
    return this._aborted;
  }

  /**
   * @internal
   */
  abort(): void {
    this._aborted = true;
    if (this.onabort) {
      this.onabort(this);
      this.onabort = null;
    }
  }
}
