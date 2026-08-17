# @smithy/dynamic-client

[![NPM version](https://img.shields.io/npm/v/@smithy/dynamic-client/latest.svg)](https://www.npmjs.com/package/@smithy/dynamic-client)
[![NPM downloads](https://img.shields.io/npm/dm/@smithy/dynamic-client.svg)](https://www.npmjs.com/package/@smithy/dynamic-client)

A runtime factory that converts a [Smithy JSON AST](https://smithy.io/2.0/spec/json-ast.html)
into a schema-based client, without code generation.

The returned object mirrors the symbol export surface of a code-generated
schema-based client (types excepted): the client class, one `<Op>Command`
constructor per operation, and one `<Shape>$` static schema per named shape.

## Usage

```javascript
import { createDynamicClient } from "@smithy/dynamic-client";
import { SmithyRpcV2CborProtocol } from "@smithy/core/cbor";

// `ast` is a parsed Smithy JSON AST object.
const { WeatherClient, GetForecastCommand } = createDynamicClient(ast, [SmithyRpcV2CborProtocol]);

const client = new WeatherClient({ endpoint: "https://example.com" });
const response = await client.send(new GetForecastCommand({ city: "Seattle" }));
```

The client is also aggregated: lowercased operation methods (e.g.
`client.getForecast(input)`) are available on the client instance.

## Runtime typechecking

Because this factory produces no compile-time types, it installs the
`@smithy/typecheck` runtime typecheck (RTTC) middleware automatically to
validate request inputs and response outputs against the schemas. By default,
mismatches are logged as warnings. Configure or disable it with the third
argument:

```javascript
// Throw on input mismatches; log output mismatches as errors.
createDynamicClient(ast, [SmithyRpcV2CborProtocol], { input: "throw", output: "error" });

// Disable entirely.
createDynamicClient(ast, [SmithyRpcV2CborProtocol], { input: false, output: false });
```

## Protocol scope

This package only knows about client protocols implemented in this repository
(currently RPCv2 CBOR). A higher-level factory (e.g. for the AWS SDK) can wrap
`createDynamicClient` and pass a larger `protocols` array.
