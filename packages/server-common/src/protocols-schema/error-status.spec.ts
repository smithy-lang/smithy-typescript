import { TypeRegistry } from "@smithy/core/schema";
import type { StaticErrorSchema, StaticOperationSchema } from "@smithy/types";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ServiceException } from "../validation/errors";
import { resolveErrorStatusCode } from "./error-status";
import { AwsJsonRpcServerProtocol } from "./layer-2-protocols/AwsJsonRpcServerProtocol";
import { AwsRestJsonServerProtocol } from "./layer-2-protocols/AwsRestJsonServerProtocol";
import { SmithyRpcV2CborServerProtocol } from "./layer-2-protocols/SmithyRpcV2CborServerProtocol";

const errorNamespace = "smithy.test.errorStatus";
const errorSchema = [
  -3,
  errorNamespace,
  "ModeledThrottlingError",
  { error: "client", httpError: 429 },
  [],
  [],
] satisfies StaticErrorSchema;
const operationSchema = [9, errorNamespace, "TestOperation", 0, "unit", "unit"] satisfies StaticOperationSchema;

class ModeledThrottlingError extends ServiceException {
  public constructor() {
    super({
      name: "ModeledThrottlingError",
      $fault: "client",
      message: "slow down",
    });
    Object.setPrototypeOf(this, ModeledThrottlingError.prototype);
  }
}

const makeContext = () => ({
  streamCollector: async (stream: unknown) => (stream instanceof Uint8Array ? stream : new Uint8Array(0)),
});

describe("resolveErrorStatusCode", () => {
  const registry = TypeRegistry.for(errorNamespace);

  beforeEach(() => {
    registry.clear();
    registry.registerError(errorSchema, ModeledThrottlingError);
  });

  afterEach(() => {
    registry.clear();
  });

  it("uses the modeled httpError trait", () => {
    expect(resolveErrorStatusCode(new ModeledThrottlingError())).toBe(429);
  });

  it("prefers explicit response metadata", () => {
    const error = Object.assign(new ModeledThrottlingError(), {
      $metadata: { httpStatusCode: 418 },
      statusCode: 409,
    });

    expect(resolveErrorStatusCode(error)).toBe(418);
  });

  it("prefers an explicit status code over the model", () => {
    const error = Object.assign(new ModeledThrottlingError(), {
      statusCode: 409,
    });

    expect(resolveErrorStatusCode(error)).toBe(409);
  });

  it("uses Smithy fault defaults for unregistered errors", () => {
    expect(resolveErrorStatusCode({ $fault: "client" })).toBe(400);
    expect(resolveErrorStatusCode({ $fault: "server" })).toBe(500);
  });

  it.each([
    {
      name: "RPCv2 CBOR",
      createProtocol: () =>
        new SmithyRpcV2CborServerProtocol({
          defaultNamespace: errorNamespace,
        }),
    },
    {
      name: "AWS JSON 1.0",
      createProtocol: () =>
        new AwsJsonRpcServerProtocol({
          defaultNamespace: errorNamespace,
        }),
    },
    {
      name: "restJson1",
      createProtocol: () =>
        new AwsRestJsonServerProtocol({
          defaultNamespace: errorNamespace,
        }),
    },
  ])("uses modeled status codes with $name", async ({ createProtocol }) => {
    const protocol = createProtocol();
    const context = makeContext();
    protocol.setSerdeContext(context);

    const response = await protocol.serializeResponse(operationSchema, context, new ModeledThrottlingError());

    expect(response.statusCode).toBe(429);
  });
});
