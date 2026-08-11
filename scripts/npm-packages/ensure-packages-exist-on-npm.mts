#!/usr/bin/env node

/**
 * Fails when a package this PR will publish does not yet exist on npm, or when
 * the version it supersedes was never published.
 *
 * npm trusted publishing (OIDC) can only be configured for a package that
 * already exists on the registry. A brand-new package name therefore cannot
 * be published by the automated OIDC release workflow: its first version must
 * be published manually, after which a maintainer configures this repository's
 * GitHub Actions workflow as a trusted publisher.
 *
 * The release workflow only publishes the new versions, so if a previous release
 * never reached the registry - its publish job failed, was cancelled, or only
 * got part of the way through - merging this PR strands the versions it bumps
 * past: they exist in git, in the changelogs and in the release tags, but never
 * on npm, and no later release will publish them.
 *
 * This check runs on the changesets "Version NPM packages" release PR, so
 * maintainers complete that one-time manual setup *before* the PR is merged
 * instead of discovering a confusing auth failure during release, and so an
 * incomplete release is caught while it can still be finished.
 *
 * The set of packages to publish is derived from the changeset-release/main
 * branch itself: `changeset version` commits a bump to the `version` field of
 * every package to be published. We therefore look at the package.json updates
 * the branch introduces relative to its fork point from main (the merge-base),
 * so a moving main tip while the PR is open does not affect the result. Any
 * package.json under a workspace root declared in the root package.json
 * (packages/*, private/*) whose version differs
 * from that fork point, or is newly added, will be published - excluding
 * private packages, which are never released. The version at that fork point is
 * the one being superseded; a package the branch adds supersedes nothing, so only
 * its name is checked.
 *
 * Each package costs one registry check: the version it supersedes, since a
 * published version implies a published name. Checks already answered by the
 * record (see shared.mts) are skipped; the rest are queried. Runs directly via
 * Node type stripping (Node >= 24, no build step).
 *
 * Usage:
 *   node ensure-packages-exist-on-npm.mts [compareRef]   # defaults to origin/main
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import {
  fail,
  formatPackageVersion,
  loadRecord,
  type PackageCheck,
  type PackageJson,
  partitionByExistence,
  readPublishablePackage,
  root,
  warnUnknown,
  WORKSPACE_ROOTS,
} from "./shared.mts";

/** A package this PR will publish, with the version it supersedes. */
interface PackageToPublish {
  name: string;
  /** The version at the fork point from main; null when the PR adds the package. */
  previousVersion: string | null;
}

const args = process.argv.slice(2);
for (const arg of args) {
  if (arg.startsWith("-")) {
    fail(`Unknown option ${arg}. Usage: node ensure-packages-exist-on-npm.mts [compareRef]`);
  }
}
const COMPARE_REF = args[0] || process.env.BASE_REF || "origin/main";

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

/**
 * Reads a package.json version from the base ref via git, or null if the file
 * did not exist there (i.e. the package is newly added in this PR).
 */
function getBaseVersion(baseRef: string, relPath: string): string | null {
  try {
    const contents = execFileSync("git", ["show", `${baseRef}:${relPath}`], {
      cwd: root,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return (JSON.parse(contents) as PackageJson).version ?? null;
  } catch {
    return null;
  }
}

/**
 * True for a workspace package manifest, i.e. <root>/<package>/package.json.
 * git pathspec wildcards also match across directory separators, so nested
 * manifests such as packages/core/scripts/baseline/package.json are matched by
 * the diff and filtered out here.
 */
function isWorkspaceManifest(relPath: string): boolean {
  const segments = relPath.split("/");
  return segments.length === 3 && WORKSPACE_ROOTS.includes(segments[0]);
}

/**
 * Returns the publishable packages whose new versions this PR will publish:
 * those whose <root>/<package>/package.json version differs from the fork point
 * or is newly added, each with the version it supersedes. Exits non-zero when
 * the base ref or diff cannot be resolved, since the set to publish cannot be
 * determined and the check must not silently pass.
 */
function getPackagesToPublish(): PackageToPublish[] {
  const baseRef = getBaseRef();
  if (!baseRef) {
    fail(`Could not resolve the merge-base of ${COMPARE_REF} and HEAD; ensure full git history is available.`);
  }
  const pathspecs = WORKSPACE_ROOTS.map((dir) => `${dir}/*/package.json`);
  let changedFiles: string[];
  try {
    const out = execFileSync("git", ["diff", "--name-only", baseRef, "HEAD", "--", ...pathspecs], {
      cwd: root,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    changedFiles = out.split("\n").filter(Boolean);
  } catch (e) {
    fail(`Could not diff packages against ${COMPARE_REF}: ${(e as Error).message}`);
  }

  const toPublish: PackageToPublish[] = [];
  for (const relPath of changedFiles) {
    if (!isWorkspaceManifest(relPath)) {
      continue;
    }
    const abs = path.join(root, relPath);
    if (!fs.existsSync(abs)) {
      continue; // package.json deleted in this PR.
    }
    const pkg = readPublishablePackage(abs);
    if (!pkg) {
      continue;
    }
    const previousVersion = getBaseVersion(baseRef, relPath);
    if (pkg.version !== previousVersion) {
      toPublish.push({ name: pkg.name, previousVersion });
    }
  }
  return toPublish;
}

const packages = getPackagesToPublish();

if (packages.length === 0) {
  fail(
    [
      `No publishable package version changes were found between ${COMPARE_REF} and HEAD.`,
      "",
      'This check is expected to run on the changesets "Version NPM packages"',
      "release PR, where at least one package.json version is bumped. An empty",
      "set to publish usually means it ran on the wrong ref or the branch is not",
      "a release branch. Failing to avoid silently skipping the checks below.",
    ].join("\n")
  );
}

const record = loadRecord();

// One check per package: the version it supersedes, or - for a package this PR
// adds, which supersedes nothing - its name alone. Verifying the superseded version
// covers the name too, since nothing can be published under a name the registry
// does not have. What the record already confirms needs no check at all.
const toVerify: PackageCheck[] = packages
  .map(({ name, previousVersion }) => ({ name, version: previousVersion }))
  .filter(({ name, version }) => (version === null ? !record.has(name) : record.get(name) !== version));

const { missingNames, missingVersions, unknown } = await partitionByExistence(toVerify);
warnUnknown(unknown.map(formatPackageVersion));

if (missingNames.length || missingVersions.length) {
  const report: string[] = [];
  if (missingNames.length) {
    report.push(
      `${missingNames.length} package(s) this PR will publish have never been published to npm:`,
      ...missingNames.map(({ name }) => `  - ${name}`),
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
      "",
      "After that one-time setup, re-run this check. Every subsequent release",
      "will publish automatically via OIDC.",
      "",
      "Refer internal runbook for npm credentials."
    );
  }
  if (missingVersions.length) {
    if (report.length) {
      report.push("", "");
    }
    report.push(
      `${missingVersions.length} version(s) this PR supersedes are not published on npm:`,
      ...missingVersions.map((v) => `  - ${formatPackageVersion(v)}`),
      "",
      "If the release that publishes them finished only minutes ago, they are",
      "most likely still going through npm's publish-time malware scan, which",
      "keeps a new version off the registry until it passes - usually for a few",
      "minutes, sometimes 15 or more. Re-run this check before anything else.",
      "",
      "Otherwise a previous release PR versioned these but the release that should",
      "have published them did not complete. Merging this PR bumps past them, and",
      "no later release will ever publish them. A maintainer must:",
      "",
      "  1. Open the most recent release-npm-packages.yml run and find out why",
      "     the publish did not finish.",
      "  2. Get the versions above onto npm, by re-running that workflow or by",
      "     publishing them manually from the release commit.",
      "  3. Re-run this check."
    );
  }
  fail(report.join("\n"));
}

const newPackages = packages.filter((pkg) => pkg.previousVersion === null).length;
console.log(
  `✅ All ${packages.length} package(s) to publish exist on npm, and the ${packages.length - newPackages} version(s) ` +
    `they supersede are published` +
    (newPackages ? ` (${newPackages} package(s) are new in this PR and supersede nothing)` : "") +
    `: ${packages.length - toVerify.length} check(s) from the cached record, ${toVerify.length} verified via registry.`
);
