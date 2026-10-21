// smithy-typescript generated code
import { SnapshotRunner } from "@smithy/snapshot-testing";
import { join } from "node:path";
import { describe, expect, test as it, vi } from "vitest";

import {
  BigDecimalOperation$,
  BigDecimalOperationCommand,
  BigIntegerOperation$,
  BigIntegerOperationCommand,
  ComplexError$,
  EmptyInputOutput$,
  EmptyInputOutputCommand,
  FractionalSeconds$,
  FractionalSecondsCommand,
  GreetingWithErrors$,
  GreetingWithErrorsCommand,
  InvalidGreeting$,
  NoInputOutput$,
  NoInputOutputCommand,
  OperationWithDefaults$,
  OperationWithDefaultsCommand,
  OptionalInputOutput$,
  OptionalInputOutputCommand,
  RecursiveShapes$,
  RecursiveShapesCommand,
  RpcV2JsonDenseMaps$,
  RpcV2JsonDenseMapsCommand,
  RpcV2JsonLists$,
  RpcV2JsonListsCommand,
  RpcV2JsonProtocolClient,
  RpcV2JsonSparseMaps$,
  RpcV2JsonSparseMapsCommand,
  SimpleScalarProperties$,
  SimpleScalarPropertiesCommand,
  SparseNullsOperation$,
  SparseNullsOperationCommand,
  TimestampFormatIgnored$,
  TimestampFormatIgnoredCommand,
  ValidationException$,
} from "../src";

vi.setSystemTime(new Date(946702799999));
const Client = RpcV2JsonProtocolClient;

const mode = (process.env.SNAPSHOT_MODE as "write" | "compare") ?? "write";

describe("RpcV2JsonProtocolClient" + ` (${mode})`, () => {
  const runner = new SnapshotRunner({
    snapshotDirPath: join(__dirname, "snapshots"),
    Client,
    mode,
    testCase(caseName: string, run: () => Promise<void>) {
      it(caseName, run);
    },
    assertions(caseName: string, expected: string, actual: string): Promise<void> {
      expect(actual).toEqual(expected);
      return Promise.resolve();
    },
    schemas: new Map<any, any>([
      [BigDecimalOperation$, BigDecimalOperationCommand],
      [BigIntegerOperation$, BigIntegerOperationCommand],
      [EmptyInputOutput$, EmptyInputOutputCommand],
      [FractionalSeconds$, FractionalSecondsCommand],
      [GreetingWithErrors$, GreetingWithErrorsCommand],
      [NoInputOutput$, NoInputOutputCommand],
      [OperationWithDefaults$, OperationWithDefaultsCommand],
      [OptionalInputOutput$, OptionalInputOutputCommand],
      [RecursiveShapes$, RecursiveShapesCommand],
      [RpcV2JsonDenseMaps$, RpcV2JsonDenseMapsCommand],
      [RpcV2JsonLists$, RpcV2JsonListsCommand],
      [RpcV2JsonSparseMaps$, RpcV2JsonSparseMapsCommand],
      [SimpleScalarProperties$, SimpleScalarPropertiesCommand],
      [SparseNullsOperation$, SparseNullsOperationCommand],
      [TimestampFormatIgnored$, TimestampFormatIgnoredCommand],
    ]),
    errors: [
      ValidationException$,
      ComplexError$,
      InvalidGreeting$,
    ],
  });
  runner.run();
}, 30_000);
