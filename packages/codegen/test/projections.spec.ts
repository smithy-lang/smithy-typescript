import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

import { runProjection } from "../scripts/lib/run-projection";

/**
 * The JSON AST sorts operation errors, so the IDL declaration order used by the Java output is not recoverable.
 */
const KNOWN_DIFFERENCES: Record<string, string[]> = {
  "my-local-model-schema": ["src/commands/GetNumbersCommand.ts"],
  "my-local-model-schema-json": ["src/commands/GetNumbersCommand.ts"],
  "smithy-rpcv2-cbor-schema": ["src/commands/GreetingWithErrorsCommand.ts", "test/functional/rpcv2cbor.spec.ts"],
  "smithy-rpcv2-json-schema": ["src/commands/GreetingWithErrorsCommand.ts", "test/functional/rpcv2json.spec.ts"],
};

describe.each(Object.keys(KNOWN_DIFFERENCES))("%s", (projection) => {
  test("matches the Java codegen output", async () => {
    const { summary } = await runProjection(projection, resolve(__dirname, "fixtures", projection));
    expect({ different: summary.different, missing: summary.missing, extra: summary.extra }).toEqual({
      different: KNOWN_DIFFERENCES[projection],
      missing: [],
      extra: [],
    });
  });
});
