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
 * This check runs on the changesets "Version NPM packages" release PR, so
 * maintainers complete that one-time manual setup *before* the PR is merged
 * instead of discovering a confusing auth failure during release.
 *
 * The set of packages to publish is derived from the changeset-release/main
 * branch itself: `changeset version` commits a bump to the `version` field of
 * every package to be published. We therefore look at the package.json updates
 * the branch introduces relative to its fork point from main (the merge-base),
 * so a moving main tip while the PR is open does not affect the result. Any
 * package.json under a workspace root declared in the root package.json
 * (packages/*, smithy-typescript-ssdk-libs/*, private/*) whose version differs
 * from that fork point, or is newly added, will be published - excluding
 * private packages, which are never released.
 *
 * Packages already recorded as published (see shared.mts) skip their registry
 * check; the rest are queried. Runs directly via Node type stripping
 * (Node >= 24, no build step).
 *
 * Usage:
 *   node ensure-packages-exist-on-npm.mts [compareRef]   # defaults to origin/main
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import {
  fail,
  isPublishable,
  loadRecord,
  type PackageJson,
  partitionByExistence,
  root,
  warnUnknown,
  WORKSPACE_ROOTS,
} from "./shared.mts";

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
 * Returns the publishable package names whose new versions this PR will publish:
 * those whose <root>/<package>/package.json version differs from the fork point
 * or is newly added. Exits non-zero when the base ref or diff cannot be
 * resolved, since the set to publish cannot be determined and the check must
 * not silently pass.
 */
function getPackageNamesToPublish(): string[] {
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

  const toPublish: string[] = [];
  for (const relPath of changedFiles) {
    if (!isWorkspaceManifest(relPath)) {
      continue;
    }
    const abs = path.join(root, relPath);
    if (!fs.existsSync(abs)) {
      continue; // package.json deleted in this PR.
    }
    const pkgJson = JSON.parse(fs.readFileSync(abs, "utf-8")) as PackageJson;
    if (!isPublishable(pkgJson)) {
      continue;
    }
    if (pkgJson.version !== getBaseVersion(baseRef, relPath)) {
      toPublish.push(pkgJson.name as string);
    }
  }
  return toPublish;
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

const confirmed = loadRecord();
const toVerify = packages.filter((name) => !confirmed.has(name));
const knownCount = packages.length - toVerify.length;

if (toVerify.length === 0) {
  console.log(
    `✅ All ${packages.length} package(s) to publish are recorded as published in the cached record; skipped npm registry checks.`
  );
  process.exit(0);
}

const { missing, unknown } = await partitionByExistence(toVerify);

warnUnknown(unknown);

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
    `(${knownCount} from the cached record, ${toVerify.length} verified via registry).`
);
