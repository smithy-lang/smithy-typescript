#!/usr/bin/env node

/**
 * Records which of this repository's publishable packages exist on npm.
 *
 * Runs on push to main so release PRs can skip the registry check for names
 * already known to exist (see ensure-packages-exist-on-npm.mts). The record is
 * carried between runs by the GitHub Actions cache; only pushes to main may
 * write to the cache scope that pull requests restore from, which is why the
 * refresh happens here and not on the release PR itself.
 *
 * Packages that have never been published are reported but never fail the run:
 * a package can legitimately sit on main unpublished until a maintainer does its
 * one-time manual first publish. Enforcing that is the release PR check's job.
 *
 * Runs directly via Node type stripping (Node >= 24, no build step).
 *
 * Usage:
 *   node refresh-npm-package-record.mts
 */

import {
  fail,
  getAllPublishablePackageNames,
  loadRecord,
  partitionByExistence,
  RECORD_DISPLAY,
  saveRecord,
  warnUnknown,
} from "./shared.mts";

if (process.argv.length > 2) {
  fail(`Unexpected argument ${process.argv[2]}. Usage: node refresh-npm-package-record.mts`);
}

const packages = getAllPublishablePackageNames();
const record = loadRecord();
// Only keep names still present in the repository, so the record stays a
// description of this repository rather than growing forever.
const confirmed = new Set(packages.filter((name) => record.has(name)));
const toVerify = packages.filter((name) => !confirmed.has(name));

if (toVerify.length === 0) {
  saveRecord(confirmed);
  console.log(`✅ All ${packages.length} publishable package(s) are already recorded as published on npm.`);
  process.exit(0);
}

const { exists, missing, unknown } = await partitionByExistence(toVerify);
for (const name of exists) {
  confirmed.add(name);
}
saveRecord(confirmed);

warnUnknown(unknown);
if (missing.length) {
  console.log(
    `ℹ️  ${missing.length} package(s) have never been published to npm and need a one-time manual first ` +
      `publish before a release can include them:\n  ` +
      missing.join("\n  ")
  );
}
console.log(
  `✅ Recorded ${confirmed.size} of ${packages.length} publishable package(s) as published on npm ` +
    `(${exists.length} newly verified via registry) in ${RECORD_DISPLAY}.`
);
