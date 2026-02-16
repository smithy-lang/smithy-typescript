import {
  EmptyInputOutput$,
  EmptyInputOutputCommand,
  Float16$,
  Float16Command,
  FractionalSeconds$,
  FractionalSecondsCommand,
  GreetingWithErrors$,
  GreetingWithErrorsCommand,
  NoInputOutput$,
  NoInputOutputCommand,
  RecursiveShapes$,
  RecursiveShapesCommand,
  RpcV2CborSparseMaps$,
  RpcV2CborSparseMapsCommand,
  RpcV2Protocol,
  SimpleScalarProperties$,
  SimpleScalarPropertiesCommand,
  SparseNullsOperation$,
  SparseNullsOperationCommand,
} from "@smithy/smithy-rpcv2-cbor-schema";
import type { Command, StaticOperationSchema } from "@smithy/types";
import * as path from "node:path";
import { describe, expect, test as it } from "vitest";

import { SnapshotRunner } from "./SnapshotRunner";

type $Command = Command<any, any, any, any, any>;

describe("snapshot testing", () => {
  const runner = new SnapshotRunner({
    snapshotDirPath: path.join(__dirname, "..", "integ-snapshots"),
    Client: RpcV2Protocol,
    schemas: new Map<StaticOperationSchema, { new (...args: any[]): $Command }>([
      [EmptyInputOutput$, EmptyInputOutputCommand],
      [Float16$, Float16Command],
      [FractionalSeconds$, FractionalSecondsCommand],
      [GreetingWithErrors$, GreetingWithErrorsCommand],
      [NoInputOutput$, NoInputOutputCommand],
      [RecursiveShapes$, RecursiveShapesCommand],
      [RpcV2CborSparseMaps$, RpcV2CborSparseMapsCommand],
      [SparseNullsOperation$, SparseNullsOperationCommand],
      [SimpleScalarProperties$, SimpleScalarPropertiesCommand],
    ]),
    mode: "write",
    testCase(caseName: string, run: () => Promise<void>) {
      it(caseName, run);
    },
    assertions(caseName: string, expected: string, actual: string): Promise<void> {
      expect(actual).toEqual(expected);
      return Promise.resolve();
    },
  });

  runner.run();
});
