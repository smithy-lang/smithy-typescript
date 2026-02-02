import {
  Alpha$,
  camelCaseOperation$,
  CamelCaseOperationCommand,
  camelCaseOperationInput$,
  camelCaseOperationOutput$,
  CodedThrottlingError,
  CodedThrottlingError$,
  GetNumbers$,
  GetNumbersCommand,
  GetNumbersRequest$,
  GetNumbersResponse$,
  HaltError,
  HaltError$,
  HttpLabelCommand$,
  HttpLabelCommandCommand,
  HttpLabelCommandInput$,
  HttpLabelCommandOutput$,
  MainServiceLinkedError,
  MainServiceLinkedError$,
  MysteryThrottlingError,
  MysteryThrottlingError$,
  paginatecamelCaseOperation,
  paginateGetNumbers,
  RetryableError,
  RetryableError$,
  TradeEvents$,
  TradeEventStream$,
  TradeEventStreamCommand,
  TradeEventStreamRequest$,
  TradeEventStreamResponse$,
  waitForNumbersAligned,
  waitUntilNumbersAligned,
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
assert(typeof HttpLabelCommandCommand === "function");
assert(typeof HttpLabelCommand$ === "object");
assert(typeof CamelCaseOperationCommand === "function");
assert(typeof camelCaseOperation$ === "object");
assert(typeof GetNumbersCommand === "function");
assert(typeof GetNumbers$ === "object");
assert(typeof TradeEventStreamCommand === "function");
assert(typeof TradeEventStream$ === "object");
// structural schemas
assert(typeof HttpLabelCommandInput$ === "object");
assert(typeof HttpLabelCommandOutput$ === "object");
assert(typeof Alpha$ === "object");
assert(typeof camelCaseOperationInput$ === "object");
assert(typeof camelCaseOperationOutput$ === "object");
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
// waiters
assert(typeof waitForNumbersAligned === "function");
assert(typeof waitUntilNumbersAligned === "function");
// paginators
assert(typeof paginateGetNumbers === "function");
assert(typeof paginatecamelCaseOperation === "function");
console.log(`XYZService index test passed.`);
