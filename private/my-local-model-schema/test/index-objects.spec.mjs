import {
  Alpha$,
  CodedThrottlingError,
  CodedThrottlingError$,
  GetNumbers$,
  GetNumbersCommand,
  GetNumbersRequest$,
  GetNumbersResponse$,
  HaltError,
  HaltError$,
  MainServiceLinkedError,
  MainServiceLinkedError$,
  MysteryThrottlingError,
  MysteryThrottlingError$,
  RetryableError,
  RetryableError$,
  TradeEvents$,
  TradeEventStream$,
  TradeEventStreamCommand,
  TradeEventStreamRequest$,
  TradeEventStreamResponse$,
  XYZService,
  XYZServiceClient,
  XYZServiceServiceException,
  XYZServiceServiceException$,
  XYZServiceSyntheticServiceException,
} from "../dist-cjs/index.js";
import assert from "node:assert";
// clients
assert(typeof XYZServiceClient === "function");
assert(typeof XYZService === "function");
// commands
assert(typeof GetNumbersCommand === "function");
assert(typeof GetNumbers$ === "object");
assert(typeof TradeEventStreamCommand === "function");
assert(typeof TradeEventStream$ === "object");
// structural schemas
assert(typeof Alpha$ === "object");
assert(typeof GetNumbersRequest$ === "object");
assert(typeof GetNumbersResponse$ === "object");
assert(typeof TradeEvents$ === "object");
assert(typeof TradeEventStreamRequest$ === "object");
assert(typeof TradeEventStreamResponse$ === "object");
// errors
assert(CodedThrottlingError.prototype instanceof XYZServiceSyntheticServiceException);
assert(typeof CodedThrottlingError$ === "object");
assert(HaltError.prototype instanceof XYZServiceSyntheticServiceException);
assert(typeof HaltError$ === "object");
assert(MainServiceLinkedError.prototype instanceof XYZServiceSyntheticServiceException);
assert(typeof MainServiceLinkedError$ === "object");
assert(MysteryThrottlingError.prototype instanceof XYZServiceSyntheticServiceException);
assert(typeof MysteryThrottlingError$ === "object");
assert(RetryableError.prototype instanceof XYZServiceSyntheticServiceException);
assert(typeof RetryableError$ === "object");
assert(XYZServiceServiceException.prototype instanceof XYZServiceSyntheticServiceException);
assert(typeof XYZServiceServiceException$ === "object");
assert(XYZServiceSyntheticServiceException.prototype instanceof Error);
console.log(`XYZService index test passed.`);
