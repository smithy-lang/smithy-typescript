// smithy-typescript generated code
import { createPaginator } from "@smithy/core";
import type { Paginator } from "@smithy/types";

import {
  CamelCaseOperationCommand,
  CamelCaseOperationCommandInput,
  CamelCaseOperationCommandOutput,
} from "../commands/CamelCaseOperationCommand";
import { XYZServiceClient } from "../XYZServiceClient";
import { XYZServicePaginationConfiguration } from "./Interfaces";

/**
 * @public
 */
export const paginatecamelCaseOperation: (
  config: XYZServicePaginationConfiguration,
  input: CamelCaseOperationCommandInput,
  ...rest: any[]
) => Paginator<CamelCaseOperationCommandOutput> = createPaginator<
  XYZServicePaginationConfiguration,
  CamelCaseOperationCommandInput,
  CamelCaseOperationCommandOutput
>(XYZServiceClient, CamelCaseOperationCommand, "token", "token", "");
