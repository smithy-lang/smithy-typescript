import type { Symbol } from "./Symbol";

export interface SymbolContainer {
  getSymbols(): Symbol[];
}
