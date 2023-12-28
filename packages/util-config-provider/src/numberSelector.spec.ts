import { numberSelector } from "./numberSelector";
import { SelectorType } from "./types";

describe(numberSelector.name, () => {
  const key = "key";
  const obj: { [key]: any } = {} as any;

  describe.each(Object.entries(SelectorType))(`Selector %s`, (selectorKey, selectorValue) => {
    beforeEach(() => {
      delete obj[key];
    });

    it(`should return undefined if ${key} is not defined`, () => {
      expect(numberSelector(obj, key, SelectorType[selectorKey])).toBeUndefined();
    });

    it.each([
      [0, "0"],
      [1, "1"],
    ])(`should return number %s if ${key}="%s"`, (output, input) => {
      obj[key] = input;
      expect(numberSelector(obj, key, SelectorType[selectorKey])).toBe(output);
    });

    it.each(["yes", "no", undefined, null, void 0, ""])(`should throw if ${key}=%s`, (input) => {
      obj[key] = input;
      expect(() => numberSelector(obj, key, SelectorType[selectorKey])).toThrow(
        new TypeError(`Cannot load ${selectorValue} '${key}'. Expected number, got '${obj[key]}'.`)
      );
    });
  });
});
