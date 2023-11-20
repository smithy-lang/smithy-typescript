import type { Client } from "../client";
import type { HttpHandlerOptions } from "../http";
import type { MetadataBearer } from "../response";
import type { Exact } from "./exact";
import type { AssertiveClient, NoUndefined, UncheckedClient } from "./no-undefined";

type A = {
  a: string;
  b: number | string;
  c: boolean | number | string;
  required: string | undefined;
  optional?: string;
  nested: A;
};

{
  // it should remove undefined union from required fields.
  type T = NoUndefined<A>;

  const assert1: Exact<T["required"], string> = true as const;
  const assert2: Exact<T["nested"]["required"], string> = true as const;
  const assert3: Exact<T["nested"]["nested"]["required"], string> = true as const;
}

{
  type MyInput = {
    a: string | undefined;
    b: number | undefined;
    c: string | number | undefined;
    optional?: string;
  };

  type MyOutput = {
    a?: string;
    b?: number;
    c?: string | number;
    r?: MyOutput;
  } & MetadataBearer;

  type MyConfig = {
    version: number;
  };

  interface MyClient extends Client<MyInput, MyOutput, MyConfig> {
    getObject(args: MyInput, options?: HttpHandlerOptions): Promise<MyOutput>;
    getObject(args: MyInput, cb: (err: any, data?: MyOutput) => void): void;
    getObject(args: MyInput, options: HttpHandlerOptions, cb: (err: any, data?: MyOutput) => void): void;

    putObject(args: MyInput, options?: HttpHandlerOptions): Promise<MyOutput>;
    putObject(args: MyInput, cb: (err: any, data?: MyOutput) => void): void;
    putObject(args: MyInput, options: HttpHandlerOptions, cb: (err: any, data?: MyOutput) => void): void;
  }

  {
    // AssertiveClient should enforce union of undefined on inputs
    // but preserve undefined outputs.
    const c = (null as unknown) as AssertiveClient<MyClient>;
    const input = {
      a: "",
      b: 0,
      c: 0,
    };
    const get = c.getObject(input);
    const output = (null as unknown) as Awaited<typeof get>;

    const assert1: Exact<typeof output.a, string | undefined> = true as const;
    const assert2: Exact<typeof output.b, number | undefined> = true as const;
    const assert3: Exact<typeof output.c, string | number | undefined> = true as const;
    if (output.r) {
      const assert4: Exact<typeof output.r.a, string | undefined> = true as const;
      const assert5: Exact<typeof output.r.b, number | undefined> = true as const;
      const assert6: Exact<typeof output.r.c, string | number | undefined> = true as const;
    }
  }

  {
    // UncheckedClient both removes union-undefined from inputs
    // and the nullability of outputs.
    const c = (null as unknown) as UncheckedClient<MyClient>;
    const input = {
      a: "",
      b: 0,
      c: 0,
    };
    const get = c.getObject(input);
    const output = (null as unknown) as Awaited<typeof get>;

    const assert1: Exact<typeof output.a, string> = true as const;
    const assert2: Exact<typeof output.b, number> = true as const;
    const assert3: Exact<typeof output.c, string | number> = true as const;
    const assert4: Exact<typeof output.r.a, string> = true as const;
    const assert5: Exact<typeof output.r.b, number> = true as const;
    const assert6: Exact<typeof output.r.c, string | number> = true as const;
  }
}
