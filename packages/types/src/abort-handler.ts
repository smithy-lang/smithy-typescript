import type { AbortSignal as CustomAbortSignal } from "./abort";

/**
 * @public
 */
export interface AbortHandler {
  (this: AbortSignal | CustomAbortSignal, ev: any): any;
}
