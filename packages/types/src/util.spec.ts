import type { Exact, OptionalParameter } from "./util";

type Assignable<LHS, RHS> = [RHS] extends [LHS] ? true : false;

type OptionalInput = {
  key?: string;
  optional?: string;
};

type RequiredInput = {
  key: string | undefined;
  optional?: string;
};

{
  // optional parameter transform of an optional input is not equivalent to exactly 1 parameter.
  type A = [...OptionalParameter<OptionalInput>];
  type B = [OptionalInput];
  type C = [OptionalInput] | [];

  const assert1: Exact<A, B> = false as const;
  const assert2: Exact<A, C> = true as const;

  const assert3: Assignable<A, []> = true as const;
  const assert4: A = [];

  const assert5: Assignable<A, [{ key: "" }]> = true as const;
  const assert6: A = [{ key: "" }];
}

{
  // optional parameter transform of a required input is equivalent to exactly 1 parameter.
  type A = [...OptionalParameter<RequiredInput>];
  type B = [RequiredInput];

  const assert1: Exact<A, B> = true as const;
  const assert2: Assignable<A, []> = false as const;
  const assert3: Assignable<A, [{ key: "" }]> = true as const;
  const assert4: A = [{ key: "" }];
}
