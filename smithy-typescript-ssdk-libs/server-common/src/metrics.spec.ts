/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MetricsRecorder, RequestOutcome } from "@smithy/types";

import { recordSafely, recordTimed, recordTimedSync } from "./metrics";

type RecorderEvent =
  | { type: "begin" }
  | { type: "recordRequestOutcome"; outcome: RequestOutcome; durationMs: number }
  | { type: "addCount"; name: string; value: number }
  | { type: "addTime"; name: string; value: number }
  | { type: "setProperty"; name: string; value: string | null | undefined }
  | { type: "end" };

class FakeRecorder implements MetricsRecorder<unknown> {
  constructor(
    public readonly events: RecorderEvent[],
    private readonly throwOn?: keyof MetricsRecorder<unknown>
  ) {}

  begin(): void {
    this.events.push({ type: "begin" });
    if (this.throwOn === "begin") {
      throw new Error("begin failed");
    }
  }
  end(): void {
    this.events.push({ type: "end" });
  }
  recordRequestOutcome(outcome: RequestOutcome, durationMs: number): void {
    this.events.push({ type: "recordRequestOutcome", outcome, durationMs });
  }
  addCount(name: string, value: number): void {
    this.events.push({ type: "addCount", name, value });
  }
  addTime(name: string, value: number): void {
    this.events.push({ type: "addTime", name, value });
    if (this.throwOn === "addTime") {
      throw new Error("addTime failed");
    }
  }
  addLevel(): void {}
  addMetric(): void {}
  addRatio(): void {}
  setProperty(name: string, value: string | null | undefined): void {
    this.events.push({ type: "setProperty", name, value });
  }
  getMetrics(): unknown {
    return undefined;
  }
}

describe("recordSafely", () => {
  it("is a no-op when no recorder is configured", () => {
    expect(() => recordSafely(undefined, (r) => r.begin())).not.toThrow();
  });

  it("invokes the callback against a configured recorder", () => {
    const events: RecorderEvent[] = [];
    recordSafely(new FakeRecorder(events), (r) => r.begin());
    expect(events).toEqual([{ type: "begin" }]);
  });

  it("swallows an error thrown by the recorder so it cannot fail the request", () => {
    const events: RecorderEvent[] = [];
    const recorder = new FakeRecorder(events, "addTime");
    expect(() => recordSafely(recorder, (r) => r.addTime("ActivityTime", 1))).not.toThrow();
    expect(events).toEqual([{ type: "addTime", name: "ActivityTime", value: 1 }]);
  });
});

describe("recordTimed", () => {
  it("returns the resolved value and records the elapsed time", async () => {
    const events: RecorderEvent[] = [];
    const result = await recordTimed(new FakeRecorder(events), "ActivityTime", () => Promise.resolve("ok"));
    expect(result).toBe("ok");
    const timed = events.find((e) => e.type === "addTime");
    expect(timed).toMatchObject({ name: "ActivityTime" });
    expect((timed as { value: number }).value).toBeGreaterThanOrEqual(0);
  });

  it("records the elapsed time even when the step rejects, and rethrows", async () => {
    const events: RecorderEvent[] = [];
    await expect(
      recordTimed(new FakeRecorder(events), "SerializationTime", () => Promise.reject(new Error("serialize failed")))
    ).rejects.toThrow("serialize failed");
    expect(events.find((e) => e.type === "addTime")).toMatchObject({ name: "SerializationTime" });
  });

  it("is a no-op recorder-side when none is configured but still returns the value", async () => {
    const result = await recordTimed(undefined, "ActivityTime", () => Promise.resolve(42));
    expect(result).toBe(42);
  });

  it("does not let a throwing recorder mask the step result", async () => {
    const events: RecorderEvent[] = [];
    const recorder = new FakeRecorder(events, "addTime");
    const result = await recordTimed(recorder, "ActivityTime", () => Promise.resolve("value"));
    expect(result).toBe("value");
  });
});

describe("recordTimedSync", () => {
  it("returns the value and records the elapsed time", () => {
    const events: RecorderEvent[] = [];
    const result = recordTimedSync(new FakeRecorder(events), "ValidationTime", () => "done");
    expect(result).toBe("done");
    expect(events.find((e) => e.type === "addTime")).toMatchObject({ name: "ValidationTime" });
  });

  it("records the elapsed time even when the step throws, and rethrows", () => {
    const events: RecorderEvent[] = [];
    expect(() =>
      recordTimedSync(new FakeRecorder(events), "ValidationTime", () => {
        throw new Error("validation failed");
      })
    ).toThrow("validation failed");
    expect(events.find((e) => e.type === "addTime")).toMatchObject({ name: "ValidationTime" });
  });
});
