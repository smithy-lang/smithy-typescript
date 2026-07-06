/**
 * This implementation was added as Node.js didn't support AbortController prior to 15.x
 * Use native implementation in browsers or Node.js \>=15.4.0.
 *
 * @deprecated Use standard implementations in [Browsers](https://developer.mozilla.org/en-US/docs/Web/API/AbortController) and [Node.js](https://nodejs.org/docs/latest/api/globals.html#class-abortcontroller)
 * @packageDocumentation
 */
export { AbortController } from "./AbortController";
export type { IAbortController } from "./AbortController";
export { AbortSignal } from "./AbortSignal";
export type { AbortHandler, IAbortSignal } from "./AbortSignal";
