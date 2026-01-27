// smithy-typescript generated code
import { createPaginator } from "@smithy/core";
import type { Paginator } from "@smithy/types";

import { GetNumbersCommand, GetNumbersCommandInput, GetNumbersCommandOutput } from "../commands/GetNumbersCommand";
import { XYZServiceClient } from "../XYZServiceClient";
import { XYZServicePaginationConfiguration } from "./Interfaces";

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
