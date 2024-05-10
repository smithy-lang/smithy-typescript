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

{
  // the downlevel should function similarly
  type T = DownlevelTransform<A, number | string, "enum">;

  const assert1: Exact<T["a"], string> = true as const;
  const assert2: Exact<T["b"], "enum"> = true as const;

  const assert3: Exact<T["nested"]["nested"]["nested"]["b"], "enum"> = true as const;
}
