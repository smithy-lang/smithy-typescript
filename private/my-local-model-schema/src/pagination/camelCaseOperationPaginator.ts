// smithy-typescript generated code
import { createItemsPaginator, createPaginator } from "@smithy/core";
import type { Paginator } from "@smithy/types";

import {
  CamelCaseOperationCommand,
  CamelCaseOperationCommandInput,
  CamelCaseOperationCommandOutput,
} from "../commands/CamelCaseOperationCommand";
import { XYZServiceClient } from "../XYZServiceClient";
import type { XYZServicePaginationConfiguration } from "./Interfaces";

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

/**
 * @public
 */
export const paginatecamelCaseOperationItems: (
  config: XYZServicePaginationConfiguration,
  input: CamelCaseOperationCommandInput,
  ...rest: any[]
) => Paginator<Uint8Array> = createItemsPaginator<
  XYZServicePaginationConfiguration,
  CamelCaseOperationCommandInput,
  Uint8Array
>(paginatecamelCaseOperation, "results");
