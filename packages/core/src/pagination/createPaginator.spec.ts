import { PaginationConfiguration } from "@smithy/types";
import { afterEach, describe, expect, test as it, vi } from "vitest";

import { createPaginator } from "./createPaginator";

describe(createPaginator.name, () => {
  class Client {
    private pages = 5;
    async send() {
      if (--this.pages > 0) {
        return {
          outToken: {
            outToken2: {
              outToken3: "TOKEN_VALUE",
            },
          },
        };
      }
      return {};
    }
  }
  class CommandObjectToken {
    public middlewareStack = {
      add: vi.fn(),
      addRelativeTo: vi.fn(),
    };
    public constructor(public input: any) {
      expect(input).toEqual({
        sizeToken: 100,
        inToken: {
          outToken2: {
            outToken3: "TOKEN_VALUE",
          },
        },
      });
    }
  }

  class ClientStringToken {
    private pages = 5;
    async send(command: any) {
      if (--this.pages > 0) {
        return {
          outToken: command.input.inToken,
        };
      }
      return {};
    }
  }
  class CommandStringToken {
    public middlewareStack = {
      add: vi.fn(),
      addRelativeTo: vi.fn(),
    };
    public constructor(public input: any) {
      expect(input).toEqual({
        sizeToken: 100,
        inToken: "TOKEN_VALUE",
      });
    }
  }

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should create a paginator", async () => {
    const paginate = createPaginator<PaginationConfiguration, { inToken?: string }, { outToken: string }>(
      Client,
      CommandObjectToken,
      "inToken",
      "outToken",
      "sizeToken"
    );

    let pages = 0;

    for await (const page of paginate(
      {
        client: new Client() as any,
        pageSize: 100,
        startingToken: {
          outToken2: {
            outToken3: "TOKEN_VALUE",
          },
        },
      },
      {}
    )) {
      pages += 1;
      if (pages === 5) {
        expect(page.outToken).toBeUndefined();
      } else {
        expect(page.outToken).toEqual({
          outToken2: {
            outToken3: "TOKEN_VALUE",
          },
        });
      }
    }

    expect(pages).toEqual(5);
  });

  it("should prioritize token set in paginator config, fallback to token set in input parameters", async () => {
    class CommandExpectPaginatorConfigToken {
      public constructor(public input: any) {
        expect(input).toMatchObject({
          inToken: "abc",
        });
      }
    }
    class CommandExpectOperationInputToken {
      public constructor(public input: any) {
        expect(input).toMatchObject({
          inToken: "xyz",
        });
      }
    }
    {
      const paginate = createPaginator<
        PaginationConfiguration,
        { inToken?: string; sizeToken?: number },
        { outToken: string }
      >(ClientStringToken, CommandExpectPaginatorConfigToken, "inToken", "outToken", "sizeToken");

      let pages = 0;
      const client = new ClientStringToken() as any;

      for await (const page of paginate(
        {
          client,
          startingToken: "abc",
        },
        {
          inToken: "xyz",
        }
      )) {
        pages += 1;
        expect(page).toBeDefined();
      }

      expect(pages).toEqual(5);
    }
    {
      const paginate = createPaginator<
        PaginationConfiguration,
        { inToken?: string; sizeToken?: number },
        { outToken: string }
      >(ClientStringToken, CommandExpectOperationInputToken, "inToken", "outToken", "sizeToken");

      let pages = 0;
      const client = new ClientStringToken() as any;

      for await (const page of paginate(
        {
          client,
        },
        {
          inToken: "xyz",
        }
      )) {
        pages += 1;
        expect(page).toBeDefined();
      }

      expect(pages).toEqual(5);
    }
  });

  it("should prioritize page size set in operation input, fallback to page size set in paginator config (inverted from token priority)", async () => {
    class CommandExpectPaginatorPageSize {
      public constructor(public input: any) {
        expect(input).toMatchObject({
          sizeToken: 100,
        });
      }
    }
    class CommandExpectOperationInputPageSize {
      public constructor(public input: any) {
        expect(input).toMatchObject({
          sizeToken: 99,
        });
      }
    }
    {
      const paginate = createPaginator<
        PaginationConfiguration,
        { inToken?: string; sizeToken?: number },
        { outToken: string }
      >(ClientStringToken, CommandExpectPaginatorPageSize, "inToken", "outToken", "sizeToken");

      let pages = 0;
      const client = new ClientStringToken() as any;

      for await (const page of paginate(
        {
          client,
          pageSize: 100,
        },
        {
          inToken: "abc",
        }
      )) {
        pages += 1;
        expect(page).toBeDefined();
      }

      expect(pages).toEqual(5);
    }
    {
      const paginate = createPaginator<
        PaginationConfiguration,
        { inToken?: string; sizeToken?: number },
        { outToken: string }
      >(ClientStringToken, CommandExpectOperationInputPageSize, "inToken", "outToken", "sizeToken");

      let pages = 0;
      const client = new ClientStringToken() as any;

      for await (const page of paginate(
        {
          client,
          pageSize: 100,
        },
        {
          sizeToken: 99,
          inToken: "abc",
        }
      )) {
        pages += 1;
        expect(page).toBeDefined();
      }

      expect(pages).toEqual(5);
    }
  });

  it("should have the correct AsyncGenerator.TNext type", async () => {
    const paginate = createPaginator<
      PaginationConfiguration,
      { inToken?: string; sizeToken: number },
      {
        outToken: string;
      }
    >(ClientStringToken, CommandStringToken, "inToken", "outToken.outToken2.outToken3", "sizeToken");
    const asyncGenerator = paginate(
      { client: new ClientStringToken() as any },
      { inToken: "TOKEN_VALUE", sizeToken: 100 }
    );

    const { value, done } = await asyncGenerator.next();
    expect(value?.outToken).toBeTypeOf("string");
    expect(done).toBe(false);
  });

  it("should handle deep paths", async () => {
    const paginate = createPaginator<
      PaginationConfiguration,
      { inToken?: string },
      {
        outToken: {
          outToken2: {
            outToken3: string;
          };
        };
      }
    >(Client, CommandStringToken, "inToken", "outToken.outToken2.outToken3", "sizeToken");

    let pages = 0;

    for await (const page of paginate(
      {
        client: new Client() as any,
        pageSize: 100,
        startingToken: "TOKEN_VALUE",
      },
      {}
    )) {
      pages += 1;
      if (pages === 5) {
        expect(page.outToken).toBeUndefined();
      } else {
        expect(page.outToken.outToken2.outToken3).toEqual("TOKEN_VALUE");
      }
    }

    expect(pages).toEqual(5);
  });

  it("should allow modification of the instantiated command", async () => {
    const paginate = createPaginator<PaginationConfiguration, { inToken?: string }, { outToken: string }>(
      Client,
      CommandObjectToken,
      "inToken",
      "outToken",
      "sizeToken"
    );

    let pages = 0;
    const client: any = new Client();
    vi.spyOn(client, "send");
    const config = {
      client,
      pageSize: 100,
      startingToken: {
        outToken2: {
          outToken3: "TOKEN_VALUE",
        },
      },
      withCommand(command) {
        command.middlewareStack.add((next) => (args) => next(args));
        command.middlewareStack.addRelativeTo((next: any) => (args: any) => next(args), {
          toMiddleware: "",
          relation: "before",
        });
        expect(command.middlewareStack.add).toHaveBeenCalledTimes(1);
        expect(command.middlewareStack.addRelativeTo).toHaveBeenCalledTimes(1);
        return command;
      },
    } as Parameters<typeof paginate>[0];
    vi.spyOn(config, "withCommand");

    for await (const page of paginate(config, {})) {
      pages += 1;
      if (pages === 5) {
        expect(page.outToken).toBeUndefined();
      } else {
        expect(page.outToken).toEqual({
          outToken2: {
            outToken3: "TOKEN_VALUE",
          },
        });
      }
    }

    expect(pages).toEqual(5);
    expect(client.send).toHaveBeenCalledTimes(5);
    expect(config.withCommand).toHaveBeenCalledTimes(5);
    expect(config.withCommand).toHaveBeenCalledWith(expect.any(CommandObjectToken));
  });
});
