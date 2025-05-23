import { beforeEach, describe, expect, test as it } from "vitest";

import { booleanSelector } from "./booleanSelector";
import { SelectorType } from "./types";

describe(booleanSelector.name, () => {
  const key = "key";
  const obj: { [key]: any } = {} as any;

  describe.each(Object.entries(SelectorType))(`Selector %s`, (selectorKey, selectorValue) => {
    beforeEach(() => {
      delete obj[key];
    });

    it(`should return undefined if ${key} is not defined`, () => {
      expect(booleanSelector(obj, key, SelectorType[selectorKey as keyof typeof SelectorType])).toBeUndefined();
    });

    it.each([
      [true, "true"],
      [false, "false"],
    ])(`should return boolean %s if ${key}="%s"`, (output, input) => {
      obj[key] = input;
      expect(booleanSelector(obj, key, SelectorType[selectorKey as keyof typeof SelectorType])).toBe(output);
    });

    it.each(["0", "1", "yes", "no", undefined, null, void 0, ""])(`should throw if ${key}=%s`, (input) => {
      obj[key] = input;
      expect(() => booleanSelector(obj, key, SelectorType[selectorKey as keyof typeof SelectorType])).toThrow(
        `Cannot load ${selectorValue} "${key}". Expected "true" or "false", got ${obj[key]}.`
      );
    });
  });
});
