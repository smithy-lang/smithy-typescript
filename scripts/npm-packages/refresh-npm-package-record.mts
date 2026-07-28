#!/usr/bin/env node

/**
 * Records which of this repository's publishable packages, and which of their
 * versions, exist on npm.
 *
 * Runs once a release has finished publishing, so release PRs can skip the
 * registry check for names and versions already known to exist (see
 * ensure-packages-exist-on-npm.mts). The version recorded for a package is the
 * one on main, which is the version the next release PR supersedes. The record is
 * carried between runs by the GitHub Actions cache; only trusted triggers may
 * write to the cache scope that pull requests restore from, which is why the
 * refresh happens here and not on the release PR itself.
 *
 * Versions that are not on npm are reported but never fail the run: a package can
 * legitimately sit on main unpublished until a maintainer does its one-time manual
 * first publish, and a release may have published only some of what it versioned.
 * Enforcing that is the release PR check's job; anything not confirmed is simply
 * left unrecorded and verified against the registry when it matters.
 *
 * Runs directly via Node type stripping (Node >= 24, no build step).
 *
 * Usage:
 *   node refresh-npm-package-record.mts
 */

import {
  fail,
  formatPackageVersion,
  getAllPublishablePackages,
  loadRecord,
  partitionVersionsByExistence,
  type PublishedRecord,
  RECORD_DISPLAY,
  saveRecord,
  warnUnknown,
} from "./shared.mts";

if (process.argv.length > 2) {
  fail(`Unexpected argument ${process.argv[2]}. Usage: node refresh-npm-package-record.mts`);
}

const packages = getAllPublishablePackages();
const record = loadRecord();
// Only keep packages still present in the repository, so the record stays a
// description of this repository rather than growing forever.
const confirmed: PublishedRecord = new Map(
  packages.filter((pkg) => record.has(pkg.name)).map((pkg) => [pkg.name, record.get(pkg.name) as string])
);
const toVerify = packages.filter((pkg) => confirmed.get(pkg.name) !== pkg.version);

if (toVerify.length === 0) {
  saveRecord(confirmed);
  console.log(
    `✅ All ${packages.length} publishable package(s) are already recorded as published on npm at their current version.`
  );
  process.exit(0);
}

const { exists, missing, unknown } = await partitionVersionsByExistence(toVerify);
for (const { name, version } of exists) {
  // The newest confirmed version replaces the previous one, since it is the
  // version a release PR forked from main will look up.
  confirmed.set(name, version);
}
saveRecord(confirmed);
warnUnknown(unknown.map(formatPackageVersion));

if (missing.length) {
  console.log(
    `ℹ️  ${missing.length} version(s) on main are not on npm, either because the release publishing them has ` +
      `not finished or because the package has never been published at all:\n  ` +
      missing.map(formatPackageVersion).join("\n  ")
  );
}
console.log(
  `✅ Recorded ${confirmed.size} of ${packages.length} publishable package(s) as published on npm ` +
    `(${exists.length} newly verified via registry) in ${RECORD_DISPLAY}.`
);
