import { describe, expect, test as it } from "vitest";

import { invalidFunction } from "./invalidFunction";

describe("invalidFunction", () => {
  it("throws error with message", () => {
    const message = "Error";
    expect(invalidFunction(message)).toThrowError(new Error(message));
  });
});
