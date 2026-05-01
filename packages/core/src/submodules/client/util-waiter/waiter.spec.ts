import { describe, expect, test as it } from "vitest";

import { checkExceptions, WaiterState } from "./waiter";

describe(checkExceptions.name, () => {
  const reason = "generic reason";

  it(`throw AbortError if state is ${WaiterState.ABORTED}`, () => {
    const result = { state: WaiterState.ABORTED, reason };
    expect(() => checkExceptions(result)).toThrowError(JSON.stringify({ ...result, reason: "Request was aborted" }));
  });

  it(`throw TimeoutError if state is ${WaiterState.TIMEOUT}`, () => {
    const result = { state: WaiterState.TIMEOUT, reason };
    expect(() => checkExceptions(result)).toThrowError(JSON.stringify({ ...result, reason: "Waiter has timed out" }));
  });

  it(`throw generic Error if state is ${WaiterState.RETRY}`, () => {
    const result = { state: WaiterState.RETRY, reason };
    expect(() => checkExceptions(result)).toThrow(JSON.stringify(result));
  });

  it(`throw generic Error if state is ${WaiterState.FAILURE}`, () => {
    const result = { state: WaiterState.FAILURE, reason };
    expect(() => checkExceptions(result)).toThrow(JSON.stringify(result));
  });

  it(`return result if state is ${WaiterState.SUCCESS}`, () => {
    const result = { state: WaiterState.SUCCESS };
    expect(checkExceptions(result)).toEqual(result);
  });
});
