// smithy-typescript generated code
import { checkExceptions, createWaiter, WaiterConfiguration, WaiterResult, WaiterState } from "@smithy/util-waiter";

import { GetNumbersCommand, GetNumbersCommandInput, GetNumbersCommandOutput } from "../commands/GetNumbersCommand";
import { XYZServiceClient } from "../XYZServiceClient";

const checkState = async (client: XYZServiceClient, input: GetNumbersCommandInput): Promise<WaiterResult<GetNumbersCommandOutput | Error>> => {
  let reason;
  try {
    let result: GetNumbersCommandOutput & any = await client.send(new GetNumbersCommand(input));
    reason = result;
    return { state: WaiterState.SUCCESS, reason };
  } catch (exception) {
    reason = exception;
    if (exception.name === "MysteryThrottlingError") {
      return { state: WaiterState.RETRY, reason };
    }
    if (exception.name === "HaltError") {
      return { state: WaiterState.FAILURE, reason };
    }
  }
  return { state: WaiterState.RETRY, reason };
};
/**
 * wait until the numbers align
 *  @deprecated Use waitUntilNumbersAligned instead. waitForNumbersAligned does not throw error in non-success cases.
 */
export const waitForNumbersAligned = async (
  params: WaiterConfiguration<XYZServiceClient>,
  input: GetNumbersCommandInput
): Promise<WaiterResult<GetNumbersCommandOutput | Error>> => {
  const serviceDefaults = { minDelay: 2, maxDelay: 120 };
  return createWaiter({ ...serviceDefaults, ...params }, input, checkState);
};
/**
 * wait until the numbers align
 *  @param params - Waiter configuration options.
 *  @param input - The input to GetNumbersCommand for polling.
 */
export const waitUntilNumbersAligned = async (
  params: WaiterConfiguration<XYZServiceClient>,
  input: GetNumbersCommandInput
): Promise<WaiterResult<GetNumbersCommandOutput | Error>> => {
  const serviceDefaults = { minDelay: 2, maxDelay: 120 };
  const result = await createWaiter({ ...serviceDefaults, ...params }, input, checkState);
  return checkExceptions(result);
};
