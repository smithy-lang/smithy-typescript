import type { Transform } from "./type-transform";

type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

// It should transform exact unions recursively.
type A = {
  a: string;
  b: number | string;
  c: boolean | number | string;
  nested: A;
};

type T = Transform<A, number | string, "enum">;

const assert1: Exact<T["a"], string> = true as const;
const assert2: Exact<T["b"], "enum"> = true as const;

const assert3: Exact<T["nested"]["nested"]["nested"]["b"], "enum"> = true as const;
