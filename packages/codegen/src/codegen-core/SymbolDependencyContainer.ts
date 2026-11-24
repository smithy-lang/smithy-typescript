import type { SymbolDependency } from "./SymbolDependency";

/**
 * @internal
 */
export interface SymbolDependencyContainer {
  getDependencies(): SymbolDependency[];
}
