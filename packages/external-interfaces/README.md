# @smithy/external-interfaces

[![NPM version](https://img.shields.io/npm/v/@smithy/external-interfaces/latest.svg)](https://www.npmjs.com/package/@smithy/external-interfaces)
[![NPM downloads](https://img.shields.io/npm/dm/@smithy/external-interfaces.svg)](https://www.npmjs.com/package/@smithy/external-interfaces)

This package provides a control for external interfaces.
This package is installed to generated clients with the `^` version range, allowing updates
of this package to deploy patches of external packages without publishing incremental versions of those packages.

It is a hot patch-in-place mechanism. 