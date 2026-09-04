// smithy-typescript generated code
import { type WaiterResult, createAggregatedClient } from "@smithy/core/client";
import type {
  HttpHandlerOptions as __HttpHandlerOptions,
  MetricsRecorder as __MetricsRecorder,
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
  type HostPrefixOperationCommandInput,
  type HostPrefixOperationCommandOutput,
  HostPrefixOperationCommand,
} from "./commands/HostPrefixOperationCommand";
import {
  type HttpLabelCommandCommandInput,
  type HttpLabelCommandCommandOutput,
  HttpLabelCommandCommand,
} from "./commands/HttpLabelCommandCommand";
import {
  type PublishEventsCommandInput,
  type PublishEventsCommandOutput,
  PublishEventsCommand,
} from "./commands/PublishEventsCommand";
import {
  type SubscribeToEventsCommandInput,
  type SubscribeToEventsCommandOutput,
  SubscribeToEventsCommand,
} from "./commands/SubscribeToEventsCommand";
import {
  type TradeEventStreamCommandInput,
  type TradeEventStreamCommandOutput,
  TradeEventStreamCommand,
} from "./commands/TradeEventStreamCommand";
import {
  type ValidatedOperationCommandInput,
  type ValidatedOperationCommandOutput,
  ValidatedOperationCommand,
} from "./commands/ValidatedOperationCommand";
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
  HostPrefixOperationCommand,
  PublishEventsCommand,
  SubscribeToEventsCommand,
  TradeEventStreamCommand,
  ValidatedOperationCommand,
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

/**
 * @public
 */
export interface XYZServiceRequestOptions extends __HttpHandlerOptions {
  recorder?: __MetricsRecorder<any>;
}

export interface XYZService {
  /**
   * @see {@link HttpLabelCommandCommand}
   */
  httpLabelCommand(
    args: HttpLabelCommandCommandInput,
    options?: XYZServiceRequestOptions
  ): Promise<HttpLabelCommandCommandOutput>;
  httpLabelCommand(
    args: HttpLabelCommandCommandInput,
    cb: (err: any, data?: HttpLabelCommandCommandOutput) => void
  ): void;
  httpLabelCommand(
    args: HttpLabelCommandCommandInput,
    options: XYZServiceRequestOptions,
    cb: (err: any, data?: HttpLabelCommandCommandOutput) => void
  ): void;

  /**
   * @see {@link CamelCaseOperationCommand}
   */
  camelCaseOperation(): Promise<CamelCaseOperationCommandOutput>;
  camelCaseOperation(
    args: CamelCaseOperationCommandInput,
    options?: XYZServiceRequestOptions
  ): Promise<CamelCaseOperationCommandOutput>;
  camelCaseOperation(
    args: CamelCaseOperationCommandInput,
    cb: (err: any, data?: CamelCaseOperationCommandOutput) => void
  ): void;
  camelCaseOperation(
    args: CamelCaseOperationCommandInput,
    options: XYZServiceRequestOptions,
    cb: (err: any, data?: CamelCaseOperationCommandOutput) => void
  ): void;

  /**
   * @see {@link GetNumbersCommand}
   */
  getNumbers(): Promise<GetNumbersCommandOutput>;
  getNumbers(
    args: GetNumbersCommandInput,
    options?: XYZServiceRequestOptions
  ): Promise<GetNumbersCommandOutput>;
  getNumbers(
    args: GetNumbersCommandInput,
    cb: (err: any, data?: GetNumbersCommandOutput) => void
  ): void;
  getNumbers(
    args: GetNumbersCommandInput,
    options: XYZServiceRequestOptions,
    cb: (err: any, data?: GetNumbersCommandOutput) => void
  ): void;

  /**
   * @see {@link HostPrefixOperationCommand}
   */
  hostPrefixOperation(
    args: HostPrefixOperationCommandInput,
    options?: XYZServiceRequestOptions
  ): Promise<HostPrefixOperationCommandOutput>;
  hostPrefixOperation(
    args: HostPrefixOperationCommandInput,
    cb: (err: any, data?: HostPrefixOperationCommandOutput) => void
  ): void;
  hostPrefixOperation(
    args: HostPrefixOperationCommandInput,
    options: XYZServiceRequestOptions,
    cb: (err: any, data?: HostPrefixOperationCommandOutput) => void
  ): void;

  /**
   * @see {@link PublishEventsCommand}
   */
  publishEvents(): Promise<PublishEventsCommandOutput>;
  publishEvents(
    args: PublishEventsCommandInput,
    options?: __HttpHandlerOptions
  ): Promise<PublishEventsCommandOutput>;
  publishEvents(
    args: PublishEventsCommandInput,
    cb: (err: any, data?: PublishEventsCommandOutput) => void
  ): void;
  publishEvents(
    args: PublishEventsCommandInput,
    options: __HttpHandlerOptions,
    cb: (err: any, data?: PublishEventsCommandOutput) => void
  ): void;

  /**
   * @see {@link SubscribeToEventsCommand}
   */
  subscribeToEvents(): Promise<SubscribeToEventsCommandOutput>;
  subscribeToEvents(
    args: SubscribeToEventsCommandInput,
    options?: __HttpHandlerOptions
  ): Promise<SubscribeToEventsCommandOutput>;
  subscribeToEvents(
    args: SubscribeToEventsCommandInput,
    cb: (err: any, data?: SubscribeToEventsCommandOutput) => void
  ): void;
  subscribeToEvents(
    args: SubscribeToEventsCommandInput,
    options: __HttpHandlerOptions,
    cb: (err: any, data?: SubscribeToEventsCommandOutput) => void
  ): void;

  /**
   * @see {@link TradeEventStreamCommand}
   */
  tradeEventStream(): Promise<TradeEventStreamCommandOutput>;
  tradeEventStream(
    args: TradeEventStreamCommandInput,
    options?: XYZServiceRequestOptions
  ): Promise<TradeEventStreamCommandOutput>;
  tradeEventStream(
    args: TradeEventStreamCommandInput,
    cb: (err: any, data?: TradeEventStreamCommandOutput) => void
  ): void;
  tradeEventStream(
    args: TradeEventStreamCommandInput,
    options: XYZServiceRequestOptions,
    cb: (err: any, data?: TradeEventStreamCommandOutput) => void
  ): void;

  /**
   * @see {@link ValidatedOperationCommand}
   */
  validatedOperation(): Promise<ValidatedOperationCommandOutput>;
  validatedOperation(
    args: ValidatedOperationCommandInput,
    options?: __HttpHandlerOptions
  ): Promise<ValidatedOperationCommandOutput>;
  validatedOperation(
    args: ValidatedOperationCommandInput,
    cb: (err: any, data?: ValidatedOperationCommandOutput) => void
  ): void;
  validatedOperation(
    args: ValidatedOperationCommandInput,
    options: __HttpHandlerOptions,
    cb: (err: any, data?: ValidatedOperationCommandOutput) => void
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
