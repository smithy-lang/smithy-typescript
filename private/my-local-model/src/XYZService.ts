// smithy-typescript generated code
import { createAggregatedClient } from "@smithy/smithy-client";
import type {
  HttpHandlerOptions as __HttpHandlerOptions,
  PaginationConfiguration,
  Paginator,
  WaiterConfiguration,
} from "@smithy/types";
import type { WaiterResult } from "@smithy/util-waiter";

import {
  CamelCaseOperationCommand,
  CamelCaseOperationCommandInput,
  CamelCaseOperationCommandOutput,
} from "./commands/CamelCaseOperationCommand";
import { GetNumbersCommand, GetNumbersCommandInput, GetNumbersCommandOutput } from "./commands/GetNumbersCommand";
import {
  HttpLabelCommandCommand,
  HttpLabelCommandCommandInput,
  HttpLabelCommandCommandOutput,
} from "./commands/HttpLabelCommandCommand";
import {
  TradeEventStreamCommand,
  TradeEventStreamCommandInput,
  TradeEventStreamCommandOutput,
} from "./commands/TradeEventStreamCommand";
import { paginatecamelCaseOperation as paginateCamelCaseOperation } from "./pagination/camelCaseOperationPaginator";
import { paginateGetNumbers } from "./pagination/GetNumbersPaginator";
import { waitUntilNumbersAligned } from "./waiters/waitForNumbersAligned";
import { XYZServiceClient } from "./XYZServiceClient";

const commands = {
  HttpLabelCommandCommand,
  CamelCaseOperationCommand,
  GetNumbersCommand,
  TradeEventStreamCommand,
};
const paginators = {
  paginateCamelCaseOperation,
  paginateGetNumbers,
};
const waiters = {
  waitUntilNumbersAligned,
};

export interface XYZService {
  /**
   * @see {@link HttpLabelCommandCommand}
   */
  httpLabelCommand(
    args: HttpLabelCommandCommandInput,
    options?: __HttpHandlerOptions
  ): Promise<HttpLabelCommandCommandOutput>;
  httpLabelCommand(
    args: HttpLabelCommandCommandInput,
    cb: (err: any, data?: HttpLabelCommandCommandOutput) => void
  ): void;
  httpLabelCommand(
    args: HttpLabelCommandCommandInput,
    options: __HttpHandlerOptions,
    cb: (err: any, data?: HttpLabelCommandCommandOutput) => void
  ): void;

  /**
   * @see {@link CamelCaseOperationCommand}
   */
  camelCaseOperation(): Promise<CamelCaseOperationCommandOutput>;
  camelCaseOperation(
    args: CamelCaseOperationCommandInput,
    options?: __HttpHandlerOptions
  ): Promise<CamelCaseOperationCommandOutput>;
  camelCaseOperation(
    args: CamelCaseOperationCommandInput,
    cb: (err: any, data?: CamelCaseOperationCommandOutput) => void
  ): void;
  camelCaseOperation(
    args: CamelCaseOperationCommandInput,
    options: __HttpHandlerOptions,
    cb: (err: any, data?: CamelCaseOperationCommandOutput) => void
  ): void;

  /**
   * @see {@link GetNumbersCommand}
   */
  getNumbers(): Promise<GetNumbersCommandOutput>;
  getNumbers(
    args: GetNumbersCommandInput,
    options?: __HttpHandlerOptions
  ): Promise<GetNumbersCommandOutput>;
  getNumbers(
    args: GetNumbersCommandInput,
    cb: (err: any, data?: GetNumbersCommandOutput) => void
  ): void;
  getNumbers(
    args: GetNumbersCommandInput,
    options: __HttpHandlerOptions,
    cb: (err: any, data?: GetNumbersCommandOutput) => void
  ): void;

  /**
   * @see {@link TradeEventStreamCommand}
   */
  tradeEventStream(): Promise<TradeEventStreamCommandOutput>;
  tradeEventStream(
    args: TradeEventStreamCommandInput,
    options?: __HttpHandlerOptions
  ): Promise<TradeEventStreamCommandOutput>;
  tradeEventStream(
    args: TradeEventStreamCommandInput,
    cb: (err: any, data?: TradeEventStreamCommandOutput) => void
  ): void;
  tradeEventStream(
    args: TradeEventStreamCommandInput,
    options: __HttpHandlerOptions,
    cb: (err: any, data?: TradeEventStreamCommandOutput) => void
  ): void;

  /**
   * @see {@link CamelCaseOperationCommand}
   * @param args - command input.
   * @param paginationConfig - optional pagination config.
   * @returns AsyncIterable of {@link CamelCaseOperationCommandOutput}.
   */
  paginateCamelCaseOperation(
    args?: CamelCaseOperationCommandInput,
    paginationConfig?: Omit<PaginationConfiguration, "client">
  ): Paginator<CamelCaseOperationCommandOutput>;

  /**
   * @see {@link GetNumbersCommand}
   * @param args - command input.
   * @param paginationConfig - optional pagination config.
   * @returns AsyncIterable of {@link GetNumbersCommandOutput}.
   */
  paginateGetNumbers(
    args?: GetNumbersCommandInput,
    paginationConfig?: Omit<PaginationConfiguration, "client">
  ): Paginator<GetNumbersCommandOutput>;

  /**
   * @see {@link GetNumbersCommand}
   * @param args - command input.
   * @param waiterConfig - `maxWaitTime` in seconds or waiter config object.
   */
  waitUntilNumbersAligned(
    args: GetNumbersCommandInput,
    waiterConfig: number | Omit<WaiterConfiguration<XYZService>, "client">
  ): Promise<WaiterResult>;
}

/**
 * xyz interfaces
 * @public
 */
export class XYZService extends XYZServiceClient implements XYZService {}
createAggregatedClient(commands, XYZService, { paginators, waiters });
