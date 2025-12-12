import {
  ClientOptionalDefaultsSchema,
  ComplexError,
  ComplexErrorSchema,
  ComplexNestedErrorDataSchema,
  DefaultsSchema,
  EmptyInputOutputCommand,
  EmptyInputOutputSchema,
  EmptyStructureSchema,
  Float16Command,
  Float16OutputSchema,
  Float16Schema,
  FooEnum,
  FractionalSecondsCommand,
  FractionalSecondsOutputSchema,
  FractionalSecondsSchema,
  GreetingStructSchema,
  GreetingWithErrorsCommand,
  GreetingWithErrorsOutputSchema,
  GreetingWithErrorsSchema,
  IntegerEnum,
  InvalidGreeting,
  InvalidGreetingSchema,
  NoInputOutputCommand,
  NoInputOutputSchema,
  OperationWithDefaultsCommand,
  OperationWithDefaultsInputSchema,
  OperationWithDefaultsOutputSchema,
  OperationWithDefaultsSchema,
  OptionalInputOutputCommand,
  OptionalInputOutputSchema,
  RecursiveShapesCommand,
  RecursiveShapesInputOutputNested1Schema,
  RecursiveShapesInputOutputNested2Schema,
  RecursiveShapesInputOutputSchema,
  RecursiveShapesSchema,
  RpcV2CborDenseMapsCommand,
  RpcV2CborDenseMapsInputOutputSchema,
  RpcV2CborDenseMapsSchema,
  RpcV2CborListInputOutputSchema,
  RpcV2CborListsCommand,
  RpcV2CborListsSchema,
  RpcV2CborSparseMapsCommand,
  RpcV2CborSparseMapsInputOutputSchema,
  RpcV2CborSparseMapsSchema,
  RpcV2Protocol,
  RpcV2ProtocolClient,
  RpcV2ProtocolServiceException,
  SimpleScalarPropertiesCommand,
  SimpleScalarPropertiesSchema,
  SimpleScalarStructureSchema,
  SimpleStructureSchema,
  SparseNullsOperationCommand,
  SparseNullsOperationInputOutputSchema,
  SparseNullsOperationSchema,
  StructureListMemberSchema,
  TestEnum,
  TestIntEnum,
  ValidationException,
  ValidationExceptionFieldSchema,
  ValidationExceptionSchema,
} from "../dist-cjs/index.js";
import assert from "node:assert";
// clients
assert(typeof RpcV2ProtocolClient === "function");
assert(typeof RpcV2Protocol === "function");
// commands
assert(typeof EmptyInputOutputCommand === "function");
assert(typeof EmptyInputOutputSchema === "object");
assert(typeof Float16Command === "function");
assert(typeof Float16Schema === "object");
assert(typeof FractionalSecondsCommand === "function");
assert(typeof FractionalSecondsSchema === "object");
assert(typeof GreetingWithErrorsCommand === "function");
assert(typeof GreetingWithErrorsSchema === "object");
assert(typeof NoInputOutputCommand === "function");
assert(typeof NoInputOutputSchema === "object");
assert(typeof OperationWithDefaultsCommand === "function");
assert(typeof OperationWithDefaultsSchema === "object");
assert(typeof OptionalInputOutputCommand === "function");
assert(typeof OptionalInputOutputSchema === "object");
assert(typeof RecursiveShapesCommand === "function");
assert(typeof RecursiveShapesSchema === "object");
assert(typeof RpcV2CborDenseMapsCommand === "function");
assert(typeof RpcV2CborDenseMapsSchema === "object");
assert(typeof RpcV2CborListsCommand === "function");
assert(typeof RpcV2CborListsSchema === "object");
assert(typeof RpcV2CborSparseMapsCommand === "function");
assert(typeof RpcV2CborSparseMapsSchema === "object");
assert(typeof SimpleScalarPropertiesCommand === "function");
assert(typeof SimpleScalarPropertiesSchema === "object");
assert(typeof SparseNullsOperationCommand === "function");
assert(typeof SparseNullsOperationSchema === "object");
// structural schemas
assert(typeof ValidationExceptionFieldSchema === "object");
assert(typeof ClientOptionalDefaultsSchema === "object");
assert(typeof ComplexNestedErrorDataSchema === "object");
assert(typeof DefaultsSchema === "object");
assert(typeof EmptyStructureSchema === "object");
assert(typeof Float16OutputSchema === "object");
assert(typeof FractionalSecondsOutputSchema === "object");
assert(typeof GreetingWithErrorsOutputSchema === "object");
assert(typeof OperationWithDefaultsInputSchema === "object");
assert(typeof OperationWithDefaultsOutputSchema === "object");
assert(typeof RecursiveShapesInputOutputSchema === "object");
assert(typeof RecursiveShapesInputOutputNested1Schema === "object");
assert(typeof RecursiveShapesInputOutputNested2Schema === "object");
assert(typeof RpcV2CborDenseMapsInputOutputSchema === "object");
assert(typeof RpcV2CborListInputOutputSchema === "object");
assert(typeof RpcV2CborSparseMapsInputOutputSchema === "object");
assert(typeof SimpleScalarStructureSchema === "object");
assert(typeof SimpleStructureSchema === "object");
assert(typeof SparseNullsOperationInputOutputSchema === "object");
assert(typeof StructureListMemberSchema === "object");
assert(typeof GreetingStructSchema === "object");
// enums
assert(typeof TestEnum === "object");
assert(typeof TestIntEnum === "object");
assert(typeof FooEnum === "object");
assert(typeof IntegerEnum === "object");
// errors
assert(ValidationException.prototype instanceof RpcV2ProtocolServiceException);
assert(typeof ValidationExceptionSchema === "object");
assert(ComplexError.prototype instanceof RpcV2ProtocolServiceException);
assert(typeof ComplexErrorSchema === "object");
assert(InvalidGreeting.prototype instanceof RpcV2ProtocolServiceException);
assert(typeof InvalidGreetingSchema === "object");
assert(RpcV2ProtocolServiceException.prototype instanceof Error);
console.log(`RpcV2Protocol index test passed.`);
