import type { Symbol } from "./Symbol";

/**
 * Collects imports for a file and renders them.
 *
 * @internal
 */
export interface ImportContainer {
  importSymbol(symbol: Symbol, alias?: string): void;
  toString(): string;
}
