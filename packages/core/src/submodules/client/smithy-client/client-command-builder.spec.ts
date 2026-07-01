import {
  SMITHY_CONTEXT_KEY,
  type EndpointParameterInstructions,
  type MetadataBearer,
  type StaticOperationSchema,
} from "@smithy/types";
import { describe, expect, test as it, vi } from "vitest";

import { makeBuilder } from "./client-command-builder";
import { Command } from "./command";

describe(makeBuilder.name, () => {
  const commonParams: EndpointParameterInstructions = {
    Region: { type: "builtInParams", name: "region" },
    Endpoint: { type: "builtInParams", name: "endpoint" },
  };
  const serviceShapeName = "MyService";
  const sdkClientName = "MyServiceClient";
  const mockEndpointPlugin = vi.fn().mockReturnValue({ applyToStack: vi.fn() });

  const operationSchema: StaticOperationSchema = [9, "com.example#", "GetItem", {}, "unit", "unit"];

  it("returns a command factory function", () => {
    const command = makeBuilder(commonParams, serviceShapeName, sdkClientName, mockEndpointPlugin);
    expect(typeof command).toBe("function");
  });

  it("creates a Command class from the factory", () => {
    const command = makeBuilder(commonParams, serviceShapeName, sdkClientName, mockEndpointPlugin);

    const CommandClass = command({}, () => [], "GetItem", operationSchema);

    const instance = new CommandClass({ key: "value" });
    expect(instance).toBeInstanceOf(Command);
    expect(instance.input).toEqual({ key: "value" });
  });

  it("merges commonParams and operation-specific params in endpoint parameter instructions", () => {
    const command = makeBuilder(commonParams, serviceShapeName, sdkClientName, mockEndpointPlugin);
    const operationParams: EndpointParameterInstructions = {
      BucketName: { type: "contextParams", name: "Bucket" },
    };

    const CommandClass = command(operationParams, () => [], "GetItem", operationSchema);

    expect(CommandClass.getEndpointParameterInstructions()).toEqual({
      Region: { type: "builtInParams", name: "region" },
      Endpoint: { type: "builtInParams", name: "endpoint" },
      BucketName: { type: "contextParams", name: "Bucket" },
    });
  });

  it("operation-specific params override common params", () => {
    const command = makeBuilder(commonParams, serviceShapeName, sdkClientName, mockEndpointPlugin);
    const operationParams: EndpointParameterInstructions = {
      Region: { type: "contextParams", name: "overrideRegion" },
    };

    const CommandClass = command(operationParams, () => [], "GetItem", operationSchema);

    expect(CommandClass.getEndpointParameterInstructions()).toEqual({
      Region: { type: "contextParams", name: "overrideRegion" },
      Endpoint: { type: "builtInParams", name: "endpoint" },
    });
  });

  it("sets the service and operation names in the smithy context", () => {
    const command = makeBuilder(commonParams, serviceShapeName, sdkClientName, mockEndpointPlugin);
    const middlewareFn = vi.fn().mockReturnValue([]);

    const CommandClass = command({}, middlewareFn, "GetItem", operationSchema, { authSchemes: [] });

    const instance = new CommandClass({});

    const mockStack = {
      concat: () => ({
        resolve: (handler: any, ctx: any) => {
          expect(ctx.commandName).toBe("GetItemCommand");
          expect(ctx[SMITHY_CONTEXT_KEY]).toMatchObject({
            service: serviceShapeName,
            operation: "GetItem",
            authSchemes: [],
          });
          return vi.fn();
        },
      }),
    };

    instance.resolveMiddleware(mockStack as any, { logger: {} as any, requestHandler: { handle: vi.fn() } }, {});
  });

  it("sets the client name and command name identifiers", () => {
    const command = makeBuilder(commonParams, serviceShapeName, sdkClientName, mockEndpointPlugin);
    const middlewareFn = vi.fn().mockReturnValue([]);

    const CommandClass = command({}, middlewareFn, "PutItem", operationSchema);

    const instance = new CommandClass({});

    const mockStack = {
      concat: () => ({
        resolve: (handler: any, ctx: any) => {
          expect(ctx.commandName).toBe("PutItemCommand");
          return vi.fn();
        },
      }),
    };

    instance.resolveMiddleware(mockStack as any, { logger: {} as any, requestHandler: { handle: vi.fn() } }, {});
  });

  it("capitalizes the operation shape name in the command name", () => {
    const command = makeBuilder(commonParams, serviceShapeName, sdkClientName, mockEndpointPlugin);
    const middlewareFn = vi.fn().mockReturnValue([]);

    const CommandClass = command({}, middlewareFn, "camelCaseOperation", operationSchema);

    const instance = new CommandClass({});

    const mockStack = {
      concat: () => ({
        resolve: (handler: any, ctx: any) => {
          expect(ctx.commandName).toBe("CamelCaseOperationCommand");
          return vi.fn();
        },
      }),
    };

    instance.resolveMiddleware(mockStack as any, { logger: {} as any, requestHandler: { handle: vi.fn() } }, {});
  });

  it("passes the middleware function which receives CommandCtor, clientStack, config, and options", () => {
    const command = makeBuilder(commonParams, serviceShapeName, sdkClientName, mockEndpointPlugin);
    const middlewareFn = vi.fn().mockReturnValue([]);

    const CommandClass = command({}, middlewareFn, "GetItem", operationSchema);

    const instance = new CommandClass({});
    const config = { logger: {} as any, requestHandler: { handle: vi.fn() } };
    const options = { requestTimeout: 3000 };

    const mockStack = {
      concat: () => ({
        resolve: () => vi.fn(),
      }),
    };

    instance.resolveMiddleware(mockStack as any, config, options);

    expect(middlewareFn).toHaveBeenCalledWith(CommandClass, mockStack, config, options);
  });

  it("attaches the operation schema to the command instance", () => {
    const command = makeBuilder(commonParams, serviceShapeName, sdkClientName, mockEndpointPlugin);

    const CommandClass = command({}, () => [], "GetItem", operationSchema);

    const instance = new CommandClass({});
    expect(instance.schema).toBe(operationSchema);
  });

  it("allows empty input", () => {
    const command = makeBuilder(commonParams, serviceShapeName, sdkClientName, mockEndpointPlugin);

    const CommandClass = command({}, () => [], "GetItem", operationSchema);

    const instance = new CommandClass();
    expect(instance.input).toEqual({});
  });

  it("supports creating multiple different command classes from the same builder", () => {
    const command = makeBuilder(commonParams, serviceShapeName, sdkClientName, mockEndpointPlugin);

    const GetItemCommand = command({}, () => [], "GetItem", operationSchema);
    const putSchema: StaticOperationSchema = [9, "com.example#", "PutItem", {}, "unit", "unit"];
    const PutItemCommand = command(
      { TableName: { type: "contextParams", name: "Table" } },
      () => [],
      "PutItem",
      putSchema
    );

    const getInst = new GetItemCommand({ id: "1" });
    const putInst = new PutItemCommand({ data: "hello" });

    expect(getInst).toBeInstanceOf(Command);
    expect(putInst).toBeInstanceOf(Command);
    expect(getInst.input).toEqual({ id: "1" });
    expect(putInst.input).toEqual({ data: "hello" });

    expect(GetItemCommand.getEndpointParameterInstructions()).toEqual(commonParams);
    expect(PutItemCommand.getEndpointParameterInstructions()).toEqual({
      ...commonParams,
      TableName: { type: "contextParams", name: "Table" },
    });
  });

  it("automatically prepends the endpoint plugin before user plugins", () => {
    const epPlugin = { applyToStack: vi.fn() };
    const ep = vi.fn().mockReturnValue(epPlugin);
    const userPlugin = { applyToStack: vi.fn() };
    const middlewareFn = vi.fn().mockReturnValue([userPlugin]);

    const command = makeBuilder(commonParams, serviceShapeName, sdkClientName, ep);
    const CommandClass = command({}, middlewareFn, "GetItem", operationSchema);

    const instance = new CommandClass({});
    const usedPlugins: any[] = [];
    vi.spyOn(instance.middlewareStack, "use").mockImplementation((p: any) => {
      usedPlugins.push(p);
    });

    const mockStack = {
      concat: () => ({
        resolve: () => vi.fn(),
      }),
    };

    instance.resolveMiddleware(mockStack as any, { requestHandler: { handle: vi.fn() } }, {});

    expect(ep).toHaveBeenCalledWith(expect.objectContaining({ requestHandler: expect.anything() }), commonParams);
    expect(usedPlugins[0]).toBe(epPlugin);
    expect(usedPlugins[1]).toBe(userPlugin);
  });

  it("requires constructor argument when input has required fields", () => {
    type RequiredInput = {
      key: string | undefined;
      optional?: string;
    };
    type TestOutput = MetadataBearer;
    type TestConfig = { logger?: any; requestHandler: { handle: any } };

    const command = makeBuilder<TestConfig, RequiredInput, TestOutput>(
      commonParams,
      serviceShapeName,
      sdkClientName,
      mockEndpointPlugin
    );

    const CommandClass = command<RequiredInput, TestOutput>({}, () => [], "GetItem", operationSchema);

    // Constructing with required input works.
    const instance = new CommandClass({ key: "value" });
    expect(instance).toBeInstanceOf(Command);
    expect(instance.input).toEqual({ key: "value" });

    // Type-level assertion: RequiredInput commands do NOT accept zero arguments.
    // The following would be a type error if uncommented:
    // new CommandClass(); // <-- TS2554: Expected 1 arguments, but got 0.

    // Verify at type level using conditional types.
    type CtorParams = ConstructorParameters<typeof CommandClass>;
    type IsOptional = [] extends CtorParams ? true : false;
    const assertNotOptional: IsOptional = false as const;
    void assertNotOptional;
  });

  it("allows omitting constructor argument when input has only optional fields", () => {
    type OptionalInput = {
      key?: string;
      optional?: string;
    };
    type TestOutput = MetadataBearer;
    type TestConfig = { logger?: any; requestHandler: { handle: any } };

    const command = makeBuilder<TestConfig, OptionalInput, TestOutput>(
      commonParams,
      serviceShapeName,
      sdkClientName,
      mockEndpointPlugin
    );

    const CommandClass = command<OptionalInput, TestOutput>({}, () => [], "GetItem", operationSchema);

    // Constructing with no arguments works.
    const instance = new CommandClass();
    expect(instance).toBeInstanceOf(Command);

    // Constructing with an argument also works.
    const instance2 = new CommandClass({ key: "hello" });
    expect(instance2.input).toEqual({ key: "hello" });

    // Verify at type level that zero args is accepted.
    type CtorParams = ConstructorParameters<typeof CommandClass>;
    type IsOptional = [] extends CtorParams ? true : false;
    const assertOptional: IsOptional = true as const;
    void assertOptional;
  });
});
