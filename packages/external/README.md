# @smithy/external

[![NPM version](https://img.shields.io/npm/v/@smithy/external/latest.svg)](https://www.npmjs.com/package/@smithy/external)
[![NPM downloads](https://img.shields.io/npm/dm/@smithy/external.svg)](https://www.npmjs.com/package/@smithy/external)

This is an _internal_ package used by other `@smithy/...` packages.

It acts as a centralized importer and re-exporter for external packages.
It applies build transforms on those packages as needed on a case-by-case basis.

You should _not_ use this package directly in your application code.
