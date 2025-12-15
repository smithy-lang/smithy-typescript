import {
  ClientOptionalDefaults$,
  ComplexError,
  ComplexError$,
  ComplexNestedErrorData$,
  Defaults$,
  EmptyInputOutput$,
  EmptyInputOutputCommand,
  EmptyStructure$,
  Float16$,
  Float16Command,
  Float16Output$,
  FooEnum,
  FractionalSeconds$,
  FractionalSecondsCommand,
  FractionalSecondsOutput$,
  GreetingStruct$,
  GreetingWithErrors$,
  GreetingWithErrorsCommand,
  GreetingWithErrorsOutput$,
  IntegerEnum,
  InvalidGreeting,
  InvalidGreeting$,
  NoInputOutput$,
  NoInputOutputCommand,
  OperationWithDefaults$,
  OperationWithDefaultsCommand,
  OperationWithDefaultsInput$,
  OperationWithDefaultsOutput$,
  OptionalInputOutput$,
  OptionalInputOutputCommand,
  RecursiveShapes$,
  RecursiveShapesCommand,
  RecursiveShapesInputOutput$,
  RecursiveShapesInputOutputNested1$,
  RecursiveShapesInputOutputNested2$,
  RpcV2CborDenseMaps$,
  RpcV2CborDenseMapsCommand,
  RpcV2CborDenseMapsInputOutput$,
  RpcV2CborListInputOutput$,
  RpcV2CborLists$,
  RpcV2CborListsCommand,
  RpcV2CborSparseMaps$,
  RpcV2CborSparseMapsCommand,
  RpcV2CborSparseMapsInputOutput$,
  RpcV2Protocol,
  RpcV2ProtocolClient,
  RpcV2ProtocolServiceException,
  SimpleScalarProperties$,
  SimpleScalarPropertiesCommand,
  SimpleScalarStructure$,
  SimpleStructure$,
  SparseNullsOperation$,
  SparseNullsOperationCommand,
  SparseNullsOperationInputOutput$,
  StructureListMember$,
  TestEnum,
  TestIntEnum,
  ValidationException,
  ValidationException$,
  ValidationExceptionField$,
} from "../dist-cjs/index.js";
import assert from "node:assert";
// clients
assert(typeof RpcV2ProtocolClient === "function");
assert(typeof RpcV2Protocol === "function");
// commands
assert(typeof EmptyInputOutputCommand === "function");
assert(typeof EmptyInputOutput$ === "object");
assert(typeof Float16Command === "function");
assert(typeof Float16$ === "object");
assert(typeof FractionalSecondsCommand === "function");
assert(typeof FractionalSeconds$ === "object");
assert(typeof GreetingWithErrorsCommand === "function");
assert(typeof GreetingWithErrors$ === "object");
assert(typeof NoInputOutputCommand === "function");
assert(typeof NoInputOutput$ === "object");
assert(typeof OperationWithDefaultsCommand === "function");
assert(typeof OperationWithDefaults$ === "object");
assert(typeof OptionalInputOutputCommand === "function");
assert(typeof OptionalInputOutput$ === "object");
assert(typeof RecursiveShapesCommand === "function");
assert(typeof RecursiveShapes$ === "object");
assert(typeof RpcV2CborDenseMapsCommand === "function");
assert(typeof RpcV2CborDenseMaps$ === "object");
assert(typeof RpcV2CborListsCommand === "function");
assert(typeof RpcV2CborLists$ === "object");
assert(typeof RpcV2CborSparseMapsCommand === "function");
assert(typeof RpcV2CborSparseMaps$ === "object");
assert(typeof SimpleScalarPropertiesCommand === "function");
assert(typeof SimpleScalarProperties$ === "object");
assert(typeof SparseNullsOperationCommand === "function");
assert(typeof SparseNullsOperation$ === "object");
// structural schemas
assert(typeof ValidationExceptionField$ === "object");
assert(typeof ClientOptionalDefaults$ === "object");
assert(typeof ComplexNestedErrorData$ === "object");
assert(typeof Defaults$ === "object");
assert(typeof EmptyStructure$ === "object");
assert(typeof Float16Output$ === "object");
assert(typeof FractionalSecondsOutput$ === "object");
assert(typeof GreetingWithErrorsOutput$ === "object");
assert(typeof OperationWithDefaultsInput$ === "object");
assert(typeof OperationWithDefaultsOutput$ === "object");
assert(typeof RecursiveShapesInputOutput$ === "object");
assert(typeof RecursiveShapesInputOutputNested1$ === "object");
assert(typeof RecursiveShapesInputOutputNested2$ === "object");
assert(typeof RpcV2CborDenseMapsInputOutput$ === "object");
assert(typeof RpcV2CborListInputOutput$ === "object");
assert(typeof RpcV2CborSparseMapsInputOutput$ === "object");
assert(typeof SimpleScalarStructure$ === "object");
assert(typeof SimpleStructure$ === "object");
assert(typeof SparseNullsOperationInputOutput$ === "object");
assert(typeof StructureListMember$ === "object");
assert(typeof GreetingStruct$ === "object");
// enums
assert(typeof TestEnum === "object");
assert(typeof TestIntEnum === "object");
assert(typeof FooEnum === "object");
assert(typeof IntegerEnum === "object");
// errors
assert(ValidationException.prototype instanceof RpcV2ProtocolServiceException);
assert(typeof ValidationException$ === "object");
assert(ComplexError.prototype instanceof RpcV2ProtocolServiceException);
assert(typeof ComplexError$ === "object");
assert(InvalidGreeting.prototype instanceof RpcV2ProtocolServiceException);
assert(typeof InvalidGreeting$ === "object");
assert(RpcV2ProtocolServiceException.prototype instanceof Error);
console.log(`RpcV2Protocol index test passed.`);
