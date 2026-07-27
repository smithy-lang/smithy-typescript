/**
 * Shared helpers for the two npm package existence entrypoints in this folder:
 * ensure-packages-exist-on-npm.mts (release PR check) and
 * refresh-npm-package-record.mts (cache refresh on main).
 *
 * Both answer the same question - which of this repository's package names
 * already exist on the npm registry - so the registry probe, the record format
 * and the workspace enumeration live here.
 *
 * The record is a list of package names confirmed to exist on npm. npm
 * publishes are immutable (a published name can never be unpublished or
 * reused), so a recorded name is guaranteed to still exist and its registry
 * check can be skipped. Its location comes from PUBLISHED_PACKAGES_RECORD; in
 * CI that file is a GitHub Actions cache entry (see
 * .github/workflows/npm-package-existence.yml): the refresh run on main writes
 * it and release PRs restore it read-only. It is only an optimization, so a
 * cache miss just means every package is verified against the registry.
 *
 * Only names the registry confirmed present are ever recorded. A missing or
 * unreachable package must never be written to the record, otherwise a real
 * check would be skipped later.
 *
 * These files run directly via Node type stripping (Node >= 24, no build step)
 * and use top-level await, hence the .mts extension.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type ExistStatus = "exists" | "missing" | "unknown";

export interface PackageJson {
  name?: string;
  version?: string;
  private?: boolean;
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const REGISTRY = "https://registry.npmjs.org";

/** The repository root, two levels up from scripts/npm-packages. */
export const root = path.join(scriptDir, "..", "..");

/** Logs a clear failure message and exits non-zero. */
export function fail(message: string): never {
  console.error(`❌ ${message}`);
  process.exit(1);
}

// Not checked in: CI restores it from (and refreshes it into) the GitHub Actions
// cache, and a local run without PUBLISHED_PACKAGES_RECORD just starts from an
// empty record.
const RECORD_PATH =
  process.env.PUBLISHED_PACKAGES_RECORD || path.join(os.tmpdir(), "smithy-typescript", "published-packages.json");

/** The record location, relative to the repository root when it is inside it. */
export const RECORD_DISPLAY = RECORD_PATH.startsWith(root + path.sep) ? path.relative(root, RECORD_PATH) : RECORD_PATH;

/**
 * A package is publishable if it has a name and is not private. Private
 * packages are never released: .changeset/config.json sets
 * privatePackages.version to false, so changesets neither versions nor
 * publishes them.
 */
export function isPublishable(pkgJson: PackageJson): boolean {
  return Boolean(pkgJson.name) && pkgJson.private !== true;
}

/**
 * The workspace roots holding packages, read from the root package.json rather
 * than hardcoded, so a new workspace root is covered automatically. Only the
 * "<dir>/*" form is supported, which is what this repository uses; anything
 * else is a hard error rather than a silently ignored set of packages.
 */
function getWorkspaceRoots(): string[] {
  const { workspaces } = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf-8")) as {
    workspaces?: string[];
  };
  if (!workspaces?.length) {
    fail("The root package.json declares no workspaces, so no packages could be found.");
  }
  return workspaces.map((pattern) => {
    const [dir, star, ...rest] = pattern.split("/");
    if (star !== "*" || rest.length > 0) {
      fail(`Unsupported workspace pattern ${pattern} in the root package.json; expected the form "<dir>/*".`);
    }
    return dir;
  });
}

export const WORKSPACE_ROOTS = getWorkspaceRoots();

/**
 * Returns the names of every publishable package in every workspace root.
 */
export function getAllPublishablePackageNames(): string[] {
  const names: string[] = [];
  for (const workspaceRoot of WORKSPACE_ROOTS) {
    const workspaceDir = path.join(root, workspaceRoot);
    for (const dir of fs.readdirSync(workspaceDir)) {
      const pkgJsonPath = path.join(workspaceDir, dir, "package.json");
      if (!fs.existsSync(pkgJsonPath)) {
        continue;
      }
      const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8")) as PackageJson;
      if (isPublishable(pkgJson)) {
        names.push(pkgJson.name as string);
      }
    }
  }
  return names;
}

/**
 * Resolves to "exists", "missing", or "unknown" (network/registry error).
 */
async function checkExists(name: string, attempt = 0): Promise<ExistStatus> {
  try {
    const res = await fetch(`${REGISTRY}/${name.replace("/", "%2F")}`, { method: "HEAD" });
    if (res.status === 404) {
      return "missing";
    }
    if (res.ok) {
      return "exists";
    }
    // Unexpected status: retry before giving up.
    if (attempt < 2) {
      return checkExists(name, attempt + 1);
    }
    return "unknown";
  } catch {
    if (attempt < 2) {
      return checkExists(name, attempt + 1);
    }
    return "unknown";
  }
}

/**
 * Queries the registry for the given names and splits them by existence.
 */
export async function partitionByExistence(names: string[]) {
  const results = await Promise.all(names.map(async (name) => ({ name, status: await checkExists(name) })));
  return {
    exists: results.filter((r) => r.status === "exists").map((r) => r.name),
    missing: results.filter((r) => r.status === "missing").map((r) => r.name),
    unknown: results.filter((r) => r.status === "unknown").map((r) => r.name),
  };
}

/** Warns about names the registry could not answer for. */
export function warnUnknown(unknown: string[]): void {
  if (unknown.length) {
    console.warn(
      `⚠️  Could not verify ${unknown.length} package(s) against the registry (network/registry error):\n  ` +
        unknown.join("\n  ")
    );
  }
}

/**
 * Loads the set of package names already confirmed published. Returns an empty
 * set if the record is absent or unreadable, in which case every package is
 * verified against the registry.
 */
export function loadRecord(): Set<string> {
  try {
    const data = JSON.parse(fs.readFileSync(RECORD_PATH, "utf-8"));
    return new Set<string>(Array.isArray(data.packages) ? data.packages : []);
  } catch {
    return new Set<string>();
  }
}

/**
 * Writes the record so the workflow can store it in the GitHub Actions cache.
 */
export function saveRecord(names: Iterable<string>): void {
  fs.mkdirSync(path.dirname(RECORD_PATH), { recursive: true });
  fs.writeFileSync(
    RECORD_PATH,
    JSON.stringify(
      {
        "//":
          "Generated by scripts/npm-packages/refresh-npm-package-record.mts and cached by " +
          ".github/workflows/npm-package-existence.yml. Packages confirmed published to npm; " +
          "their registry existence check is skipped, since npm publishes are immutable. Do not edit by hand.",
        packages: [...names].sort(),
      },
      null,
      2
    ) + "\n"
  );
}
