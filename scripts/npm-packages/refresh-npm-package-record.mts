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
 * Publishing does not make a version available immediately - npm scans it for
 * malware first, which usually takes a few minutes - so this run starts inside
 * the window where the versions it is about to record still read as absent.
 * Anything the registry does not have yet is therefore re-checked until it
 * appears, or until the wait budget in shared.mts runs out. Without that wait a
 * release would record none of what it just published and every check on the next
 * release PR would fall back to the registry.
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
  partitionByExistenceWaitingForPublish,
  type PackageVersion,
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

// The full list of what is still pending is worth seeing once; after that only
// how many, so a long wait does not bury the rest of the log.
let listPending = true;
const reportWait = (pending: PackageVersion[], waitMs: number) => {
  console.log(
    `⏳ ${pending.length} version(s) are not on the registry yet, which is expected for a few minutes after a ` +
      `publish while npm scans it; re-checking in ${Math.round(waitMs / 1000)}s` +
      (listPending ? `:\n  ${pending.map(formatPackageVersion).join("\n  ")}` : ".")
  );
  listPending = false;
};

const { exists, missingNames, missingVersions, unknown } = await partitionByExistenceWaitingForPublish(
  toVerify,
  reportWait
);
// Why a version is absent does not matter here: either way it is left unrecorded.
const missing = [...missingNames, ...missingVersions];
for (const { name, version } of exists) {
  // The newest confirmed version replaces the previous one, since it is the
  // version a release PR forked from main will look up.
  confirmed.set(name, version);
}
saveRecord(confirmed);
warnUnknown(unknown.map(formatPackageVersion));

if (missing.length) {
  console.log(
    `ℹ️  ${missing.length} version(s) on main are not on npm: the release publishing them did not finish, the ` +
      `package has never been published at all, or npm's publish-time scan is holding the version back for longer ` +
      `than this run waited for:\n  ` +
      missing.map(formatPackageVersion).join("\n  ")
  );
}
console.log(
  `✅ Recorded ${confirmed.size} of ${packages.length} publishable package(s) as published on npm ` +
    `(${exists.length} newly verified via registry) in ${RECORD_DISPLAY}.`
);
