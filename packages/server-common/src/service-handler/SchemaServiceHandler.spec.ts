import { HttpRequest, HttpResponse } from "@smithy/core/protocols";
import type { MetricsRecorder, RequestOutcome, StaticOperationSchema } from "@smithy/types";
import { describe, expect, it, vi } from "vitest";

import type { Caller, RequestIdentity } from "../identity";
import type { ServerInterceptor } from "../interceptors/types";
import { SmithyRpcV2CborServerProtocol } from "../protocols-schema/layer-2-protocols/SmithyRpcV2CborServerProtocol";
import { ServiceException } from "../validation/errors";
import { SchemaServiceHandler } from "./SchemaServiceHandler";
import type { ServerOperationContext, ServerRequest } from "./types";

type TestIdentity = RequestIdentity;

type RecorderEvent =
  | { type: "begin" }
  | { type: "end" }
  | { type: "outcome"; outcome: RequestOutcome }
  | { type: "count"; name: string; value: number }
  | { type: "time"; name: string }
  | { type: "property"; name: string; value: string | null | undefined };

class TestRecorder implements MetricsRecorder<"native"> {
  public readonly events: RecorderEvent[] = [];

  public begin(): void {
    this.events.push({ type: "begin" });
  }

  public end(): void {
    this.events.push({ type: "end" });
  }

  public recordRequestOutcome(outcome: RequestOutcome): void {
    this.events.push({ type: "outcome", outcome });
  }

  public addCount(name: string, value: number): void {
    this.events.push({ type: "count", name, value });
  }

  public addTime(name: string): void {
    this.events.push({ type: "time", name });
  }

  public addLevel(): void {}
  public addMetric(): void {}
  public addRatio(): void {}

  public setProperty(name: string, value: string | null | undefined): void {
    this.events.push({ type: "property", name, value });
  }

  public getMetrics(): "native" {
    return "native";
  }
}

function makeOperationSchema(name: string): StaticOperationSchema {
  return [9, "test.ns", name, 0, "unit", "unit"];
}

function makeHttpRequest(operationName = "TestOperation"): HttpRequest {
  return new HttpRequest({
    method: "POST",
    path: `/service/test.ns%23TestService/operation/${operationName}`,
    headers: {
      "content-type": "application/cbor",
      "smithy-protocol": "rpc-v2-cbor",
      accept: "application/cbor",
    },
    body: new Uint8Array(0),
  });
}

function makeServerRequest(request = makeHttpRequest()): ServerRequest<TestIdentity> {
  return {
    request,
    identity: {},
    userAttributes: new Map(),
  };
}

function makeHandler(
  overrides: Partial<ConstructorParameters<typeof SchemaServiceHandler<TestIdentity, "native">>[0]> = {}
): SchemaServiceHandler<TestIdentity, "native"> {
  return new SchemaServiceHandler<TestIdentity, "native">({
    protocols: [new SmithyRpcV2CborServerProtocol({ defaultNamespace: "test.ns" })],
    operationSchemas: [makeOperationSchema("TestOperation")],
    handlers: {
      TestOperation: async () => ({}),
    },
    ...overrides,
  });
}

function countValue(recorder: TestRecorder, name: string): number | undefined {
  return recorder.events.find(
    (event): event is Extract<RecorderEvent, { type: "count" }> => event.type === "count" && event.name === name
  )?.value;
}

describe("SchemaServiceHandler", () => {
  describe("construction", () => {
    it("requires a protocol", () => {
      expect(
        () =>
          new SchemaServiceHandler({
            protocols: [],
            operationSchemas: [makeOperationSchema("TestOperation")],
            handlers: { TestOperation: async () => ({}) },
          })
      ).toThrow(/at least one protocol/);
    });

    it("rejects duplicate protocol IDs", () => {
      expect(
        () =>
          new SchemaServiceHandler({
            protocols: [
              new SmithyRpcV2CborServerProtocol({
                defaultNamespace: "test.ns",
              }),
              new SmithyRpcV2CborServerProtocol({
                defaultNamespace: "test.ns",
              }),
            ],
            operationSchemas: [makeOperationSchema("TestOperation")],
            handlers: { TestOperation: async () => ({}) },
          })
      ).toThrow(/duplicate protocol IDs.*smithy\.protocols#rpcv2Cbor/);
    });

    it("requires exactly one handler for every operation schema", () => {
      expect(
        () =>
          new SchemaServiceHandler({
            protocols: [
              new SmithyRpcV2CborServerProtocol({
                defaultNamespace: "test.ns",
              }),
            ],
            operationSchemas: [makeOperationSchema("First"), makeOperationSchema("Second")],
            handlers: { First: async () => ({}) },
          })
      ).toThrow(/missing handlers.*Second/);

      expect(
        () =>
          new SchemaServiceHandler({
            protocols: [
              new SmithyRpcV2CborServerProtocol({
                defaultNamespace: "test.ns",
              }),
            ],
            operationSchemas: [makeOperationSchema("First")],
            handlers: {
              First: async () => ({}),
              Extra: async () => ({}),
            },
          })
      ).toThrow(/no corresponding operation schema.*Extra/);
    });
  });

  it("passes the generated operation definition and framework request context", async () => {
    let captured: ServerOperationContext<TestIdentity, "native"> | undefined;
    const operationDefinition = makeOperationSchema("TestOperation");
    const recorder = new TestRecorder();
    const handler = makeHandler({
      operationSchemas: [operationDefinition],
      metricsRecorderFactory: { create: () => recorder },
      handlers: {
        TestOperation: async (_input, context) => {
          captured = context;
          return {};
        },
      },
    });

    await handler.handle(makeServerRequest());

    expect(captured?.operation).toBe("TestOperation");
    expect(captured?.operationDefinition).toBe(operationDefinition);
    expect(captured?.request.request.method).toBe("POST");
    expect(captured?.identity).toEqual({});
    expect(captured?.metricsRecorder).toBe(recorder);
  });

  it("snapshots user attributes once and exposes the same read-only view everywhere", async () => {
    const serverRequest = makeServerRequest();
    serverRequest.userAttributes.set("customId", "initial");
    const seen: ReadonlyMap<string | symbol, unknown>[] = [];
    const handler = makeHandler({
      interceptors: [
        {
          readBeforeExecution(hook) {
            seen.push(hook.userAttributes);
            serverRequest.userAttributes.set("customId", "changed-after-snapshot");
          },
          readBeforeInvocation(hook) {
            seen.push(hook.userAttributes);
          },
        },
      ],
      handlers: {
        TestOperation: async (_input, context) => {
          seen.push(context.userAttributes);
          expect(context.userAttributes.get("customId")).toBe("initial");
          expect((context.userAttributes as any).set).toBeUndefined();
          return {};
        },
      },
    });

    await handler.handle(serverRequest);

    expect(seen).toHaveLength(3);
    expect(seen.every((attributes) => attributes === seen[0])).toBe(true);
    expect(serverRequest.userAttributes.get("customId")).toBe("changed-after-snapshot");
  });

  it("claims the framework request, then routes and deserializes the replacement", async () => {
    const frameworkRequest = makeHttpRequest("UnknownOperation");
    const replacementRequest = makeHttpRequest();
    replacementRequest.headers["x-replacement"] = "true";
    const protocol = new SmithyRpcV2CborServerProtocol({
      defaultNamespace: "test.ns",
    });
    const claim = vi.spyOn(protocol, "claim");
    const route = vi.spyOn(protocol, "route");
    const deserializeRequest = vi.spyOn(protocol, "deserializeRequest");
    let hookRequest: Readonly<HttpRequest> | undefined;
    let operationRequest: Readonly<HttpRequest> | undefined;
    const handler = makeHandler({
      protocols: [protocol],
      interceptors: [
        {
          modifyBeforeDeserialization() {
            return replacementRequest;
          },
          readAfterDeserialization(hook) {
            hookRequest = hook.request;
          },
        },
      ],
      handlers: {
        TestOperation: async (_input, context) => {
          operationRequest = context.request.request;
          return {};
        },
      },
    });

    await handler.handle(makeServerRequest(frameworkRequest));

    expect(claim).toHaveBeenCalledTimes(1);
    expect(claim.mock.calls[0][0]).toBe(frameworkRequest);
    expect(route).toHaveBeenCalledTimes(1);
    expect(route.mock.calls[0][0]).toBe(replacementRequest);
    expect(deserializeRequest).toHaveBeenCalledTimes(1);
    expect(deserializeRequest.mock.calls[0][2]).toBe(replacementRequest);
    expect(hookRequest).toBe(frameworkRequest);
    expect(operationRequest).toBe(frameworkRequest);
  });

  it("claims the protocol first, then follows the traditional auth, modification, and routing order", async () => {
    const calls: string[] = [];
    const protocol = new SmithyRpcV2CborServerProtocol({
      defaultNamespace: "test.ns",
    });
    const originalClaim = protocol.claim.bind(protocol);
    vi.spyOn(protocol, "claim").mockImplementation((request, logger) => {
      calls.push("claim");
      return originalClaim(request, logger);
    });
    const originalRoute = protocol.route.bind(protocol);
    vi.spyOn(protocol, "route").mockImplementation((request, operationSchemas, logger) => {
      calls.push("route");
      return originalRoute(request, operationSchemas, logger);
    });
    const handler = makeHandler({
      protocols: [protocol],
      metricsRecorderFactory: {
        create() {
          calls.push("recorder");
          return new TestRecorder();
        },
      },
      interceptors: [
        {
          readBeforeExecution() {
            calls.push("readBeforeExecution");
          },
          modifyBeforeDeserialization(hook) {
            calls.push("modifyBeforeDeserialization");
            return hook.request as HttpRequest;
          },
        },
      ],
      authSchemes: [
        {
          name: "auth",
          authenticate: async () => {
            calls.push("authenticate");
            return { principal: "user" };
          },
        },
      ],
    });

    await handler.handle(makeServerRequest());

    expect(calls.slice(0, 6)).toEqual([
      "claim",
      "recorder",
      "readBeforeExecution",
      "authenticate",
      "modifyBeforeDeserialization",
      "route",
    ]);
  });

  it("does not start hooks or authentication when no protocol claims the request", async () => {
    const protocol = new SmithyRpcV2CborServerProtocol({
      defaultNamespace: "test.ns",
    });
    vi.spyOn(protocol, "claim").mockReturnValue(false);
    const createRecorder = vi.fn(() => new TestRecorder());
    const readBeforeExecution = vi.fn();
    const authenticate = vi.fn(async () => ({ principal: "user" }));
    const handler = makeHandler({
      protocols: [protocol],
      metricsRecorderFactory: { create: createRecorder },
      interceptors: [{ readBeforeExecution }],
      authSchemes: [{ name: "auth", authenticate }],
    });

    const response = await handler.handle(makeServerRequest());

    expect(response.statusCode).toBe(400);
    expect(createRecorder).not.toHaveBeenCalled();
    expect(readBeforeExecution).not.toHaveBeenCalled();
    expect(authenticate).not.toHaveBeenCalled();
  });

  it("adds the authenticated caller to a new read-only identity after readBeforeExecution", async () => {
    let beforeIdentity: Readonly<TestIdentity> | undefined;
    let authenticatedIdentity: Readonly<TestIdentity> | undefined;
    let operationIdentity: Readonly<TestIdentity> | undefined;
    const authenticate = vi.fn(
      async (_request: Readonly<HttpRequest>, identity: Readonly<TestIdentity>): Promise<Caller> => {
        expect(identity).toEqual({});
        expect(Object.isFrozen(identity)).toBe(true);
        return { principal: "user-1" };
      }
    );
    const handler = makeHandler({
      authSchemes: [{ name: "test", authenticate }],
      interceptors: [
        {
          readBeforeExecution(hook) {
            beforeIdentity = hook.identity;
          },
          readAfterAuthentication(hook) {
            authenticatedIdentity = hook.identity;
            expect(hook.caller).toEqual({ principal: "user-1" });
          },
        },
      ],
      handlers: {
        TestOperation: async (_input, context) => {
          operationIdentity = context.identity;
          return {};
        },
      },
    });

    await handler.handle(makeServerRequest());

    expect(beforeIdentity).toEqual({});
    expect(authenticatedIdentity).toEqual({
      caller: { principal: "user-1" },
    });
    expect(operationIdentity).toBe(authenticatedIdentity);
    expect(beforeIdentity).not.toBe(authenticatedIdentity);
    expect(Object.isFrozen(authenticatedIdentity)).toBe(true);
    expect(Object.isFrozen(authenticatedIdentity?.caller)).toBe(true);
  });

  it("uses first-success authentication order", async () => {
    const calls: string[] = [];
    const handler = makeHandler({
      authSchemes: [
        {
          name: "first",
          authenticate: async () => {
            calls.push("first");
            return null;
          },
        },
        {
          name: "second",
          authenticate: async () => {
            calls.push("second");
            return { principal: "second" };
          },
        },
        {
          name: "third",
          authenticate: async () => {
            calls.push("third");
            return { principal: "third" };
          },
        },
      ],
    });

    await handler.handle(makeServerRequest());

    expect(calls).toEqual(["first", "second"]);
  });

  it("runs every traditional interceptor point in newest-registration-first order", async () => {
    const calls: string[] = [];
    const makeInterceptor = (name: string): ServerInterceptor<TestIdentity, "native"> => ({
      readBeforeExecution() {
        calls.push(`${name}:readBeforeExecution`);
      },
      readAfterAuthentication() {
        calls.push(`${name}:readAfterAuthentication`);
      },
      modifyBeforeDeserialization(hook) {
        calls.push(`${name}:modifyBeforeDeserialization`);
        return hook.request as HttpRequest;
      },
      readAfterDeserialization() {
        calls.push(`${name}:readAfterDeserialization`);
      },
      modifyBeforeValidation(hook) {
        calls.push(`${name}:modifyBeforeValidation`);
        return hook.input;
      },
      readAfterValidation() {
        calls.push(`${name}:readAfterValidation`);
      },
      readBeforeInvocation() {
        calls.push(`${name}:readBeforeInvocation`);
      },
      readAfterInvocation() {
        calls.push(`${name}:readAfterInvocation`);
      },
      modifyBeforeSerialization(hook) {
        calls.push(`${name}:modifyBeforeSerialization`);
        return hook.output;
      },
      readAfterSerialization() {
        calls.push(`${name}:readAfterSerialization`);
      },
      modifyBeforeCompletion(hook) {
        calls.push(`${name}:modifyBeforeCompletion`);
        return hook.response;
      },
      readAfterExecution() {
        calls.push(`${name}:readAfterExecution`);
      },
    });
    const handler = makeHandler({
      authSchemes: [
        {
          name: "auth",
          authenticate: async () => ({ principal: "user" }),
        },
      ],
      interceptors: [makeInterceptor("first"), makeInterceptor("second")],
    });

    await handler.handle(makeServerRequest());

    expect(calls).toEqual(
      [
        "readBeforeExecution",
        "readAfterAuthentication",
        "modifyBeforeDeserialization",
        "readAfterDeserialization",
        "modifyBeforeValidation",
        "readAfterValidation",
        "readBeforeInvocation",
        "readAfterInvocation",
        "modifyBeforeSerialization",
        "readAfterSerialization",
        "modifyBeforeCompletion",
        "readAfterExecution",
      ].flatMap((hook) => [`second:${hook}`, `first:${hook}`])
    );
  });

  it("creates and finalizes one recorder with traditional metric names", async () => {
    const recorder = new TestRecorder();
    const create = vi.fn(() => recorder);
    const handler = makeHandler({
      metricsRecorderFactory: { create },
    });

    await handler.handle(makeServerRequest());

    expect(create).toHaveBeenCalledTimes(1);
    expect(recorder.events[0]).toEqual({ type: "begin" });
    expect(
      recorder.events
        .filter((event): event is Extract<RecorderEvent, { type: "time" }> => event.type === "time")
        .map((event) => event.name)
    ).toEqual(["DeserializationTime", "ValidationTime", "ActivityTime", "SerializationTime"]);
    expect(recorder.events).toContainEqual({
      type: "property",
      name: "Operation",
      value: "TestOperation",
    });
    expect(recorder.events).toContainEqual({
      type: "outcome",
      outcome: "Success",
    });
    expect(countValue(recorder, "Error")).toBe(0);
    expect(countValue(recorder, "Fault")).toBe(0);
    expect(countValue(recorder, "Failure")).toBe(0);
    expect(recorder.events.at(-1)).toEqual({ type: "end" });
  });

  it("classifies modeled, framework, and unhandled errors like the traditional pipeline", async () => {
    const modeledRecorder = new TestRecorder();
    const modeled = makeHandler({
      metricsRecorderFactory: { create: () => modeledRecorder },
      handlers: {
        TestOperation: async () => {
          throw new ServiceException({
            name: "ModeledError",
            $fault: "client",
          });
        },
      },
    });
    await modeled.handle(makeServerRequest());
    expect(countValue(modeledRecorder, "Error")).toBe(1);
    expect(countValue(modeledRecorder, "Fault")).toBe(0);
    expect(countValue(modeledRecorder, "Failure")).toBe(0);

    const frameworkRecorder = new TestRecorder();
    const framework = makeHandler({
      metricsRecorderFactory: { create: () => frameworkRecorder },
      authSchemes: [{ name: "reject", authenticate: async () => null }],
    });
    await framework.handle(makeServerRequest());
    expect(countValue(frameworkRecorder, "Error")).toBe(0);
    expect(countValue(frameworkRecorder, "Fault")).toBe(1);
    expect(countValue(frameworkRecorder, "Failure")).toBe(0);

    const failureRecorder = new TestRecorder();
    const failure = makeHandler({
      metricsRecorderFactory: { create: () => failureRecorder },
      handlers: {
        TestOperation: async () => {
          throw new Error("unhandled");
        },
      },
    });
    await failure.handle(makeServerRequest());
    expect(countValue(failureRecorder, "Error")).toBe(0);
    expect(countValue(failureRecorder, "Fault")).toBe(1);
    expect(countValue(failureRecorder, "Failure")).toBe(1);
  });

  it("runs readAfterExecution only for interceptors that entered the request", async () => {
    const calls: string[] = [];
    const handler = makeHandler({
      interceptors: [
        {
          readBeforeExecution() {
            calls.push("throws");
            throw new Error("stop");
          },
          readAfterExecution() {
            calls.push("throws:after");
          },
        },
        {
          readBeforeExecution() {
            calls.push("entered");
          },
          readAfterExecution() {
            calls.push("entered:after");
          },
        },
      ],
    });

    const response = await handler.handle(makeServerRequest());

    expect(response).toBeInstanceOf(HttpResponse);
    expect(calls).toEqual(["entered", "throws", "entered:after"]);
  });

  it("does not let readAfterExecution failures replace the response", async () => {
    const handler = makeHandler({
      interceptors: [
        {
          readAfterExecution() {
            throw new Error("ignored");
          },
        },
      ],
    });

    const response = await handler.handle(makeServerRequest());

    expect(response.statusCode).toBe(200);
  });
});
