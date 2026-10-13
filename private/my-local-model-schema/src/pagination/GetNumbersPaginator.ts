// smithy-typescript generated code
import { createItemsPaginator, createPaginator } from "@smithy/core";
import type { Paginator } from "@smithy/types";

import { GetNumbersCommand, GetNumbersCommandInput, GetNumbersCommandOutput } from "../commands/GetNumbersCommand";
import { XYZServiceClient } from "../XYZServiceClient";
import type { XYZServicePaginationConfiguration } from "./Interfaces";

/**
 * @public
 */
export const paginateGetNumbers: (
  config: XYZServicePaginationConfiguration,
  input: GetNumbersCommandInput,
  ...rest: any[]
) => Paginator<GetNumbersCommandOutput> = createPaginator<
  XYZServicePaginationConfiguration,
  GetNumbersCommandInput,
  GetNumbersCommandOutput
>(XYZServiceClient, GetNumbersCommand, "startToken", "nextToken", "maxResults");

/**
 * @public
 */
export const paginateGetNumbersItems: (
  config: XYZServicePaginationConfiguration,
  input: GetNumbersCommandInput,
  ...rest: any[]
) => Paginator<number> = createItemsPaginator<
  XYZServicePaginationConfiguration,
  GetNumbersCommandInput,
  number
>(paginateGetNumbers, "numbers");
