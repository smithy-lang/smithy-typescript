import { describe, expect, test as it, vi } from "vitest";
import { NormalizedSchema } from "@smithy/core/schema";
import {
  SMITHY_CONTEXT_KEY,
  type StaticOperationSchema,
  type StaticStructureSchema,
  type StaticUnionSchema,
} from "@smithy/types";

import { Command } from "./command";

// A streaming union member marks an event stream; see NormalizedSchema.getEventStreamMember.
const streamingUnion: StaticUnionSchema = [4, "ns", "Stream", { streaming: 1 }, [], []];
const plainStruct: StaticStructureSchema = [3, "ns", "Plain", 0, ["x"], [1]];
const structWith = (member: StaticUnionSchema): StaticStructureSchema => [3, "ns", "Wrap", 0, ["s"], [member]];
const unit: StaticStructureSchema = [3, "smithy.api", "Unit", 0, [], []];

const opSchema = (input: StaticStructureSchema, output: StaticStructureSchema): StaticOperationSchema => [
  9,
  "ns",
  "Op",
  0,
  input,
  output,
];

const eventStreamProbeCommand = (schema?: StaticOperationSchema) => {
  const handleFn = vi.fn().mockResolvedValue({ response: {} });
  const builder = Command.classBuilder<any, any, any, any, any>()
    .m(function () {
      return [];
    })
    .s("MyClient", "MyOp", {})
    .n("MyClient", "MyOp")
    .f()
    .ser(async (_) => ({ ..._, headers: {}, method: "POST", protocol: "https:", hostname: "localhost", path: "/" }))
    .de(async (_) => ({ $metadata: {} }));
  if (schema) {
    builder.sc(schema);
  }
  class ProbeCommand extends builder.build() {}
  return { ProbeCommand, handleFn };
};

const dispatch = async (ProbeCommand: any, handleFn: any) => {
  const cmd = new ProbeCommand({});
  const handler = cmd.resolveMiddleware(
    { concat: () => ({ resolve: (fn: any) => fn }) } as any,
    { logger: {} as any, requestHandler: { handle: handleFn } },
    { requestTimeout: 5000 }
  );
  await handler({ input: {} });
  return handleFn.mock.calls[0][1];
};

describe(Command.name, () => {
  it("has optional argument if the input type has no required members", async () => {
    type OptionalInput = {
      key?: string;
      optional?: string;
    };

    type RequiredInput = {
      key: string | undefined;
      optional?: string;
    };

    class WithRequiredInputCommand extends Command.classBuilder<RequiredInput, any, any, any, any>().build() {}

    class WithOptionalInputCommand extends Command.classBuilder<OptionalInput, any, any, any, any>().build() {}

    new WithRequiredInputCommand({ key: "1" });

    new WithOptionalInputCommand(); // expect no type error.
  });
  it("implements a classBuilder", async () => {
    class MyCommand extends Command.classBuilder<any, any, any, any, any>()
      .ep({
        Endpoint: { type: "builtInParams", name: "Endpoint" },
      })
      .m(function () {
        return [];
      })
      .s("SmithyMyClient", "SmithyMyOperation", {})
      .n("MyClient", "MyCommand")
      .f()
      .ser(async (_) => _)
      .de(async (_) => _)
      .build() {}

    const myCommand = new MyCommand({
      Prop: "prop1",
    });

    expect(myCommand).toBeInstanceOf(Command);
    expect(myCommand).toBeInstanceOf(MyCommand);
    expect(MyCommand.getEndpointParameterInstructions()).toEqual({
      Endpoint: { type: "builtInParams", name: "Endpoint" },
    });
    expect(myCommand.input).toEqual({
      Prop: "prop1",
    });

    // private method exists for compatibility
    expect((myCommand as any).serialize).toBeDefined();

    // private method exists for compatibility
    expect((myCommand as any).deserialize).toBeDefined();
  });

  it("flags an event stream from a streaming input member and spreads requestOptions", async () => {
    const { ProbeCommand, handleFn } = eventStreamProbeCommand(opSchema(structWith(streamingUnion), unit));
    const passedOptions = await dispatch(ProbeCommand, handleFn);
    expect(passedOptions).toEqual({ isEventStream: true, requestTimeout: 5000 });
  });

  it("flags an event stream from a streaming output member", async () => {
    const { ProbeCommand, handleFn } = eventStreamProbeCommand(opSchema(unit, structWith(streamingUnion)));
    const passedOptions = await dispatch(ProbeCommand, handleFn);
    expect(passedOptions.isEventStream).toBe(true);
  });

  it("flags an event stream with both input and output streaming", async () => {
    const { ProbeCommand, handleFn } = eventStreamProbeCommand(
      opSchema(structWith(streamingUnion), structWith(streamingUnion))
    );
    const passedOptions = await dispatch(ProbeCommand, handleFn);
    expect(passedOptions.isEventStream).toBe(true);
  });

  it("does not flag a non-event-stream operation", async () => {
    const { ProbeCommand, handleFn } = eventStreamProbeCommand(opSchema(plainStruct, plainStruct));
    const passedOptions = await dispatch(ProbeCommand, handleFn);
    expect(passedOptions.isEventStream).toBeUndefined();
    expect(passedOptions).toEqual({ requestTimeout: 5000 });
  });

  it("does not flag a command without an operation schema", async () => {
    const { ProbeCommand, handleFn } = eventStreamProbeCommand(undefined);
    const passedOptions = await dispatch(ProbeCommand, handleFn);
    expect(passedOptions.isEventStream).toBeUndefined();
  });

  it("memoizes the event stream determination on the shared schema object", async () => {
    const schema = opSchema(structWith(streamingUnion), unit);
    const ofSpy = vi.spyOn(NormalizedSchema, "of");
    const { ProbeCommand, handleFn } = eventStreamProbeCommand(schema);

    await dispatch(ProbeCommand, handleFn);
    const callsAfterFirst = ofSpy.mock.calls.length;
    expect(callsAfterFirst).toBeGreaterThan(0);

    // A second dispatch of the same command class reuses the cached marker and does not re-normalize.
    await dispatch(ProbeCommand, vi.fn().mockResolvedValue({ response: {} }));
    expect(ofSpy.mock.calls.length).toBe(callsAfterFirst);

    ofSpy.mockRestore();
  });

  it("places an externally owned recorder in the Smithy context and does not pass it to the transport", async () => {
    let capturedContext: any;
    const handleFn = vi.fn().mockResolvedValue({ response: {} });
    const existingMetricsRecorder = { addCount: vi.fn() };

    class MyCommand extends Command.classBuilder<any, any, any, any, any>()
      .m(function () {
        return [];
      })
      .s("MyClient", "MyOp", {
        service: "generatedService",
        operation: "generatedOperation",
        conflictingContext: "generated",
      })
      .c({
        [SMITHY_CONTEXT_KEY]: {
          service: "userService",
          operation: "userOperation",
          commandInstance: "userCommand",
          customContext: true,
          conflictingContext: "user",
          metricsRecorder: existingMetricsRecorder,
        },
      } as any)
      .n("MyClient", "MyOp")
      .f()
      .ser(async (_) => ({ ..._, headers: {}, method: "POST", protocol: "https:", hostname: "localhost", path: "/" }))
      .de(async (_) => ({ $metadata: {} }))
      .build() {}

    const metricsRecorder = { addCount: vi.fn() };
    const cmd = new MyCommand({});
    const handler = cmd.resolveMiddleware(
      { concat: () => ({ resolve: (fn: any, ctx: any) => ((capturedContext = ctx), fn) }) } as any,
      {
        logger: {} as any,
        requestHandler: { handle: handleFn },
      },
      { metricsRecorder, requestTimeout: 5000 }
    );

    await handler({ input: {} });

    expect(capturedContext[SMITHY_CONTEXT_KEY]).toMatchObject({
      service: "generatedService",
      operation: "generatedOperation",
      commandInstance: cmd,
      customContext: true,
      conflictingContext: "generated",
      metricsRecorder,
    });
    expect(capturedContext.metricsRecorder).toBeUndefined();
    expect(handleFn).toHaveBeenCalledWith(undefined, { requestTimeout: 5000 });

    new MyCommand({}).resolveMiddleware(
      { concat: () => ({ resolve: (fn: any, ctx: any) => ((capturedContext = ctx), fn) }) } as any,
      {
        logger: {} as any,
        requestHandler: { handle: handleFn },
      },
      {}
    );

    expect(capturedContext[SMITHY_CONTEXT_KEY].metricsRecorder).toBe(existingMetricsRecorder);
  });
});
