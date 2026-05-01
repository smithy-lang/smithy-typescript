// smithy-typescript generated code
import {
  type WaiterConfiguration,
  type WaiterResult,
  checkExceptions,
  createWaiter,
  WaiterState,
} from "@smithy/core/client";

import {
  type GetNumbersCommandInput,
  type GetNumbersCommandOutput,
  GetNumbersCommand,
} from "../commands/GetNumbersCommand";
import type { HaltError } from "../models/errors";
import type { XYZServiceSyntheticServiceException } from "../models/XYZServiceSyntheticServiceException";
import type { XYZServiceClient } from "../XYZServiceClient";

const checkState = async (client: XYZServiceClient, input: GetNumbersCommandInput): Promise<WaiterResult<GetNumbersCommandOutput | XYZServiceSyntheticServiceException>> => {
  let reason;
  try {
    let result: GetNumbersCommandOutput & any = await client.send(new GetNumbersCommand(input));
    reason = result;
    return { state: WaiterState.RETRY, reason };
  } catch (exception) {
    reason = exception;
    if (exception.name === "HaltError") {
      return { state: WaiterState.SUCCESS, reason };
    }
  }
  return { state: WaiterState.RETRY, reason };
};
/**
 * wait until the numbers don't align
 *  @deprecated Use waitUntilNumbersMisaligned instead. waitForNumbersMisaligned does not throw error in non-success cases.
 */
export const waitForNumbersMisaligned = async (
  params: WaiterConfiguration<XYZServiceClient>,
  input: GetNumbersCommandInput
): Promise<WaiterResult<GetNumbersCommandOutput | XYZServiceSyntheticServiceException>> => {
  const serviceDefaults = { minDelay: 2, maxDelay: 120 };
  return createWaiter({ ...serviceDefaults, ...params }, input, checkState);
};
/**
 * wait until the numbers don't align
 *  @param params - Waiter configuration options.
 *  @param input - The input to GetNumbersCommand for polling.
 */
export const waitUntilNumbersMisaligned = async (
  params: WaiterConfiguration<XYZServiceClient>,
  input: GetNumbersCommandInput
): Promise<WaiterResult<HaltError>> => {
  const serviceDefaults = { minDelay: 2, maxDelay: 120 };
  const result = await createWaiter({ ...serviceDefaults, ...params }, input, checkState);
  return checkExceptions(result) as WaiterResult<HaltError>;
};
