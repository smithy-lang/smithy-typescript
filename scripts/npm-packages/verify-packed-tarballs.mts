#!/usr/bin/env node

/**
 * Verifies that the tarballs `changeset pack` produced are the tarballs we would
 * want published.
 *
 * `changeset pack` runs the workspace's pack tool - `yarn pack` here - once per
 * package the publish plan covers, so it fails on anything that would stop
 * `changeset publish` from getting a tarball onto the registry. What it does not
 * check is whether the tarball it produced has anything useful in it: `files` in
 * every package.json selects only the dist directories, and packing a tree that
 * was never built matches none of them, which yarn reports as success. The result
 * is a tarball holding only the manifest, LICENSE and README - a publish that
 * "succeeds" and ships a package that cannot be imported.
 *
 * So each tarball is checked to contain the entry points its own packed manifest
 * declares. main, module and types cover dist-cjs, dist-es and dist-types
 * respectively, which is every build output a release produces, so a tarball that
 * has all three is not an unbuilt one. The manifest is read back out of the
 * tarball rather than from the workspace, so what is verified is what a consumer
 * would install.
 *
 * The packed dependency ranges are checked for the same reason. Internal
 * dependencies are declared as `workspace:^`, a protocol only the pack tool
 * resolves; one that reached the registry unresolved would be unresolvable to
 * everyone installing the package.
 *
 * The `browser`, `react-native` and `exports` maps are deliberately left alone.
 * They are condition tables over the same three directories, some of their paths
 * are extensionless, and their contents are already validated at build time by
 * scripts/validation (submodules-linter, esm-compat); re-resolving them here would
 * add Node resolution semantics to this script for no coverage it does not
 * already have.
 *
 * Runs directly via Node type stripping (Node >= 24, no build step).
 *
 * Usage:
 *   node verify-packed-tarballs.mts <packDir>
 *
 * where <packDir> is the --out-dir given to `changeset pack`.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { fail } from "./shared.mts";

/** The shape `changeset pack` writes; only the fields used here are described. */
interface PackedRelease {
  kind: "publish" | "tag-only";
  name: string;
  version: string;
  /** Present on publish releases once packed, relative to the pack directory. */
  tarball?: { path: string; integrity: string };
}

interface PackedPlan {
  version: number;
  plan: PackedRelease[][];
}

/**
 * Manifest fields pointing at a single built file, paired with the directory each
 * one proves made it into the tarball. Every publishable package declares all
 * three; a manifest missing one is reported rather than skipped, since that is
 * itself a packaging problem.
 */
const REQUIRED_ENTRY_POINTS = [
  { field: "main", proves: "dist-cjs" },
  { field: "module", proves: "dist-es" },
  { field: "types", proves: "dist-types" },
] as const;

/** Manifest fields whose ranges an installing consumer has to be able to resolve. */
const DEPENDENCY_FIELDS = ["dependencies", "peerDependencies", "optionalDependencies"] as const;

const packDirArg = process.argv[2];
if (!packDirArg || process.argv.length > 3) {
  fail("Usage: node verify-packed-tarballs.mts <packDir>");
}

const packDir = path.resolve(packDirArg);
const planPath = path.join(packDir, "publish-plan.json");
if (!fs.existsSync(planPath)) {
  fail(`No publish plan at ${planPath}. Run \`changeset pack --out-dir ${packDirArg}\` first.`);
}

const { plan } = JSON.parse(fs.readFileSync(planPath, "utf-8")) as PackedPlan;
const releases = plan.flat().filter((release) => release.kind === "publish");

if (releases.length === 0) {
  // A release PR always has packages to publish, so an empty plan means the pack
  // ran against the wrong tree - not that there is nothing to verify.
  fail(`${planPath} covers no packages to publish.`);
}

/** Paths inside a tarball, with npm's leading "package/" component removed. */
function listTarballContents(tarballPath: string): Set<string> {
  const stdout = execFileSync("tar", ["-tzf", tarballPath], { encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 });
  return new Set(
    stdout
      .split("\n")
      .filter(Boolean)
      .map((entry) => entry.replace(/^\.?\/?package\//, "").replace(/\/$/, ""))
  );
}

/** The packed manifest, which is what an installing consumer actually reads. */
function readPackedManifest(tarballPath: string): Record<string, unknown> {
  const stdout = execFileSync("tar", ["-xzOf", tarballPath, "package/package.json"], {
    encoding: "utf-8",
    maxBuffer: 8 * 1024 * 1024,
  });
  return JSON.parse(stdout) as Record<string, unknown>;
}

const errors: string[] = [];
const verified: string[] = [];

for (const release of releases) {
  const label = `${release.name}@${release.version}`;
  const errorsBefore = errors.length;

  if (!release.tarball) {
    errors.push(`${label}: the publish plan has no tarball for it, so \`changeset pack\` did not pack it.`);
    continue;
  }

  const tarballPath = path.join(packDir, release.tarball.path);
  if (!fs.existsSync(tarballPath)) {
    errors.push(`${label}: the publish plan points at ${release.tarball.path}, which does not exist.`);
    continue;
  }

  let contents: Set<string>;
  let manifest: Record<string, unknown>;
  try {
    contents = listTarballContents(tarballPath);
    manifest = readPackedManifest(tarballPath);
  } catch (error) {
    errors.push(`${label}: could not read ${release.tarball.path}: ${(error as Error).message}`);
    continue;
  }

  // The version is what the tag and the registry entry are keyed on, so a
  // mismatch here means the plan and the tarball disagree about what is released.
  if (manifest.version !== release.version) {
    errors.push(`${label}: the packed manifest declares version ${String(manifest.version)}.`);
  }

  // Every internal dependency in this repository is declared as `workspace:^`,
  // which only the pack tool resolves to a real range. One left unresolved in a
  // published manifest is unresolvable to anyone installing it, so it is worth
  // confirming the rewrite happened rather than assuming it.
  for (const field of DEPENDENCY_FIELDS) {
    const deps = manifest[field];
    if (typeof deps !== "object" || deps === null) {
      continue;
    }
    for (const [dependency, range] of Object.entries(deps as Record<string, unknown>)) {
      if (typeof range === "string" && range.startsWith("workspace:")) {
        errors.push(`${label}: "${field}"."${dependency}" is still ${range} in the packed manifest.`);
      }
    }
  }

  for (const { field, proves } of REQUIRED_ENTRY_POINTS) {
    const declared = manifest[field];
    if (typeof declared !== "string") {
      errors.push(`${label}: the packed manifest declares no "${field}", so its ${proves} output is unverifiable.`);
      continue;
    }
    const entry = declared.replace(/^\.\//, "");
    if (!contents.has(entry)) {
      errors.push(`${label}: "${field}" is ${declared} but ${entry} is not in ${release.tarball.path}.`);
    }
  }

  if (errors.length === errorsBefore) {
    verified.push(label);
  }
}

if (errors.length) {
  fail(
    `${errors.length} problem(s) with the packed tarballs in ${packDir}. A release from this commit would publish ` +
      `packages that consumers cannot use:\n  ${errors.join("\n  ")}`
  );
}

console.log(
  `✅ All ${verified.length} packed tarball(s) carry the entry points their manifests declare, at the version the ` +
    `plan releases, with every dependency range resolved:\n  ` +
    verified.join("\n  ")
);
