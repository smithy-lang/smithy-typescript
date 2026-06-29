/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MetricsRecorder } from "@smithy/types";

/**
 * Invokes a recording callback against the request's {@link MetricsRecorder}, if
 * one is configured.
 *
 * Recording is strictly best-effort observability: a metrics backend that throws
 * (or is misconfigured) must never change the outcome of the request it is
 * observing, so any error from the callback is swallowed.
 *
 * @internal
 */
export const recordSafely = <Native>(
  recorder: MetricsRecorder<Native> | undefined,
  fn: (recorder: MetricsRecorder<Native>) => void
): void => {
  if (!recorder) {
    return;
  }
  try {
    fn(recorder);
  } catch {
    // Metrics are best-effort: a throwing or misconfigured recorder must never
    // change the outcome of the request it is observing, so its error is swallowed.
  }
};

/**
 * Times an async framework step, recording its duration under `name` once it
 * settles. The duration is recorded whether the step resolves or rejects, so a
 * step that throws still contributes the time spent before it failed.
 *
 * @internal
 */
export const recordTimed = async <T, Native>(
  recorder: MetricsRecorder<Native> | undefined,
  name: string,
  fn: () => Promise<T>
): Promise<T> => {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    recordSafely(recorder, (r) => r.addTime(name, performance.now() - start));
  }
};

/**
 * Synchronous counterpart to {@link recordTimed} for steps that do not return a
 * promise (e.g. validation).
 *
 * @internal
 */
export const recordTimedSync = <T, Native>(
  recorder: MetricsRecorder<Native> | undefined,
  name: string,
  fn: () => T
): T => {
  const start = performance.now();
  try {
    return fn();
  } finally {
    recordSafely(recorder, (r) => r.addTime(name, performance.now() - start));
  }
};
