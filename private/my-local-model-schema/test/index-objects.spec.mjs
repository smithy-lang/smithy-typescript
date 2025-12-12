import {
  CodedThrottlingError,
  GetNumbersCommand,
  HaltError,
  MainServiceLinkedError,
  MysteryThrottlingError,
  RetryableError,
  TradeEventStreamCommand,
  XYZService,
  XYZServiceClient,
  XYZServiceServiceException,
  XYZServiceServiceException$,
  XYZServiceSyntheticServiceException,
  alpha,
  codedThrottlingError,
  getNumbers,
  getNumbersRequest,
  getNumbersResponse,
  haltError,
  mainServiceLinkedError,
  mysteryThrottlingError,
  retryableError,
  tradeEventStream,
  tradeEventStreamRequest,
  tradeEventStreamResponse,
  tradeEvents,
} from "../dist-cjs/index.js";
import assert from "node:assert";
// clients
assert(typeof XYZServiceClient === "function");
assert(typeof XYZService === "function");
// commands
assert(typeof GetNumbersCommand === "function");
assert(typeof getNumbers === "object");
assert(typeof TradeEventStreamCommand === "function");
assert(typeof tradeEventStream === "object");
// structural schemas
assert(typeof alpha === "object");
assert(typeof getNumbersRequest === "object");
assert(typeof getNumbersResponse === "object");
assert(typeof tradeEvents === "object");
assert(typeof tradeEventStreamRequest === "object");
assert(typeof tradeEventStreamResponse === "object");
// errors
assert(CodedThrottlingError.prototype instanceof XYZServiceSyntheticServiceException);
assert(typeof codedThrottlingError === "object");
assert(HaltError.prototype instanceof XYZServiceSyntheticServiceException);
assert(typeof haltError === "object");
assert(MainServiceLinkedError.prototype instanceof XYZServiceSyntheticServiceException);
assert(typeof mainServiceLinkedError === "object");
assert(MysteryThrottlingError.prototype instanceof XYZServiceSyntheticServiceException);
assert(typeof mysteryThrottlingError === "object");
assert(RetryableError.prototype instanceof XYZServiceSyntheticServiceException);
assert(typeof retryableError === "object");
assert(XYZServiceServiceException.prototype instanceof XYZServiceSyntheticServiceException);
assert(typeof XYZServiceServiceException$ === "object");
assert(XYZServiceSyntheticServiceException.prototype instanceof Error);
console.log(`XYZService index test passed.`);
