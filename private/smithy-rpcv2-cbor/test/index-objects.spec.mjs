import {
  ComplexError,
  EmptyInputOutputCommand,
  Float16Command,
  FooEnum,
  FractionalSecondsCommand,
  GreetingWithErrorsCommand,
  IntegerEnum,
  InvalidGreeting,
  NoInputOutputCommand,
  OperationWithDefaultsCommand,
  OptionalInputOutputCommand,
  RecursiveShapesCommand,
  RpcV2CborDenseMapsCommand,
  RpcV2CborListsCommand,
  RpcV2CborSparseMapsCommand,
  RpcV2Protocol,
  RpcV2ProtocolClient,
  RpcV2ProtocolServiceException,
  SimpleScalarPropertiesCommand,
  SparseNullsOperationCommand,
  TestEnum,
  TestIntEnum,
  ValidationException,
} from "../dist-cjs/index.js";
import assert from "node:assert";
// clients
assert(typeof RpcV2ProtocolClient === "function");
assert(typeof RpcV2Protocol === "function");
// commands
assert(typeof EmptyInputOutputCommand === "function");
assert(typeof Float16Command === "function");
assert(typeof FractionalSecondsCommand === "function");
assert(typeof GreetingWithErrorsCommand === "function");
assert(typeof NoInputOutputCommand === "function");
assert(typeof OperationWithDefaultsCommand === "function");
assert(typeof OptionalInputOutputCommand === "function");
assert(typeof RecursiveShapesCommand === "function");
assert(typeof RpcV2CborDenseMapsCommand === "function");
assert(typeof RpcV2CborListsCommand === "function");
assert(typeof RpcV2CborSparseMapsCommand === "function");
assert(typeof SimpleScalarPropertiesCommand === "function");
assert(typeof SparseNullsOperationCommand === "function");
// structural schemas
// enums
assert(typeof TestEnum === "object");
assert(typeof TestIntEnum === "object");
assert(typeof FooEnum === "object");
assert(typeof IntegerEnum === "object");
// errors
assert(ValidationException.prototype instanceof RpcV2ProtocolServiceException);
assert(ComplexError.prototype instanceof RpcV2ProtocolServiceException);
assert(InvalidGreeting.prototype instanceof RpcV2ProtocolServiceException);
assert(RpcV2ProtocolServiceException.prototype instanceof Error);
console.log(`RpcV2Protocol index test passed.`);
