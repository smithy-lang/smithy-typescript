import {
  CodedThrottlingError,
  GetNumbersCommand,
  HaltError,
  MysteryThrottlingError,
  RetryableError,
  TradeEventStreamCommand,
  XYZService,
  XYZServiceClient,
  XYZServiceServiceException,
} from "../dist-cjs/index.js";
import assert from "node:assert";
// clients
assert(typeof XYZServiceClient === "function");
assert(typeof XYZService === "function");
// commands
assert(typeof GetNumbersCommand === "function");
assert(typeof TradeEventStreamCommand === "function");
// errors
assert(CodedThrottlingError.prototype instanceof XYZServiceServiceException);
assert(HaltError.prototype instanceof XYZServiceServiceException);
assert(MysteryThrottlingError.prototype instanceof XYZServiceServiceException);
assert(RetryableError.prototype instanceof XYZServiceServiceException);
assert(XYZServiceServiceException.prototype instanceof XYZServiceServiceException);
assert(XYZServiceServiceException.prototype instanceof Error);
console.log(`XYZService index test passed.`);
