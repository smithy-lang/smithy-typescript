// smithy-typescript generated code
import { createAggregatedClient } from "@smithy/smithy-client";
import type { HttpHandlerOptions as __HttpHandlerOptions } from "@smithy/types";

import { GetNumbersCommand, GetNumbersCommandInput, GetNumbersCommandOutput } from "./commands/GetNumbersCommand";
import {
  TradeEventStreamCommand,
  TradeEventStreamCommandInput,
  TradeEventStreamCommandOutput,
} from "./commands/TradeEventStreamCommand";
import { XYZServiceClient } from "./XYZServiceClient";

const commands = {
  GetNumbersCommand,
  TradeEventStreamCommand,
};

export interface XYZService {
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
}

/**
 * xyz interfaces
 * @public
 */
export class XYZService extends XYZServiceClient implements XYZService {}
createAggregatedClient(commands, XYZService);
