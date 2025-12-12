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
  clientOptionalDefaults,
  complexError,
  complexNestedErrorData,
  defaults,
  emptyInputOutput,
  emptyStructure,
  float16,
  float16Output,
  fractionalSeconds,
  fractionalSecondsOutput,
  greetingStruct,
  greetingWithErrors,
  greetingWithErrorsOutput,
  invalidGreeting,
  noInputOutput,
  operationWithDefaults,
  operationWithDefaultsInput,
  operationWithDefaultsOutput,
  optionalInputOutput,
  recursiveShapes,
  recursiveShapesInputOutput,
  recursiveShapesInputOutputNested1,
  recursiveShapesInputOutputNested2,
  rpcV2CborDenseMaps,
  rpcV2CborDenseMapsInputOutput,
  rpcV2CborListInputOutput,
  rpcV2CborLists,
  rpcV2CborSparseMaps,
  rpcV2CborSparseMapsInputOutput,
  simpleScalarProperties,
  simpleScalarStructure,
  simpleStructure,
  sparseNullsOperation,
  sparseNullsOperationInputOutput,
  structureListMember,
  validationException,
  validationExceptionField,
} from "../dist-cjs/index.js";
import assert from "node:assert";
// clients
assert(typeof RpcV2ProtocolClient === "function");
assert(typeof RpcV2Protocol === "function");
// commands
assert(typeof EmptyInputOutputCommand === "function");
assert(typeof emptyInputOutput === "object");
assert(typeof Float16Command === "function");
assert(typeof float16 === "object");
assert(typeof FractionalSecondsCommand === "function");
assert(typeof fractionalSeconds === "object");
assert(typeof GreetingWithErrorsCommand === "function");
assert(typeof greetingWithErrors === "object");
assert(typeof NoInputOutputCommand === "function");
assert(typeof noInputOutput === "object");
assert(typeof OperationWithDefaultsCommand === "function");
assert(typeof operationWithDefaults === "object");
assert(typeof OptionalInputOutputCommand === "function");
assert(typeof optionalInputOutput === "object");
assert(typeof RecursiveShapesCommand === "function");
assert(typeof recursiveShapes === "object");
assert(typeof RpcV2CborDenseMapsCommand === "function");
assert(typeof rpcV2CborDenseMaps === "object");
assert(typeof RpcV2CborListsCommand === "function");
assert(typeof rpcV2CborLists === "object");
assert(typeof RpcV2CborSparseMapsCommand === "function");
assert(typeof rpcV2CborSparseMaps === "object");
assert(typeof SimpleScalarPropertiesCommand === "function");
assert(typeof simpleScalarProperties === "object");
assert(typeof SparseNullsOperationCommand === "function");
assert(typeof sparseNullsOperation === "object");
// structural schemas
assert(typeof validationExceptionField === "object");
assert(typeof clientOptionalDefaults === "object");
assert(typeof complexNestedErrorData === "object");
assert(typeof defaults === "object");
assert(typeof emptyStructure === "object");
assert(typeof float16Output === "object");
assert(typeof fractionalSecondsOutput === "object");
assert(typeof greetingWithErrorsOutput === "object");
assert(typeof operationWithDefaultsInput === "object");
assert(typeof operationWithDefaultsOutput === "object");
assert(typeof recursiveShapesInputOutput === "object");
assert(typeof recursiveShapesInputOutputNested1 === "object");
assert(typeof recursiveShapesInputOutputNested2 === "object");
assert(typeof rpcV2CborDenseMapsInputOutput === "object");
assert(typeof rpcV2CborListInputOutput === "object");
assert(typeof rpcV2CborSparseMapsInputOutput === "object");
assert(typeof simpleScalarStructure === "object");
assert(typeof simpleStructure === "object");
assert(typeof sparseNullsOperationInputOutput === "object");
assert(typeof structureListMember === "object");
assert(typeof greetingStruct === "object");
// enums
assert(typeof TestEnum === "object");
assert(typeof TestIntEnum === "object");
assert(typeof FooEnum === "object");
assert(typeof IntegerEnum === "object");
// errors
assert(ValidationException.prototype instanceof RpcV2ProtocolServiceException);
assert(typeof validationException === "object");
assert(ComplexError.prototype instanceof RpcV2ProtocolServiceException);
assert(typeof complexError === "object");
assert(InvalidGreeting.prototype instanceof RpcV2ProtocolServiceException);
assert(typeof invalidGreeting === "object");
assert(RpcV2ProtocolServiceException.prototype instanceof Error);
console.log(`RpcV2Protocol index test passed.`);
