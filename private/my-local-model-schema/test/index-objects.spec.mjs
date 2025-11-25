import {
  GetNumbersCommand,
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
assert(XYZServiceServiceException.prototype instanceof Error);
console.log(`XYZService index test passed.`);
