import { afterEach, describe, expect, test as it } from "vitest";

import { errors, SmithyError, SmithyRangeError, SmithyTypeError } from "./errors";

// [container key, class, name, extended built-in]
const cases = [
  ["Error", SmithyError, "SmithyError", Error],
  ["TypeError", SmithyTypeError, "SmithyTypeError", TypeError],
  ["RangeError", SmithyRangeError, "SmithyRangeError", RangeError],
] as const;

describe("errors", () => {
  describe.each(cases)("%s", (key, Class, name, builtIn) => {
    it("has the expected name, $source, message, and prototype chain", () => {
      const error = new Class("PANIC");
      expect(error.name).toBe(name);
      expect(error.$source).toBe("smithy");
      expect(error.message).toBe("PANIC");
      expect(error.stack).toBeDefined();
      expect(error).toBeInstanceOf(Class);
      expect(error).toBeInstanceOf(builtIn);
      expect(error).toBeInstanceOf(Error);
    });

    it("is the default container entry and constructs a real instance", () => {
      expect(errors[key]).toBe(Class);
      expect(new errors[key]("PANIC")).toBeInstanceOf(Class);
    });
  });

  describe("$source brand", () => {
    // A view of the container with `readonly` stripped. `$source` is read-only
    // in its public contract; the owning runtime sets it once, modeled here via
    // this transform.
    type Mutable<T> = { -readonly [K in keyof T]: T[K] };
    const mutableErrors = errors as Mutable<typeof errors>;

    afterEach(() => {
      // Reset to avoid cross-test leakage of the module-singleton brand.
      mutableErrors.$source = "smithy";
    });

    it('defaults to "smithy"', () => {
      expect(errors.$source).toBe("smithy");
    });

    it("stamps the current brand onto errors constructed after it changes", () => {
      mutableErrors.$source = "aws-sdk";

      expect(errors.$source).toBe("aws-sdk");
      expect(new errors.Error("PANIC").$source).toBe("aws-sdk");
      expect(new errors.TypeError("PANIC").$source).toBe("aws-sdk");
      expect(new errors.RangeError("PANIC").$source).toBe("aws-sdk");
    });
  });

  describe("override / injection", () => {
    type Mutable<T> = { -readonly [K in keyof T]: T[K] };
    const mutableErrors = errors as Mutable<typeof errors>;

    const original = errors.Error;

    afterEach(() => {
      // Reset to avoid cross-test leakage of the module-singleton container.
      mutableErrors.Error = original;
    });

    it("emits the injected subclass while preserving the Smithy base instanceof", () => {
      class AwsSdkError extends SmithyError {
        public name = "AwsSdkError";
      }

      mutableErrors.Error = AwsSdkError;

      const error = new errors.Error("PANIC");

      // Real instance (issue #2169), not a plain object.
      expect(error).toBeInstanceOf(AwsSdkError);
      // instanceof of the Smithy base still holds after override.
      expect(error).toBeInstanceOf(SmithyError);
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe("AwsSdkError");
    });
  });
});
