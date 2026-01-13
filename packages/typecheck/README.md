# @smithy/typecheck

[![NPM version](https://img.shields.io/npm/v/@smithy/typecheck/latest.svg)](https://www.npmjs.com/package/@smithy/typecheck)
[![NPM downloads](https://img.shields.io/npm/dm/@smithy/typecheck.svg)](https://www.npmjs.com/package/@smithy/typecheck)

This package contains optional functions for runtime typechecking.

## Prerequisites

This package requires Smithy-TypeScript client SDKs generated with v0.41.1 or greater.

For AWS SDK for JavaScript v3 clients (`@aws-sdk/client-*`),
this means [v3.953.0](https://github.com/aws/aws-sdk-js-v3/releases/tag/v3.953.0)
or higher is required.

If you attach the plugin to an unsupported client, an error will be thrown on any request made
with the client:

```shell
Error: @smithy/typecheck::rttcMiddleware - unsupported client version.
```

## Use with caution

Runtime typechecking has two disadvantages you should accept before use:

- client-side typechecks are not as accurate as allowing the server to validate and potentially reject your request. The
  older a client is, the more likely that the server implementation may have changed in comparison to the types shipped
  with that client.
- additional CPU time and memory will be used on executing the typechecks.

## When to use runtime typechecks

For example, if you are developing a script against a service,
enabling the runtime typechecking plugin can assist in the placement
of input parameters by providing a faster feedback loop than making requests
against the service.

It can also be potentially useful when accepting an input from another source.

## Runtime Typecheck - Client Plugin Usage

```ts
// example: attaching the runtime typechecker.
import { XYZClient, XYZCommand } from "xyz";
import { getRuntimeTypecheckPlugin } from "@smithy/typecheck";

const client = new XYZClient({});

client.middlewareStack.use(
  getRuntimeTypecheckPlugin({
    logger: console,
    // use false or a string corresponding to a log level,
    // (trace, debug, info, warn, error)
    // or "throw" to have an error be thrown.
    input: "warn",
    // use false or a log level string.
    output: false,
  })
);

await client.send(new XYZCommand());
```

In this example, the runtime typechecker plugin will now emit all type validation errors
as warnings to the logger implementation.

### Example log output

```
RpcV2ProtocolClient->RecursiveShapesCommand input validation:
  {}.nested.foo: expected string, got number.
  {}.nested.nested.bar: expected string, got number.
  {}.nested.nested.recursiveMember.nested: unmatched keys: foo, extra1.
  {}.nested.nested.recursiveMember.nested.bar: expected string, got number.
```

The `{}` indicates the root object, and each error line logs
the path to the field in question and reason for the validation error.

## Runtime Typecheck - Standalone Object Validation

See also [documentation on schemas](https://github.com/aws/aws-sdk-js-v3/blob/main/supplemental-docs/SCHEMAS.md).

As of the prerequisite versions mentioned above, client packages
export schema definitions for all structural shapes used by
the client, derived from the Smithy service model.

These schemas can be used to validate the shape of an input object.

```ts
// example: validating a schema and object pair.
import { validateSchema } from "@smithy/typecheck";

import { MyStruct$ } from "my-smithy-client-package";

const errors: string[] = validateSchema(
  // schema from generated client package.
  MyStruct$,
  // user-defined object.
  {
    x: 0,
    y: 1,
  }
);
```

```ts
// example: bound validator
const myStructValidator = validateSchema.bind(null, MyStruct$);

const errors: string[] = myStructValidator({ x: 0, y: 1 });
```

The returned errors array will be the same statements as those appearing in the
client plugin example above.
