// smithy-typescript generated code
import { type WaiterResult, createAggregatedClient } from "@smithy/core/client";
import type {
  HttpHandlerOptions as __HttpHandlerOptions,
  PaginationConfiguration,
  Paginator,
  WaiterConfiguration,
} from "@smithy/types";

import {
  type CamelCaseOperationCommandInput,
  type CamelCaseOperationCommandOutput,
  CamelCaseOperationCommand,
} from "./commands/CamelCaseOperationCommand";
import {
  type GetNumbersCommandInput,
  type GetNumbersCommandOutput,
  GetNumbersCommand,
} from "./commands/GetNumbersCommand";
import {
  type HttpLabelCommandCommandInput,
  type HttpLabelCommandCommandOutput,
  HttpLabelCommandCommand,
} from "./commands/HttpLabelCommandCommand";
import {
  type TradeEventStreamCommandInput,
  type TradeEventStreamCommandOutput,
  TradeEventStreamCommand,
} from "./commands/TradeEventStreamCommand";
import type { HaltError } from "./models/errors";
import type { XYZServiceSyntheticServiceException } from "./models/XYZServiceSyntheticServiceException";
import { paginatecamelCaseOperation as paginateCamelCaseOperation } from "./pagination/camelCaseOperationPaginator";
import { paginateGetNumbers } from "./pagination/GetNumbersPaginator";
import { waitUntilNumbersAligned } from "./waiters/waitForNumbersAligned";
import { waitUntilNumbersMisaligned } from "./waiters/waitForNumbersMisaligned";
import { waitUntilNumbersWhatDoTheyDoAnyway } from "./waiters/waitForNumbersWhatDoTheyDoAnyway";
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
  waitUntilNumbersMisaligned,
  waitUntilNumbersWhatDoTheyDoAnyway,
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
  ): Promise<WaiterResult<GetNumbersCommandOutput>>;

  /**
   * @see {@link GetNumbersCommand}
   * @param args - command input.
   * @param waiterConfig - `maxWaitTime` in seconds or waiter config object.
   */
  waitUntilNumbersMisaligned(
    args: GetNumbersCommandInput,
    waiterConfig: number | Omit<WaiterConfiguration<XYZService>, "client">
  ): Promise<WaiterResult<HaltError>>;

  /**
   * @see {@link GetNumbersCommand}
   * @param args - command input.
   * @param waiterConfig - `maxWaitTime` in seconds or waiter config object.
   */
  waitUntilNumbersWhatDoTheyDoAnyway(
    args: GetNumbersCommandInput,
    waiterConfig: number | Omit<WaiterConfiguration<XYZService>, "client">
  ): Promise<WaiterResult<GetNumbersCommandOutput | HaltError>>;
}

/**
 * xyz interfaces
 * @public
 */
export class XYZService extends XYZServiceClient implements XYZService {}
createAggregatedClient(commands, XYZService, { paginators, waiters });
