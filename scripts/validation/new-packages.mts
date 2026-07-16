#!/usr/bin/env node

/**
 * Fails when a package this PR will publish does not yet exist on npm.
 *
 * npm trusted publishing (OIDC) can only be configured for a package that
 * already exists on the registry. A brand-new package name therefore cannot
 * be published by the automated OIDC release workflow: its first version must
 * be published manually, after which a maintainer configures this repository's
 * GitHub Actions workflow as a trusted publisher.
 *
 * This check runs on the changesets "Version NPM packages" release PR. The set
 * of packages to publish is derived from the changeset-release/main branch
 * itself: `changeset version` commits a bump to the `version` field of every
 * package to be published. We therefore look at the package.json updates the
 * branch introduces relative to its fork point from main (the merge-base), so
 * a moving main tip while the PR is open does not affect the result. Any
 * packages/<name>/package.json whose version differs from that fork point (or
 * is newly added) will be published. Maintainers are told to complete the
 * one-time manual setup *before* the PR is merged, instead of discovering a
 * confusing auth failure during release.
 *
 * To avoid re-querying the registry for every package on every release, names
 * already confirmed published are recorded in published-packages.json. npm
 * publishes are immutable (a published name can never be unpublished or reused),
 * so a recorded package is guaranteed to still exist and its registry check is
 * skipped. Only packages not yet in the record are queried, and the failure
 * message asks maintainers to add a package to the record after its first
 * publish + trusted-publisher setup.
 *
 * Runs directly via Node type stripping (Node >= 24, no build step). Uses
 * top-level await, so the file is an ES module (hence the .mts extension).
 *
 * Usage:
 *   node new-packages.mts [compareRef]   # compareRef defaults to origin/main
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type ExistStatus = "exists" | "missing" | "unknown";

interface PackageJson {
  name?: string;
  version?: string;
  private?: boolean;
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(scriptDir, "..", "..");
const REGISTRY = "https://registry.npmjs.org";
const COMPARE_REF = process.argv[2] || process.env.BASE_REF || "origin/main";

// Record of package names already confirmed published to npm. Because npm
// publishes are immutable, these can never become unpublished, so we skip the
// registry existence check for them and only query the registry for the rest.
const RECORD_PATH = path.join(scriptDir, "published-packages.json");
const RECORD_DISPLAY = path.relative(root, RECORD_PATH);

/**
 * The fork point of the changeset-release/main branch: the merge-base of the
 * compare ref (main) and HEAD. Diffing against this isolates the branch's own
 * package.json updates even if main advances while the release PR is open.
 * Null when it cannot be resolved (e.g. missing git history); callers treat
 * that as a hard error rather than silently skipping the check.
 */
function getBaseRef(): string | null {
  try {
    return execFileSync("git", ["merge-base", COMPARE_REF, "HEAD"], {
      cwd: root,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

const BASE_REF = getBaseRef();

/**
 * Builds matchers from the changesets `ignore` globs (e.g. "@aws-smithy/*").
 * These packages are not versioned or published by the release workflow.
 */
function getIgnoreMatchers(): RegExp[] {
  const configPath = path.join(root, ".changeset", "config.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  const globs: string[] = Array.isArray(config.ignore) ? config.ignore : [];
  return globs.map((glob) => {
    const pattern = "^" + glob.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$";
    return new RegExp(pattern);
  });
}

const ignoreMatchers = getIgnoreMatchers();

/**
 * A package is publishable if it is not private and not excluded by the
 * changesets ignore globs.
 */
function isPublishable(pkgJson: PackageJson): boolean {
  return (
    Boolean(pkgJson.name) && pkgJson.private !== true && !ignoreMatchers.some((re) => re.test(pkgJson.name as string))
  );
}

/**
 * Reads a package.json version from the base ref via git, or null if the file
 * did not exist there (i.e. the package is newly added in this PR).
 */
function getBaseVersion(relPath: string): string | null {
  try {
    const contents = execFileSync("git", ["show", `${BASE_REF}:${relPath}`], {
      cwd: root,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return (JSON.parse(contents) as PackageJson).version ?? null;
  } catch {
    return null;
  }
}

/** Logs a clear failure message and exits non-zero. */
function fail(message: string): never {
  console.error(`❌ ${message}`);
  process.exit(1);
}

/**
 * Returns the publishable package names whose new versions this PR will publish:
 * those whose packages/<name>/package.json version differs from BASE_REF or is
 * newly added. Exits non-zero when the base ref or diff cannot be resolved,
 * since the set to publish cannot be determined and the check must not silently
 * pass.
 */
function getPackageNamesToPublish(): string[] {
  if (!BASE_REF) {
    fail(`Could not resolve the merge-base of ${COMPARE_REF} and HEAD; ensure full git history is available.`);
  }
  let changedFiles: string[];
  try {
    const out = execFileSync("git", ["diff", "--name-only", BASE_REF, "HEAD", "--", "packages/*/package.json"], {
      cwd: root,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    changedFiles = out.split("\n").filter(Boolean);
  } catch (e) {
    fail(`Could not diff packages against ${COMPARE_REF}: ${(e as Error).message}`);
  }

  const toPublish: string[] = [];
  for (const relPath of changedFiles) {
    const abs = path.join(root, relPath);
    if (!fs.existsSync(abs)) {
      continue; // package.json deleted in this PR.
    }
    const pkgJson = JSON.parse(fs.readFileSync(abs, "utf-8")) as PackageJson;
    if (!isPublishable(pkgJson)) {
      continue;
    }
    if (pkgJson.version !== getBaseVersion(relPath)) {
      toPublish.push(pkgJson.name as string);
    }
  }
  return toPublish;
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
 * Loads the set of package names already confirmed published (RECORD_PATH).
 * Returns an empty set if the record is absent or unreadable, in which case
 * every package is verified against the registry.
 */
function getConfirmedPublished(): Set<string> {
  try {
    const data = JSON.parse(fs.readFileSync(RECORD_PATH, "utf-8"));
    return new Set<string>(Array.isArray(data.packages) ? data.packages : []);
  } catch {
    return new Set<string>();
  }
}

const packages = getPackageNamesToPublish();

if (packages.length === 0) {
  fail(
    [
      `No publishable package version changes were found between ${COMPARE_REF} and HEAD.`,
      "",
      'This check is expected to run on the changesets "Version NPM packages"',
      "release PR, where at least one package.json version is bumped. An empty",
      "set to publish usually means it ran on the wrong ref or the branch is not",
      "a release branch. Failing to avoid silently skipping the new-package check.",
    ].join("\n")
  );
}

const confirmed = getConfirmedPublished();
const toVerify = packages.filter((name) => !confirmed.has(name));
const knownCount = packages.length - toVerify.length;

if (toVerify.length === 0) {
  console.log(
    `✅ All ${packages.length} package(s) to publish are recorded as published in ${RECORD_DISPLAY}; skipped npm registry checks.`
  );
  process.exit(0);
}

const results = await Promise.all(toVerify.map(async (name) => ({ name, status: await checkExists(name) })));

const missing = results.filter((r) => r.status === "missing").map((r) => r.name);
const unknown = results.filter((r) => r.status === "unknown").map((r) => r.name);

if (unknown.length) {
  console.warn(
    `⚠️  Could not verify ${unknown.length} package(s) against the registry (network/registry error):\n  ` +
      unknown.join("\n  ")
  );
}

if (missing.length) {
  fail(
    [
      `${missing.length} package(s) this PR will publish have never been published to npm:`,
      ...missing.map((n) => `  - ${n}`),
      "",
      "npm trusted publishing (OIDC) only works for packages that already",
      "exist on the registry, so the automated release workflow cannot",
      "publish these for the first time. A maintainer must, once per package:",
      "",
      "  1. Publish the first version manually with an npm account that has",
      "     publish access and 2FA enabled, e.g. from the package directory:",
      "       npm publish --access public",
      "  2. On npmjs.com, open the package's Settings and add this repository's",
      "     release-npm-packages.yml GitHub Actions workflow as a trusted publisher.",
      `  3. Add the package name to ${RECORD_DISPLAY} (sorted) so future runs`,
      "     skip its registry check; npm publishes are immutable.",
      "",
      "After that one-time setup, re-run this check. Every subsequent release",
      "will publish automatically via OIDC.",
      "",
      "Refer internal runbook for npm credentials.",
    ].join("\n")
  );
}

console.log(
  `✅ All ${packages.length} package(s) to publish exist on npm ` +
    `(${knownCount} from ${RECORD_DISPLAY}, ${toVerify.length} verified via registry).`
);
console.log(
  `ℹ️  Add the following to ${RECORD_DISPLAY} (sorted) to skip their registry check in future runs:\n  ` +
    toVerify.map((n) => `- ${n}`).join("\n  ")
);
