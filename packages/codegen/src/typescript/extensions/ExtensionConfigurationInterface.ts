import type { Dependency } from "../Dependency";

export type NameAndDependency = readonly [name: string, dependency: Dependency];

/**
 * Describes a client extension configuration interface contributed by an integration.
 */
export interface ExtensionConfigurationInterface {
  name(): NameAndDependency;
  getExtensionConfigurationFn(): NameAndDependency;
  resolveRuntimeConfigFn(): NameAndDependency;
  submodule?(): string | null;
}
