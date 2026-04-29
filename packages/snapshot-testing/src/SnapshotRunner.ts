import { NormalizedSchema } from "@smithy/core/schema";
import type {
  Client,
  Command,
  HttpResponse as IHttpResponse,
  Logger,
  StaticErrorSchema,
  StaticOperationSchema,
} from "@smithy/types";
import { readFileSync } from "node:fs";
import { accessSync, constants, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { snapshotTestingProtocolResponseSerializers } from "./protocols/index";
import { serializeDocument } from "./serializers/serializeDocument";
import { serializeHttpResponse } from "./serializers/serializeHttpResponse";
import { RequestSnapshotCompleted } from "./snapshot-testing-types";
import { SnapshotRequestHandler } from "./SnapshotRequestHandler";
import { createFromSchema } from "./structure/createFromSchema";

/**
 * @internal
 */
type $Client = Client<any, any, any>;
/**
 * @internal
 */
type $Command = Command<any, any, any, any, any>;

/**
 * @internal
 */
type $ClientCtor = { new (...args: any[]): $Client };
/**
 * @internal
 */
type $CommandCtor = { new (...args: any[]): $Command };

/**
 * @internal
 */
export interface SnapshotRunnerOptions {
  /**
   * Path to write snapshots. Should be a folder without other files.
   */
  snapshotDirPath: string;

  /**
   * Client constructor for the client that owns the commands in the schemas map.
   */
  Client: $ClientCtor;

  /**
   * Map of operation schema to command classes.
   */
  schemas: Map<StaticOperationSchema, $CommandCtor>;

  /**
   * Errors for which to generate response-error snapshots.
   */
  errors?: StaticErrorSchema[];

  /**
   * write - write the data without comparing.
   * compare - throw if comparison to existing files in the same folder contain mismatches.
   *
   * @defaultValue "write"
   */
  mode?: "write" | "compare";

  /**
   * Provide this if running in a test framework.
   */
  testCase?(caseName: string, run: () => Promise<void>): void;

  /**
   * Provide this if running in a test framework.
   */
  assertions?(caseName: string, expected: string, actual: string): Promise<void>;
}

/**
 * Takes a client and map of commands to create a snapshot
 * of requests and responses associated with the client's operations.
 *
 * These snapshots can be visually inspected for e.g. regression diffs,
 * or exercised in snapshot tests.
 *
 * @internal
 */
export class SnapshotRunner {
  public constructor(private options: SnapshotRunnerOptions) {
    const dir = dirname(options.snapshotDirPath);
    accessSync(dir, constants.W_OK);
  }

  public run(): Promise<void> {
    const {
      snapshotDirPath,
      Client,
      schemas,
      mode = "write",
      testCase = async (_, run) => {
        await run();
      },
      assertions = (caseName, ex, act) => {
        if (ex !== act) {
          throw new Error(`Serialization for ${caseName} does not match snapshot on disk.`);
        }
      },
      errors = [],
    } = this.options;

    if (mode === "write") {
      rmSync(snapshotDirPath, { recursive: true, force: true });
    }

    const promises = [] as Promise<void>[];

    // requests
    for (const [schema, CommandCtor] of schemas) {
      const operationName = CommandCtor.name.replace(/Command$/, "");

      const testCaseExec = testCase(operationName + " (request)", async () => {
        let buf = ``;
        const logger = {
          ...console,
          trace(msg: string) {
            buf += msg;
          },
        };

        await this.executeCommand({
          logger,
          Client,
          schema,
          CommandCtor,
        }).catch((e) => {
          if (e instanceof RequestSnapshotCompleted) {
            return;
          }
          logger.trace("\n[CommandError]\n");
          logger.trace(e.stack);
          logger.error(`${e.name}: ${e.message}`);
        });

        const snapshotPath = join(snapshotDirPath, "req", operationName + ".txt");
        const containerFolder = dirname(snapshotPath);
        if (!existsSync(containerFolder)) {
          mkdirSync(containerFolder, { recursive: true });
        }

        if (mode === "compare") {
          const canonical = readFileSync(snapshotPath, "utf-8");
          if (assertions) {
            assertions(operationName, canonical, buf);
          } else {
            if (canonical !== buf) {
              throw new Error(`Serialization for ${CommandCtor.name} does not match snapshot on disk.`);
            }
          }
        } else {
          writeFileSync(snapshotPath, buf, "utf-8");
        }
      });

      promises.push(Promise.resolve(testCaseExec));
    }

    // responses
    for (const [schema, CommandCtor] of schemas) {
      const [, namespace, name, traits, input, output] = schema;
      const operationName = CommandCtor.name.replace(/Command$/, "");

      const testCaseExec = testCase(operationName + " (response)", async () => {
        let buf = ``;
        const logger = {
          ...console,
          trace(msg: string) {
            buf += msg;
          },
        };

        const client = this.initClient(Client, { endpoint: "https://localhost", logger });
        const protocolId = client.config.protocol.getShapeId();

        for (const options of [{ mode: "min" }, { mode: "max" }] as const) {
          if (options.mode === "min") {
            logger.trace("=".repeat(24) + ` minimal response ` + "=".repeat(24));
          } else {
            logger.trace("=".repeat(24) + ` w/ optional fields ` + "=".repeat(24));
          }
          logger.trace("\n");

          const snapshotProtocol = snapshotTestingProtocolResponseSerializers[protocolId];
          if (!snapshotProtocol) {
            throw new Error(`No response serializer found for protocol: ${protocolId}`);
          }
          snapshotProtocol.setSerdeContext(client.config);

          // copies to allow two types of serializers to read the response stream.
          const [r1, r2] = [
            await snapshotProtocol.serializeResponse(schema, createFromSchema(output, undefined, options)),
            await snapshotProtocol.serializeResponse(schema, createFromSchema(output, undefined, options)),
          ];

          const ns = NormalizedSchema.of(output);
          const mayBufferResponseBody =
            !ns.getEventStreamMember() &&
            !Object.values(ns.getMemberSchemas()).some(($) => $.isBlobSchema() && $.isStreaming());

          const serialization = await serializeHttpResponse(r1, mayBufferResponseBody);
          logger.trace(serialization);

          const command = new CommandCtor(createFromSchema(input));
          client.config.requestHandler = new SnapshotRequestHandler({
            response: r2,
          });
          try {
            const output = await client.send(command);
            const outputSerialization = await serializeDocument(output);

            logger.trace("\n\n--- [output object] ---\n");
            logger.trace(outputSerialization);
          } catch (e) {
            logger.trace(`\n\n[CommandError]\n`);
            logger.trace(e.stack);
            logger.error(`${e.name}: ${e.message}`);
          }
          logger.trace("\n\n");
        }

        const snapshotPath = join(snapshotDirPath, "res", operationName + ".txt");
        const containerFolder = dirname(snapshotPath);
        if (!existsSync(containerFolder)) {
          mkdirSync(containerFolder, { recursive: true });
        }

        if (mode === "compare") {
          const canonical = readFileSync(snapshotPath, "utf-8");
          if (assertions) {
            assertions(operationName, canonical, buf);
          } else {
            if (canonical !== buf) {
              throw new Error(`Deserialization for ${CommandCtor.name} does not match snapshot on disk.`);
            }
          }
        } else {
          writeFileSync(snapshotPath, buf, "utf-8");
        }
      });

      promises.push(Promise.resolve(testCaseExec));
    }

    // errors
    const [$operation, CommandCtor] = schemas[Symbol.iterator]().next().value!;
    const [, ns] = $operation;

    for (const $error of [
      [-3, ns, "UnmodeledServiceException", { error: "server" }, ["Message"], [0]] satisfies StaticErrorSchema,
      ...errors,
    ]) {
      const [, namespace, name, traits, memberNames, members, requiredMemberCount] = $error;
      const $errorNormalized = NormalizedSchema.of($error);
      const qualifiedName = $errorNormalized.getName(true);

      const testCaseExec = testCase(qualifiedName + " (error)", async () => {
        let buf = ``;
        const logger = {
          ...console,
          trace(msg: string) {
            buf += msg;
          },
        };

        const client = this.initClient(Client, { endpoint: "https://localhost", logger, maxAttempts: 1 });
        const protocolId = client.config.protocol.getShapeId();

        for (const options of [{ mode: "min" }, { mode: "max" }, { mode: "frontend" }] as const) {
          if (options.mode === "frontend") {
            logger.trace("=".repeat(24) + ` frontend error ` + "=".repeat(24));
          } else if (options.mode === "min") {
            logger.trace("=".repeat(24) + ` minimal response ` + "=".repeat(24));
          } else if (options.mode === "max") {
            logger.trace("=".repeat(24) + ` w/ optional fields ` + "=".repeat(24));
          }
          logger.trace("\n");

          const snapshotProtocol = snapshotTestingProtocolResponseSerializers[protocolId];
          if (!snapshotProtocol) {
            throw new Error(`No response serializer found for protocol: ${protocolId}`);
          }
          snapshotProtocol.setSerdeContext(client.config);

          // copies to allow two types of serializers to read the response stream.
          const [r1, r2] =
            options.mode === "frontend"
              ? [
                  await snapshotProtocol.serializeGenericFrontendErrorResponse(),
                  await snapshotProtocol.serializeGenericFrontendErrorResponse(),
                ]
              : [
                  await snapshotProtocol.serializeErrorResponse($error, createFromSchema($error, undefined, options)),
                  await snapshotProtocol.serializeErrorResponse($error, createFromSchema($error, undefined, options)),
                ];

          const ns = NormalizedSchema.of($operation[5]);
          const mayBufferResponseBody =
            !ns.getEventStreamMember() &&
            !Object.values(ns.getMemberSchemas()).some(($) => $.isBlobSchema() && $.isStreaming());

          const serialization = await serializeHttpResponse(r1, mayBufferResponseBody);
          logger.trace(serialization);

          const command = new CommandCtor(createFromSchema($operation[4 /*input*/]));
          client.config.requestHandler = new SnapshotRequestHandler({
            response: r2,
          });
          try {
            const output = await client.send(command).catch((e: any) => e);
            const outputSerialization = await serializeDocument(output);

            logger.trace("\n\n--- [error name & message] ---\n");
            logger.trace(`${output.name}: ${output.message}`);
            logger.trace("\n\n--- [error object] ---\n");
            logger.trace(outputSerialization);
          } catch (e) {
            logger.trace(`\n\n[CommandError]\n`);
            logger.trace(e.stack);
            logger.error(`${e.name}: ${e.message}`);
          }
          logger.trace("\n\n");
        }

        const snapshotPath = join(snapshotDirPath, "res-err", name + ".txt");
        const containerFolder = dirname(snapshotPath);
        if (!existsSync(containerFolder)) {
          mkdirSync(containerFolder, { recursive: true });
        }

        if (mode === "compare") {
          const canonical = readFileSync(snapshotPath, "utf-8");
          if (assertions) {
            assertions(name, canonical, buf);
          } else {
            if (canonical !== buf) {
              throw new Error(`Error deserialization for ${name} does not match snapshot on disk.`);
            }
          }
        } else {
          writeFileSync(snapshotPath, buf, "utf-8");
        }
      });

      promises.push(Promise.resolve(testCaseExec));
    }

    return Promise.all(promises).then(() => {});
  }

  private async executeCommand({
    logger,
    Client,
    schema,
    CommandCtor,
    endpoint,
  }: {
    logger: Logger;
    Client: $ClientCtor;
    schema: StaticOperationSchema;
    CommandCtor: $CommandCtor;
    endpoint?: string;
  }) {
    const client = this.initClient(Client, { endpoint, logger });
    const [, namespace, name, traits, input, output] = schema;
    const command = new CommandCtor(createFromSchema(input));

    const $ = NormalizedSchema.of(input);
    if ($.getEventStreamMember()) {
      client.middlewareStack.add(this.getEventStreamStaticSignatureMiddleware, {
        tags: ["EVENT_STREAM", "SIGNATURE"],
        name: "eventStreamStaticSignatureMiddleware",
        step: "build" as const,
        override: true,
      });
    }
    const snapshotMetadata = {
      [Symbol.for("$schema")]: schema,
      [Symbol.for("$client")]: client,
      [Symbol.for("$command")]: command,
    };
    await client.send(command, snapshotMetadata).catch((e: any) => {
      switch (e.name) {
        case "EndpointError":
          return this.executeCommand({
            logger,
            Client,
            schema,
            CommandCtor,
            endpoint: "https://localhost/mock-required-endpoint",
          });
        default:
          throw e;
      }
    });
  }

  private initClient(
    Client: any,
    {
      endpoint,
      logger,
      response,
      maxAttempts,
    }: { endpoint?: string; logger?: Logger; response?: IHttpResponse; maxAttempts?: number }
  ): any {
    return new Client({
      region: "us-east-1",
      credentials: {
        accessKeyId: "MOCK_ak",
        secretAccessKey: "MOCK_sak",
      },
      apiKey: { apiKey: "MOCK_api_key" },
      endpoint,
      requestHandler: new SnapshotRequestHandler({
        logger,
        response,
      }),
      maxAttempts,
    });
  }

  private getEventStreamStaticSignatureMiddleware = (next: any, context: any) => async (args: any) => {
    context.__staticSignature = true;
    return next(args);
  };
}
