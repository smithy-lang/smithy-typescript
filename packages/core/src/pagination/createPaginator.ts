import type { Client, PaginationConfiguration, Paginator } from "@smithy/types";

/**
 * @internal
 */
const makePagedClientRequest = async <ClientType extends Client<any, any, any>, InputType, OutputType>(
  CommandCtor: any,
  client: ClientType,
  input: InputType,
  ...args: any[]
): Promise<OutputType> => {
  return await client.send(new CommandCtor(input), ...args);
};

/**
 * @internal
 *
 * Creates a paginator.
 */
export function createPaginator<
  PaginationConfigType extends PaginationConfiguration,
  InputType extends object,
  OutputType extends object
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
    let token: any = config.startingToken || undefined;
    let hasNext = true;
    let page: OutputType;

    while (hasNext) {
      (input as any)[inputTokenName] = token;
      if (pageSizeTokenName) {
        (input as any)[pageSizeTokenName] = (input as any)[pageSizeTokenName] ?? config.pageSize;
      }
      if (config.client instanceof ClientCtor) {
        page = await makePagedClientRequest(CommandCtor, config.client, input, ...additionalArguments);
      } else {
        throw new Error(`Invalid client, expected instance of ${ClientCtor.name}`);
      }
      yield page;
      const prevToken = token;
      token = (page as any)[outputTokenName];
      hasNext = !!(token && (!config.stopOnSameToken || token !== prevToken));
    }
    // @ts-ignore
    return undefined;
  };
}
