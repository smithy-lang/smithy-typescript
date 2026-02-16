import type { Client, Command, Logger, StaticOperationSchema } from "@smithy/types";
import { readFileSync } from "fs";
import { accessSync, constants, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

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
    } = this.options;

    if (mode === "write") {
      rmSync(snapshotDirPath, { recursive: true, force: true });
    }

    const promises = [] as Promise<void>[];

    for (const [schema, CommandCtor] of schemas) {
      const operationName = CommandCtor.name.replace(/Command$/, "");

      const testCaseExec = testCase(operationName, async () => {
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
          logger.error(e);
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
    const client = new Client({
      region: "us-east-1",
      credentials: {
        accessKeyId: "MOCK_ak",
        secretAccessKey: "MOCK_sak",
      },
      apiKey: { apiKey: "MOCK_api_key" },
      endpoint,
      requestHandler: new SnapshotRequestHandler({
        logger,
      }),
    });
    const [, namespace, name, traits, input, output] = schema;
    const command = new CommandCtor(createFromSchema(input));
    const snapshotMetadata = {
      [Symbol.for("$schema")]: schema,
      [Symbol.for("$client")]: client,
      [Symbol.for("$command")]: command,
    };
    await client.send(command, snapshotMetadata).catch((e) => {
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
}
