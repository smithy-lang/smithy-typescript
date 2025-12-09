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
  XYZServiceSyntheticServiceException,
} from "../dist-cjs/index.js";
import assert from "node:assert";
// clients
assert(typeof XYZServiceClient === "function");
assert(typeof XYZService === "function");
// commands
assert(typeof GetNumbersCommand === "function");
assert(typeof TradeEventStreamCommand === "function");
// errors
assert(CodedThrottlingError.prototype instanceof XYZServiceSyntheticServiceException);
assert(HaltError.prototype instanceof XYZServiceSyntheticServiceException);
assert(MainServiceLinkedError.prototype instanceof XYZServiceSyntheticServiceException);
assert(MysteryThrottlingError.prototype instanceof XYZServiceSyntheticServiceException);
assert(RetryableError.prototype instanceof XYZServiceSyntheticServiceException);
assert(XYZServiceServiceException.prototype instanceof XYZServiceSyntheticServiceException);
assert(XYZServiceSyntheticServiceException.prototype instanceof Error);
console.log(`XYZService index test passed.`);
