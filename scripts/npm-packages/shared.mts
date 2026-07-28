/**
 * Shared helpers for the two npm registry entrypoints in this folder:
 *
 * - ensure-packages-exist-on-npm.mts - release PR check: the package names it
 *                                      will publish, and the versions it bumps
 *                                      past, already exist on npm.
 * - refresh-npm-package-record.mts   - refreshes the cached record on main.
 *
 * Both answer variations of one question - which of this repository's package
 * names and versions exist on the npm registry - so the registry probe, the record
 * format and the workspace enumeration live here. What each entrypoint does with
 * those - which packages it looks at, and what it does when one is missing - stays
 * in the entrypoint.
 *
 * The record maps a package name confirmed to exist on npm to the version of it
 * most recently confirmed published. npm publishes are immutable (neither a name
 * nor a version can ever be unpublished or reused), so anything recorded is
 * guaranteed to still exist and its registry check can be skipped. The record's
 * location comes from PUBLISHED_PACKAGES_RECORD; in CI that file is a GitHub
 * Actions cache entry (see
 * .github/workflows/npm-package-existence.yml): the refresh run on main writes it
 * and release PRs restore it read-only. It is only an optimization, so a cache
 * miss just means everything is verified against the registry.
 *
 * Only what the registry confirmed present is ever recorded. A missing or
 * unreachable package or version must never be written to the record, otherwise a
 * real check would be skipped later.
 *
 * These files run directly via Node type stripping (Node >= 24, no build step)
 * and use top-level await, hence the .mts extension.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

type ExistStatus = "exists" | "missing" | "unknown";

export interface PackageJson {
  name?: string;
  version?: string;
  private?: boolean;
}

/** One version of one package, as probed against the registry and reported. */
export interface PackageVersion {
  name: string;
  version: string;
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

/** Renders a package version the way npm does, e.g. @smithy/core@3.31.0. */
export function formatPackageVersion({ name, version }: PackageVersion): string {
  return `${name}@${version}`;
}

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
 * Returns every publishable package in every workspace root, at the version it
 * currently declares. A manifest without a version is skipped: there is nothing
 * to look up on the registry for it.
 */
export function getAllPublishablePackages(): PackageVersion[] {
  const packages: PackageVersion[] = [];
  for (const workspaceRoot of WORKSPACE_ROOTS) {
    const workspaceDir = path.join(root, workspaceRoot);
    for (const dir of fs.readdirSync(workspaceDir)) {
      const pkgJsonPath = path.join(workspaceDir, dir, "package.json");
      if (!fs.existsSync(pkgJsonPath)) {
        continue;
      }
      const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8")) as PackageJson;
      if (isPublishable(pkgJson) && pkgJson.version) {
        packages.push({ name: pkgJson.name as string, version: pkgJson.version });
      }
    }
  }
  return packages;
}

/**
 * Resolves to "exists", "missing", or "unknown" (network/registry error).
 */
async function probe(url: string, attempt = 0): Promise<ExistStatus> {
  try {
    const res = await fetch(url, { method: "HEAD" });
    if (res.status === 404) {
      return "missing";
    }
    if (res.ok) {
      return "exists";
    }
    // Unexpected status: retry before giving up.
    if (attempt < 2) {
      return probe(url, attempt + 1);
    }
    return "unknown";
  } catch {
    if (attempt < 2) {
      return probe(url, attempt + 1);
    }
    return "unknown";
  }
}

/** The registry URL of a package, i.e. its packument. */
function packageUrl(name: string): string {
  return `${REGISTRY}/${name.replace("/", "%2F")}`;
}

/** Whether the package name exists on npm, in any version. */
function checkExists(name: string): Promise<ExistStatus> {
  return probe(packageUrl(name));
}

/** Whether that exact version of the package is published on npm. */
function checkVersionExists({ name, version }: PackageVersion): Promise<ExistStatus> {
  return probe(`${packageUrl(name)}/${encodeURIComponent(version)}`);
}

async function partition<T>(items: T[], check: (item: T) => Promise<ExistStatus>) {
  const results = await Promise.all(items.map(async (item) => ({ item, status: await check(item) })));
  const withStatus = (status: ExistStatus) => results.filter((r) => r.status === status).map((r) => r.item);
  return { exists: withStatus("exists"), missing: withStatus("missing"), unknown: withStatus("unknown") };
}

/**
 * Queries the registry for the given package names and splits them by existence.
 */
export function partitionByExistence(names: string[]) {
  return partition(names, checkExists);
}

/**
 * Queries the registry for the given package versions and splits them by
 * existence.
 */
export function partitionVersionsByExistence(versions: PackageVersion[]) {
  return partition(versions, checkVersionExists);
}

/** Warns about entries the registry could not answer for. */
export function warnUnknown(unknown: string[]): void {
  if (unknown.length) {
    console.warn(
      `⚠️  Could not verify ${unknown.length} package(s) against the registry (network/registry error):\n  ` +
        unknown.join("\n  ")
    );
  }
}

/**
 * Package names confirmed to exist on npm, mapped to the version of them most
 * recently confirmed published. One version per package is enough: the only
 * version ever looked up is the one a release PR bumps past, which is the version
 * on main that the last refresh recorded. A recorded name implies the name exists
 * on npm, whether or not the recorded version is the one being looked up.
 */
export type PublishedRecord = Map<string, string>;

// Not checked in: CI restores it from (and refreshes it into) the GitHub Actions
// cache, and a local run without PUBLISHED_PACKAGES_RECORD just starts from an
// empty record.
const RECORD_PATH =
  process.env.PUBLISHED_PACKAGES_RECORD || path.join(os.tmpdir(), "smithy-typescript", "published-packages.json");

/** The record location, relative to the repository root when it is inside it. */
export const RECORD_DISPLAY = RECORD_PATH.startsWith(root + path.sep) ? path.relative(root, RECORD_PATH) : RECORD_PATH;

/**
 * Loads the record. Returns an empty record if it is absent, unreadable or not
 * in the expected shape, in which case everything is verified against the
 * registry.
 */
export function loadRecord(): PublishedRecord {
  try {
    const { packages } = JSON.parse(fs.readFileSync(RECORD_PATH, "utf-8")) as {
      packages?: Record<string, string>;
    };
    if (!packages || typeof packages !== "object" || Array.isArray(packages)) {
      return new Map();
    }
    return new Map(Object.entries(packages).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  } catch {
    return new Map();
  }
}

/**
 * Writes the record so the workflow can store it in the GitHub Actions cache.
 * Paired with loadRecord, which must read back what this writes; how the record
 * is filled in between is up to its only writer, refresh-npm-package-record.mts.
 */
export function saveRecord(record: PublishedRecord): void {
  const packages: Record<string, string> = {};
  for (const name of [...record.keys()].sort()) {
    packages[name] = record.get(name) as string;
  }
  fs.mkdirSync(path.dirname(RECORD_PATH), { recursive: true });
  fs.writeFileSync(
    RECORD_PATH,
    JSON.stringify(
      {
        "//":
          "Generated by scripts/npm-packages/refresh-npm-package-record.mts and cached by " +
          ".github/workflows/npm-package-existence.yml. Package names confirmed published to npm, mapped to " +
          "the version of them most recently confirmed published; their registry checks are skipped, since " +
          "npm publishes are immutable. Do not edit by hand.",
        packages,
      },
      null,
      2
    ) + "\n"
  );
}
