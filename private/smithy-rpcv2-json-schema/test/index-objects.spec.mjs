import {
  BigDecimalOperation$,
  BigDecimalOperationCommand,
  BigDecimalStructure$,
  BigIntegerOperation$,
  BigIntegerOperationCommand,
  BigIntegerStructure$,
  ClientOptionalDefaults$,
  ComplexError,
  ComplexError$,
  ComplexNestedErrorData$,
  Defaults$,
  EmptyInputOutput$,
  EmptyInputOutputCommand,
  EmptyStructure$,
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
  RpcV2JsonDenseMaps$,
  RpcV2JsonDenseMapsCommand,
  RpcV2JsonDenseMapsInputOutput$,
  RpcV2JsonListInputOutput$,
  RpcV2JsonLists$,
  RpcV2JsonListsCommand,
  RpcV2JsonProtocol,
  RpcV2JsonProtocolClient,
  RpcV2JsonProtocolServiceException,
  RpcV2JsonSparseMaps$,
  RpcV2JsonSparseMapsCommand,
  RpcV2JsonSparseMapsInputOutput$,
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
  TimestampFormatIgnored$,
  TimestampFormatIgnoredCommand,
  TimestampFormatIgnoredIO$,
  ValidationException,
  ValidationException$,
  ValidationExceptionField$,
} from "../dist-cjs/index.js";
import assert from "node:assert";
// clients
assert(typeof RpcV2JsonProtocolClient === "function");
assert(typeof RpcV2JsonProtocol === "function");
// commands
assert(typeof BigDecimalOperationCommand === "function");
assert(typeof BigDecimalOperation$ === "object");
assert(typeof BigIntegerOperationCommand === "function");
assert(typeof BigIntegerOperation$ === "object");
assert(typeof EmptyInputOutputCommand === "function");
assert(typeof EmptyInputOutput$ === "object");
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
assert(typeof RpcV2JsonDenseMapsCommand === "function");
assert(typeof RpcV2JsonDenseMaps$ === "object");
assert(typeof RpcV2JsonListsCommand === "function");
assert(typeof RpcV2JsonLists$ === "object");
assert(typeof RpcV2JsonSparseMapsCommand === "function");
assert(typeof RpcV2JsonSparseMaps$ === "object");
assert(typeof SimpleScalarPropertiesCommand === "function");
assert(typeof SimpleScalarProperties$ === "object");
assert(typeof SparseNullsOperationCommand === "function");
assert(typeof SparseNullsOperation$ === "object");
assert(typeof TimestampFormatIgnoredCommand === "function");
assert(typeof TimestampFormatIgnored$ === "object");
// structural schemas
assert(typeof ValidationExceptionField$ === "object");
assert(typeof BigDecimalStructure$ === "object");
assert(typeof BigIntegerStructure$ === "object");
assert(typeof ClientOptionalDefaults$ === "object");
assert(typeof ComplexNestedErrorData$ === "object");
assert(typeof Defaults$ === "object");
assert(typeof EmptyStructure$ === "object");
assert(typeof FractionalSecondsOutput$ === "object");
assert(typeof GreetingWithErrorsOutput$ === "object");
assert(typeof OperationWithDefaultsInput$ === "object");
assert(typeof OperationWithDefaultsOutput$ === "object");
assert(typeof RecursiveShapesInputOutput$ === "object");
assert(typeof RecursiveShapesInputOutputNested1$ === "object");
assert(typeof RecursiveShapesInputOutputNested2$ === "object");
assert(typeof RpcV2JsonDenseMapsInputOutput$ === "object");
assert(typeof RpcV2JsonListInputOutput$ === "object");
assert(typeof RpcV2JsonSparseMapsInputOutput$ === "object");
assert(typeof SimpleScalarStructure$ === "object");
assert(typeof SimpleStructure$ === "object");
assert(typeof SparseNullsOperationInputOutput$ === "object");
assert(typeof StructureListMember$ === "object");
assert(typeof TimestampFormatIgnoredIO$ === "object");
assert(typeof GreetingStruct$ === "object");
// enums
assert(typeof TestEnum === "object");
assert(typeof TestIntEnum === "object");
assert(typeof FooEnum === "object");
assert(typeof IntegerEnum === "object");
// errors
assert(ValidationException.prototype instanceof RpcV2JsonProtocolServiceException);
assert(typeof ValidationException$ === "object");
assert(ComplexError.prototype instanceof RpcV2JsonProtocolServiceException);
assert(typeof ComplexError$ === "object");
assert(InvalidGreeting.prototype instanceof RpcV2JsonProtocolServiceException);
assert(typeof InvalidGreeting$ === "object");
assert(RpcV2JsonProtocolServiceException.prototype instanceof Error);
console.log(`RpcV2JsonProtocol index test passed.`);
