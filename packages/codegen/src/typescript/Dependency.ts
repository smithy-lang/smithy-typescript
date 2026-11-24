import type { SymbolDependencyContainer } from "../codegen-core";
import type { PackageContainer } from "./PackageContainer";

/**
 * @internal
 */
export interface Dependency extends PackageContainer, SymbolDependencyContainer {}

/**
 * @internal
 */
export function isDependency(value: PackageContainer | string): value is Dependency {
  return typeof value === "object" && typeof (value as Partial<Dependency>).getDependencies === "function";
}
