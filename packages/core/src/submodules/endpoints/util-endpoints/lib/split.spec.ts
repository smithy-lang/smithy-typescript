import { describe, expect, test as it } from "vitest";

import { split } from "./split";

describe(split.name, () => {
  it.each<[string, string, number, string[]]>([
    ["a--b--c", "--", 0, ["a", "b", "c"]],
    ["a--b--c", "--", 2, ["a", "b--c"]],
    ["a--b--c", "--", 1, ["a--b--c"]],
    ["", "--", 0, [""]],
    ["--", "--", 0, ["", ""]],
    ["----", "--", 0, ["", "", ""]],
    ["--b--", "--", 0, ["", "b", ""]],
    ["--x-s3--azid--suffix", "--", 0, ["", "x-s3", "azid", "suffix"]],
    ["--x-s3--azid--suffix", "--", 2, ["", "x-s3--azid--suffix"]],
    ["abc", "x", 0, ["abc"]],
    ["mybucket", "--", 1, ["mybucket"]],
  ])("split(%j, %j, %d) returns %j", (value, delimiter, limit, expected) => {
    expect(split(value, delimiter, limit)).toEqual(expected);
  });
});
