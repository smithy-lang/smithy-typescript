/* eslint-disable @typescript-eslint/no-unused-vars */
import type { Transform as DownlevelTransform } from "../downlevel-ts3.4/transform/type-transform";
import type { Exact } from "./exact";
import type { Transform } from "./type-transform";

type A = {
  a: string;
  b: number | string;
  c: boolean | number | string;
  nested: A;
};

{
  // It should transform exact unions recursively.

  type T = Transform<A, number | string, "enum">;

  const assert1: Exact<T["a"], string> = true as const;
  const assert2: Exact<T["b"], "enum"> = true as const;

  const assert3: Exact<T["nested"]["nested"]["nested"]["b"], "enum"> = true as const;
}

// It should not recurse into SharedArrayBuffer.
type B = {
  typed: SharedArrayBuffer;
  untyped: {
    byteLength: number;
  };
};

// Transform targets number, which is a sub-property type of SharedArrayBuffer (e.g. byteLength).
// If recursion occurred, SharedArrayBuffer's byteLength would be transformed.
type T = Transform<B, number, string>;

const assert1: Exact<T["typed"]["byteLength"], number> = true as const;
const assert2: Exact<T["untyped"]["byteLength"], string> = true as const;

{
  // the downlevel should function similarly
  type T = DownlevelTransform<A, number | string, "enum">;

  const assert1: Exact<T["a"], string> = true as const;
  const assert2: Exact<T["b"], "enum"> = true as const;

  const assert3: Exact<T["nested"]["nested"]["nested"]["b"], "enum"> = true as const;
}
