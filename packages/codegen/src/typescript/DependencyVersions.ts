import { DEPENDENCY_VERSIONS } from "./DependencyVersionsSnapshot";

/**
 * Versions of the published workspace packages, as they were when this package was built.
 */
export class DependencyVersions {
  public static get(packageName: string): string | undefined {
    return DEPENDENCY_VERSIONS[packageName];
  }
}
