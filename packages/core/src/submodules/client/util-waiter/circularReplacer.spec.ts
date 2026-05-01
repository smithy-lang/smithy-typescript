import { describe, expect, it } from "vitest";

import { getCircularReplacer } from "./circularReplacer";

describe("getCircularReplacer", () => {
  it("should handle nested circular references", () => {
    const x = {
      a: 1,
      b: 2,
      c: {
        d: {
          e: -1,
          f: 3,
          g: {
            h: -1,
          },
        },
      },
    } as any;

    x.c.d.e = x;
    x.c.d.g.h = x;

    expect(
      JSON.parse(
        JSON.stringify(
          {
            x,
          },
          getCircularReplacer()
        )
      )
    ).toEqual({
      x: {
        a: 1,
        b: 2,
        c: {
          d: {
            e: "[Circular]",
            f: 3,
            g: {
              h: "[Circular]",
            },
          },
        },
      },
    });
  });
});
