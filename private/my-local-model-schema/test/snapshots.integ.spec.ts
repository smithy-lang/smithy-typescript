// smithy-typescript generated code
import { SnapshotRunner } from "@smithy/snapshot-testing";
import { join } from "node:path";
import { describe, expect, test as it } from "vitest";

import {
  camelCaseOperation$,
  CamelCaseOperationCommand,
  GetNumbers$,
  GetNumbersCommand,
  HttpLabelCommand$,
  HttpLabelCommandCommand,
  TradeEventStream$,
  TradeEventStreamCommand,
  XYZServiceClient,
} from "..";

const Client = XYZServiceClient;

const mode = (process.env.SNAPSHOT_MODE as "write" | "compare") ?? "write";

describe("XYZServiceClient" + ` (${mode})`, () => {
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
    schemas:
      new Map<any, any>([
        [HttpLabelCommand$, HttpLabelCommandCommand],
        [camelCaseOperation$, CamelCaseOperationCommand],
        [GetNumbers$, GetNumbersCommand],
        [TradeEventStream$, TradeEventStreamCommand],
      ]),

  });

  runner.run();
}, 30_000);
