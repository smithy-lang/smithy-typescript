/* eslint-disable @typescript-eslint/no-unused-vars */
import type { Client } from "../client";
import type { CommandIO } from "../command";
import type { HttpHandlerOptions } from "../http";
import type { MetadataBearer } from "../response";
import type { DocumentType } from "../shapes";
import type { Exact } from "./exact";
import type { AssertiveClient, NoUndefined, UncheckedClient } from "./no-undefined";

type A = {
  a: string;
  b: number | string;
  c: boolean | number | string;
  required: string | undefined;
  optional?: string;
  nested: A;
  document: DocumentType;
};

{
  // it should remove undefined union from required fields.
  type T = NoUndefined<A>;

  const assert1: Exact<T["required"], string> = true as const;
  const assert2: Exact<T["nested"]["required"], string> = true as const;
  const assert3: Exact<T["nested"]["nested"]["required"], string> = true as const;
  const assert4: Exact<T["document"], DocumentType> = true as const;
  const assert5: Exact<T["nested"]["document"], DocumentType> = true as const;
}

{
  type MyInput = {
    a: string | undefined;
    b: number | undefined;
    c: string | number | undefined;
    optional?: string;
    document: DocumentType | undefined;
  };

  type MyOutput = {
    a?: string;
    b?: number;
    c?: string | number;
    r?: MyOutput;
    document?: DocumentType;
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

    listObjects(): Promise<MyOutput>;
    listObjects(args: MyInput, options?: HttpHandlerOptions): Promise<MyOutput>;
    listObjects(args: MyInput, cb: (err: any, data?: MyOutput) => void): void;
    listObjects(args: MyInput, options: HttpHandlerOptions, cb: (err: any, data?: MyOutput) => void): void;
  }

  {
    // AssertiveClient should enforce union of undefined on inputs
    // but preserve undefined outputs.
    const c = null as unknown as AssertiveClient<MyClient>;
    const input = {
      a: "",
      b: 0,
      c: 0,
      document: { aa: "b" },
    };
    const get = c.getObject(input);
    const output = null as unknown as Awaited<typeof get>;

    const assert1: Exact<typeof output.a, string | undefined> = true as const;
    const assert2: Exact<typeof output.b, number | undefined> = true as const;
    const assert3: Exact<typeof output.c, string | number | undefined> = true as const;
    const assert4: Exact<typeof output.document, DocumentType | undefined> = true as const;
    if (output.r) {
      const assert5: Exact<typeof output.r.a, string | undefined> = true as const;
      const assert6: Exact<typeof output.r.b, number | undefined> = true as const;
      const assert7: Exact<typeof output.r.c, string | number | undefined> = true as const;
      const assert8: Exact<typeof output.r.document, DocumentType | undefined> = true as const;
    }
  }

  {
    // UncheckedClient both removes union-undefined from inputs
    // and the nullability of outputs.
    const c = null as unknown as UncheckedClient<MyClient>;
    const input = {
      a: "",
      b: 0,
      c: 0,
      document: { aa: "b" },
    };
    const get = c.getObject(input);
    const output = null as unknown as Awaited<typeof get>;

    const assert1: Exact<typeof output.a, string> = true as const;
    const assert2: Exact<typeof output.b, number> = true as const;
    const assert3: Exact<typeof output.c, string | number> = true as const;
    const assert4: Exact<typeof output.document, DocumentType> = true as const;
    const assert5: Exact<typeof output.r.a, string> = true as const;
    const assert6: Exact<typeof output.r.b, number> = true as const;
    const assert7: Exact<typeof output.r.c, string | number> = true as const;
    const assert8: Exact<typeof output.r.document, DocumentType> = true as const;
  }

  {
    // Handles methods with optionally zero args.
    const c = null as unknown as AssertiveClient<MyClient>;
    const list = c.listObjects();
    const output = null as unknown as Awaited<typeof list>;

    const assert1: Exact<typeof output.a, string | undefined> = true as const;
    const assert2: Exact<typeof output.b, number | undefined> = true as const;
    const assert3: Exact<typeof output.c, string | number | undefined> = true as const;
    const assert4: Exact<typeof output.document, DocumentType | undefined> = true as const;
    if (output.r) {
      const assert5: Exact<typeof output.r.a, string | undefined> = true as const;
      const assert6: Exact<typeof output.r.b, number | undefined> = true as const;
      const assert7: Exact<typeof output.r.c, string | number | undefined> = true as const;
      const assert8: Exact<typeof output.r.document, DocumentType | undefined> = true as const;
    }
  }

  {
    // Works with outputs of the "send" method.
    const c = null as unknown as AssertiveClient<MyClient>;
    const list = c.send(null as unknown as CommandIO<MyInput, MyOutput>);
    const output = null as unknown as Awaited<typeof list>;

    const assert1: Exact<typeof output.a, string | undefined> = true as const;
    const assert2: Exact<typeof output.b, number | undefined> = true as const;
    const assert3: Exact<typeof output.c, string | number | undefined> = true as const;
    const assert4: Exact<typeof output.document, DocumentType | undefined> = true as const;
    if (output.r) {
      const assert5: Exact<typeof output.r.a, string | undefined> = true as const;
      const assert6: Exact<typeof output.r.b, number | undefined> = true as const;
      const assert7: Exact<typeof output.r.c, string | number | undefined> = true as const;
      const assert8: Exact<typeof output.r.document, DocumentType | undefined> = true as const;
    }
  }
}
