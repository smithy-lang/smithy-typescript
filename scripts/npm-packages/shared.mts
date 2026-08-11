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
// Aliased, so a wait cannot be misread as scheduling a callback with the global.
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

type ExistStatus = "exists" | "missing" | "unknown";

/** A missing name and a missing version are different problems, so kept apart. */
type CheckStatus = "exists" | "missingName" | "missingVersion" | "unknown";

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

/**
 * What to ask the registry about one package: whether that exact version is
 * published or, when version is null, only whether the name exists at all, in any
 * version.
 */
export interface PackageCheck {
  name: string;
  version: string | null;
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

/**
 * Renders a package version the way npm does, e.g. @smithy/core@3.31.0, or the
 * name alone when there is no version in question.
 */
export function formatPackageVersion({ name, version }: PackageCheck): string {
  return version === null ? name : `${name}@${version}`;
}

/**
 * The name and version a manifest declares, or null when its package is private.
 * Private packages are never released: .changeset/config.json sets
 * privatePackages.version to false, so changesets neither versions nor
 * publishes them.
 *
 * A manifest that is not private must declare both, since changesets versions and
 * publishes every non-private workspace package: skipping one that does not would
 * silently drop it from every check here.
 */
export function readPublishablePackage(pkgJsonPath: string): PackageVersion | null {
  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8")) as PackageJson;
  if (pkgJson.private === true) {
    return null;
  }
  if (!pkgJson.name || !pkgJson.version) {
    fail(
      `${path.relative(root, pkgJsonPath)} is not private but declares no ${!pkgJson.name ? "name" : "version"}, ` +
        `so it cannot be checked against the npm registry. Add the missing field, or mark the package private if ` +
        `it is not meant to be released.`
    );
  }
  return { name: pkgJson.name, version: pkgJson.version };
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
 * currently declares. A workspace root also holds entries that are not packages,
 * such as a README, which have no manifest to read.
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
      const pkg = readPublishablePackage(pkgJsonPath);
      if (pkg) {
        packages.push(pkg);
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

/**
 * Resolves one check against the registry. A published version implies a
 * published name, so probing the version answers both questions whenever it finds
 * it. The name is probed on its own only when there is no version to ask about,
 * or when the version is absent and the two problems have to be told apart - and
 * a name probe the registry cannot answer counts as a missing version, since the
 * 404 on the version is definitive either way.
 */
async function check({ name, version }: PackageCheck): Promise<CheckStatus> {
  if (version === null) {
    const nameOnly = await probe(packageUrl(name));
    return nameOnly === "missing" ? "missingName" : nameOnly;
  }
  const status = await probe(`${packageUrl(name)}/${encodeURIComponent(version)}`);
  if (status !== "missing") {
    return status;
  }
  return (await probe(packageUrl(name))) === "missing" ? "missingName" : "missingVersion";
}

/** How a set of checks came out: every check lands in exactly one bucket. */
export interface ExistencePartition<T extends PackageCheck> {
  exists: T[];
  missingNames: T[];
  missingVersions: T[];
  unknown: T[];
}

/**
 * Queries the registry for the given checks and splits them by what it found:
 * names that do not exist at all, versions that are not published under a name
 * that does, and checks the registry could not answer.
 */
export async function partitionByExistence<T extends PackageCheck>(checks: T[]): Promise<ExistencePartition<T>> {
  const results = await Promise.all(checks.map(async (item) => ({ item, status: await check(item) })));
  const withStatus = (status: CheckStatus) => results.filter((r) => r.status === status).map((r) => r.item);
  return {
    exists: withStatus("exists"),
    missingNames: withStatus("missingName"),
    missingVersions: withStatus("missingVersion"),
    unknown: withStatus("unknown"),
  };
}

/**
 * How long to keep re-checking a package the registry does not have yet, and how
 * long to leave between passes.
 *
 * Since 2026-07-28 npm scans every publish for malware before making it
 * available for install, which typically takes around five minutes and can take
 * 15 or more depending on the size and content of the package and on how busy
 * the registry is. Until the scan passes the registry answers 404 for the new
 * version exactly as it does for a version that was never published, so a caller
 * probing versions that were only just published cannot tell the two apart and
 * has to wait the scan out. See
 * https://github.blog/changelog/2026-07-28-npm-publish-time-malware-scanning-and-dual-use-metadata/.
 *
 * The budget is deliberately well past the quoted 15 minutes, since those times
 * are described as current typical behaviour rather than a guarantee. Overrunning
 * it is not a failure: the only cost is a version left unverified.
 */
const DEFAULT_PUBLISH_SCAN_WAIT_MS = 25 * 60_000;
const PUBLISH_SCAN_POLL_INTERVAL_MS = 60_000;

/**
 * The wait budget, which NPM_PUBLISH_SCAN_WAIT_MS overrides - set it to 0 for a
 * local run that should not wait at all. A value that is not a non-negative
 * number is an error rather than a silent fall back to the default, so a typo
 * cannot leave a run waiting for 25 minutes unexplained.
 */
function getPublishScanWaitMs(): number {
  const override = process.env.NPM_PUBLISH_SCAN_WAIT_MS?.trim();
  if (!override) {
    return DEFAULT_PUBLISH_SCAN_WAIT_MS;
  }
  const ms = Number(override);
  if (!Number.isFinite(ms) || ms < 0) {
    fail(`NPM_PUBLISH_SCAN_WAIT_MS must be a number of milliseconds >= 0, got ${override}.`);
  }
  return ms;
}

const PUBLISH_SCAN_WAIT_MS = getPublishScanWaitMs();

/**
 * partitionByExistence for a caller probing versions that may have been
 * published moments ago: whatever the registry does not have yet is re-checked
 * until it appears or PUBLISH_SCAN_WAIT_MS runs out, so a version still going
 * through npm's publish-time scan is not mistaken for one that was never
 * published.
 *
 * Checks the registry could not answer are re-checked too, so a transient
 * registry outage that outlasts probe's own retries is also waited out. onWait is
 * called before each wait, so the caller can report that it is still waiting and
 * on what.
 */
export async function partitionByExistenceWaitingForPublish<T extends PackageCheck>(
  checks: T[],
  onWait?: (pending: T[], waitMs: number) => void
): Promise<ExistencePartition<T>> {
  const deadline = Date.now() + PUBLISH_SCAN_WAIT_MS;
  let partition = await partitionByExistence(checks);
  // Only the pending checks are re-queried, so each pass costs less than the
  // last; what already exists is carried across passes.
  const exists = [...partition.exists];
  let pending = [...partition.missingNames, ...partition.missingVersions, ...partition.unknown];
  while (pending.length > 0 && Date.now() < deadline) {
    const waitMs = Math.min(PUBLISH_SCAN_POLL_INTERVAL_MS, deadline - Date.now());
    onWait?.(pending, waitMs);
    await sleep(waitMs);
    partition = await partitionByExistence(pending);
    exists.push(...partition.exists);
    pending = [...partition.missingNames, ...partition.missingVersions, ...partition.unknown];
  }
  // The last pass decides how anything still pending is reported.
  return { ...partition, exists };
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
