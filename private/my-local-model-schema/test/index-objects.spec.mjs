import {
  AlphaSchema,
  CodedThrottlingError,
  CodedThrottlingErrorSchema,
  GetNumbersCommand,
  GetNumbersRequestSchema,
  GetNumbersResponseSchema,
  GetNumbersSchema,
  HaltError,
  HaltErrorSchema,
  MainServiceLinkedError,
  MainServiceLinkedErrorSchema,
  MysteryThrottlingError,
  MysteryThrottlingErrorSchema,
  RetryableError,
  RetryableErrorSchema,
  TradeEventStreamCommand,
  TradeEventStreamRequestSchema,
  TradeEventStreamResponseSchema,
  TradeEventStreamSchema,
  TradeEventsSchema,
  XYZService,
  XYZServiceClient,
  XYZServiceServiceException,
  XYZServiceServiceExceptionSchema,
  XYZServiceSyntheticServiceException,
} from "../dist-cjs/index.js";
import assert from "node:assert";
// clients
assert(typeof XYZServiceClient === "function");
assert(typeof XYZService === "function");
// commands
assert(typeof GetNumbersCommand === "function");
assert(typeof GetNumbersSchema === "object");
assert(typeof TradeEventStreamCommand === "function");
assert(typeof TradeEventStreamSchema === "object");
// structural schemas
assert(typeof AlphaSchema === "object");
assert(typeof GetNumbersRequestSchema === "object");
assert(typeof GetNumbersResponseSchema === "object");
assert(typeof TradeEventsSchema === "object");
assert(typeof TradeEventStreamRequestSchema === "object");
assert(typeof TradeEventStreamResponseSchema === "object");
// errors
assert(CodedThrottlingError.prototype instanceof XYZServiceSyntheticServiceException);
assert(typeof CodedThrottlingErrorSchema === "object");
assert(HaltError.prototype instanceof XYZServiceSyntheticServiceException);
assert(typeof HaltErrorSchema === "object");
assert(MainServiceLinkedError.prototype instanceof XYZServiceSyntheticServiceException);
assert(typeof MainServiceLinkedErrorSchema === "object");
assert(MysteryThrottlingError.prototype instanceof XYZServiceSyntheticServiceException);
assert(typeof MysteryThrottlingErrorSchema === "object");
assert(RetryableError.prototype instanceof XYZServiceSyntheticServiceException);
assert(typeof RetryableErrorSchema === "object");
assert(XYZServiceServiceException.prototype instanceof XYZServiceSyntheticServiceException);
assert(typeof XYZServiceServiceExceptionSchema === "object");
assert(XYZServiceSyntheticServiceException.prototype instanceof Error);
console.log(`XYZService index test passed.`);
