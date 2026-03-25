# @smithy/middleware-apply-body-checksum

[![NPM version](https://img.shields.io/npm/v/@smithy/middleware-apply-body-checksum/latest.svg)](https://www.npmjs.com/package/@smithy/middleware-apply-body-checksum)
[![NPM downloads](https://img.shields.io/npm/dm/@smithy/middleware-apply-body-checksum.svg)](https://www.npmjs.com/package/@smithy/middleware-apply-body-checksum)

### :warning: Internal API :warning:

> This is an internal package.
> That means this is used as a dependency for other, public packages, but
> should not be taken directly as a dependency in your application's `package.json`.

> If you are updating the version of this package, for example to bring in a
> bug-fix, you should do so by updating your application lockfile with
> e.g. `npm up @scope/package` or equivalent command in another
> package manager, rather than taking a direct dependency.

---

This package provides AWS SDK for JavaScript middleware that applies a checksum
of the request body as a header.
