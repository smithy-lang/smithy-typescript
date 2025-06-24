// smithy-typescript generated code
import { XYZServiceClient, XYZServiceClientConfig } from "./XYZServiceClient";
import { GetNumbersCommand, GetNumbersCommandInput, GetNumbersCommandOutput } from "./commands/GetNumbersCommand";
import { createAggregatedClient } from "@smithy/smithy-client";
import { HttpHandlerOptions as __HttpHandlerOptions } from "@smithy/types";

const commands = {
  GetNumbersCommand,
};

export interface XYZService {
  /**
   * @see {@link GetNumbersCommand}
   */
  getNumbers(): Promise<GetNumbersCommandOutput>;
  getNumbers(args: GetNumbersCommandInput, options?: __HttpHandlerOptions): Promise<GetNumbersCommandOutput>;
  getNumbers(args: GetNumbersCommandInput, cb: (err: any, data?: GetNumbersCommandOutput) => void): void;
  getNumbers(
    args: GetNumbersCommandInput,
    options: __HttpHandlerOptions,
    cb: (err: any, data?: GetNumbersCommandOutput) => void
  ): void;
}

/**
 * xyz interfaces
 * @public
 */
export class XYZService extends XYZServiceClient implements XYZService {}
createAggregatedClient(commands, XYZService);
