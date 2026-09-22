import type { Client, Command, PaginationConfiguration, Paginator } from "@smithy/types";

/**
 * @internal
 */
const makePagedClientRequest = async <ClientType extends Client<any, any, any>, InputType, OutputType>(
  CommandCtor: any,
  client: ClientType,
  input: InputType,
  withCommand: (command: Command<any, any, any, any, any>) => typeof command | undefined = (_) => _,
  ...args: any[]
): Promise<OutputType> => {
  let command = new CommandCtor(input);
  command = withCommand(command) ?? command;
  return await client.send(command, ...args);
};

/**
 * Creates a paginator.
 *
 * @internal
 */
export function createPaginator<
  PaginationConfigType extends PaginationConfiguration,
  InputType extends object,
  OutputType extends object,
>(
  ClientCtor: any,
  CommandCtor: any,
  inputTokenName: string,
  outputTokenName: string,
  pageSizeTokenName?: string
): (config: PaginationConfigType, input: InputType, ...additionalArguments: any[]) => Paginator<OutputType> {
  return async function* paginateOperation(
    config: PaginationConfigType,
    input: InputType,
    ...additionalArguments: any[]
  ): Paginator<OutputType> {
    const _input = input as any;
    // for legacy reasons this coalescing order is inverted from that of pageSize.
    let token: any = config.startingToken ?? _input[inputTokenName];
    let hasNext = true;
    let page: OutputType;

    while (hasNext) {
      _input[inputTokenName] = token;
      if (pageSizeTokenName) {
        _input[pageSizeTokenName] = _input[pageSizeTokenName] ?? config.pageSize;
      }
      if (config.client instanceof ClientCtor) {
        page = await makePagedClientRequest(
          CommandCtor,
          config.client,
          input,
          config.withCommand,
          ...additionalArguments
        );
      } else {
        throw new Error(`Invalid client, expected instance of ${ClientCtor.name}`);
      }
      yield page;
      const prevToken = token;
      token = get(page, outputTokenName);
      hasNext = !!(token && (!config.stopOnSameToken || token !== prevToken));
    }
    return undefined;
  };
}

/**
 * Creates an item-level paginator by wrapping a page-level paginator and
 * yielding the elements of each page's items member instead of the pages.
 *
 * Delegating to the page paginator preserves token handling, pageSize,
 * withCommand, and stopOnSameToken behavior.
 *
 * @internal
 */
export function createItemsPaginator<
  PaginationConfigType extends PaginationConfiguration,
  InputType extends object,
  ItemType,
>(
  paginator: (config: PaginationConfigType, input: InputType, ...additionalArguments: any[]) => Paginator<any>,
  itemsPath: string
): (config: PaginationConfigType, input: InputType, ...additionalArguments: any[]) => Paginator<ItemType> {
  return async function* paginateItems(
    config: PaginationConfigType,
    input: InputType,
    ...additionalArguments: any[]
  ): Paginator<ItemType> {
    for await (const page of paginator(config, input, ...additionalArguments)) {
      const items = get(page, itemsPath);
      if (items == null) {
        continue;
      }
      if (Array.isArray(items)) {
        yield* items;
      } else if (typeof items === "object") {
        // Map-typed items member: yield each [key, value] entry.
        yield* Object.entries(items) as ItemType[];
      } else {
        yield items;
      }
    }
    return undefined;
  };
}

/**
 * @internal
 */
export const get = (fromObject: any, path: string): any => {
  let cursor = fromObject;
  const pathComponents = path.split(".");
  for (const step of pathComponents) {
    if (!cursor || typeof cursor !== "object") {
      return undefined;
    }
    cursor = cursor[step];
  }
  return cursor;
};
