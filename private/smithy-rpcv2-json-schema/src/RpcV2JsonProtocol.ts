// smithy-typescript generated code
import { createAggregatedClient } from "@smithy/core/client";
import type { HttpHandlerOptions as __HttpHandlerOptions, MetricsRecorder as __MetricsRecorder } from "@smithy/types";

import {
  type BigDecimalOperationCommandInput,
  type BigDecimalOperationCommandOutput,
  BigDecimalOperationCommand,
} from "./commands/BigDecimalOperationCommand";
import {
  type BigIntegerOperationCommandInput,
  type BigIntegerOperationCommandOutput,
  BigIntegerOperationCommand,
} from "./commands/BigIntegerOperationCommand";
import {
  type EmptyInputOutputCommandInput,
  type EmptyInputOutputCommandOutput,
  EmptyInputOutputCommand,
} from "./commands/EmptyInputOutputCommand";
import {
  type FractionalSecondsCommandInput,
  type FractionalSecondsCommandOutput,
  FractionalSecondsCommand,
} from "./commands/FractionalSecondsCommand";
import {
  type GreetingWithErrorsCommandInput,
  type GreetingWithErrorsCommandOutput,
  GreetingWithErrorsCommand,
} from "./commands/GreetingWithErrorsCommand";
import {
  type NoInputOutputCommandInput,
  type NoInputOutputCommandOutput,
  NoInputOutputCommand,
} from "./commands/NoInputOutputCommand";
import {
  type OperationWithDefaultsCommandInput,
  type OperationWithDefaultsCommandOutput,
  OperationWithDefaultsCommand,
} from "./commands/OperationWithDefaultsCommand";
import {
  type OptionalInputOutputCommandInput,
  type OptionalInputOutputCommandOutput,
  OptionalInputOutputCommand,
} from "./commands/OptionalInputOutputCommand";
import {
  type RecursiveShapesCommandInput,
  type RecursiveShapesCommandOutput,
  RecursiveShapesCommand,
} from "./commands/RecursiveShapesCommand";
import {
  type RpcV2JsonDenseMapsCommandInput,
  type RpcV2JsonDenseMapsCommandOutput,
  RpcV2JsonDenseMapsCommand,
} from "./commands/RpcV2JsonDenseMapsCommand";
import {
  type RpcV2JsonListsCommandInput,
  type RpcV2JsonListsCommandOutput,
  RpcV2JsonListsCommand,
} from "./commands/RpcV2JsonListsCommand";
import {
  type RpcV2JsonSparseMapsCommandInput,
  type RpcV2JsonSparseMapsCommandOutput,
  RpcV2JsonSparseMapsCommand,
} from "./commands/RpcV2JsonSparseMapsCommand";
import {
  type SimpleScalarPropertiesCommandInput,
  type SimpleScalarPropertiesCommandOutput,
  SimpleScalarPropertiesCommand,
} from "./commands/SimpleScalarPropertiesCommand";
import {
  type SparseNullsOperationCommandInput,
  type SparseNullsOperationCommandOutput,
  SparseNullsOperationCommand,
} from "./commands/SparseNullsOperationCommand";
import {
  type TimestampFormatIgnoredCommandInput,
  type TimestampFormatIgnoredCommandOutput,
  TimestampFormatIgnoredCommand,
} from "./commands/TimestampFormatIgnoredCommand";
import { RpcV2JsonProtocolClient } from "./RpcV2JsonProtocolClient";

const commands = {
  BigDecimalOperationCommand,
  BigIntegerOperationCommand,
  EmptyInputOutputCommand,
  FractionalSecondsCommand,
  GreetingWithErrorsCommand,
  NoInputOutputCommand,
  OperationWithDefaultsCommand,
  OptionalInputOutputCommand,
  RecursiveShapesCommand,
  RpcV2JsonDenseMapsCommand,
  RpcV2JsonListsCommand,
  RpcV2JsonSparseMapsCommand,
  SimpleScalarPropertiesCommand,
  SparseNullsOperationCommand,
  TimestampFormatIgnoredCommand,
};

/**
 * @public
 */
export interface RpcV2JsonProtocolRequestOptions extends __HttpHandlerOptions {
  metricsRecorder?: __MetricsRecorder<unknown>;
}

export interface RpcV2JsonProtocol {
  /**
   * @see {@link BigDecimalOperationCommand}
   */
  bigDecimalOperation(): Promise<BigDecimalOperationCommandOutput>;
  bigDecimalOperation(
    args: BigDecimalOperationCommandInput,
    options?: RpcV2JsonProtocolRequestOptions
  ): Promise<BigDecimalOperationCommandOutput>;
  bigDecimalOperation(
    args: BigDecimalOperationCommandInput,
    cb: (err: any, data?: BigDecimalOperationCommandOutput) => void
  ): void;
  bigDecimalOperation(
    args: BigDecimalOperationCommandInput,
    options: RpcV2JsonProtocolRequestOptions,
    cb: (err: any, data?: BigDecimalOperationCommandOutput) => void
  ): void;

  /**
   * @see {@link BigIntegerOperationCommand}
   */
  bigIntegerOperation(): Promise<BigIntegerOperationCommandOutput>;
  bigIntegerOperation(
    args: BigIntegerOperationCommandInput,
    options?: RpcV2JsonProtocolRequestOptions
  ): Promise<BigIntegerOperationCommandOutput>;
  bigIntegerOperation(
    args: BigIntegerOperationCommandInput,
    cb: (err: any, data?: BigIntegerOperationCommandOutput) => void
  ): void;
  bigIntegerOperation(
    args: BigIntegerOperationCommandInput,
    options: RpcV2JsonProtocolRequestOptions,
    cb: (err: any, data?: BigIntegerOperationCommandOutput) => void
  ): void;

  /**
   * @see {@link EmptyInputOutputCommand}
   */
  emptyInputOutput(): Promise<EmptyInputOutputCommandOutput>;
  emptyInputOutput(
    args: EmptyInputOutputCommandInput,
    options?: RpcV2JsonProtocolRequestOptions
  ): Promise<EmptyInputOutputCommandOutput>;
  emptyInputOutput(
    args: EmptyInputOutputCommandInput,
    cb: (err: any, data?: EmptyInputOutputCommandOutput) => void
  ): void;
  emptyInputOutput(
    args: EmptyInputOutputCommandInput,
    options: RpcV2JsonProtocolRequestOptions,
    cb: (err: any, data?: EmptyInputOutputCommandOutput) => void
  ): void;

  /**
   * @see {@link FractionalSecondsCommand}
   */
  fractionalSeconds(): Promise<FractionalSecondsCommandOutput>;
  fractionalSeconds(
    args: FractionalSecondsCommandInput,
    options?: RpcV2JsonProtocolRequestOptions
  ): Promise<FractionalSecondsCommandOutput>;
  fractionalSeconds(
    args: FractionalSecondsCommandInput,
    cb: (err: any, data?: FractionalSecondsCommandOutput) => void
  ): void;
  fractionalSeconds(
    args: FractionalSecondsCommandInput,
    options: RpcV2JsonProtocolRequestOptions,
    cb: (err: any, data?: FractionalSecondsCommandOutput) => void
  ): void;

  /**
   * @see {@link GreetingWithErrorsCommand}
   */
  greetingWithErrors(): Promise<GreetingWithErrorsCommandOutput>;
  greetingWithErrors(
    args: GreetingWithErrorsCommandInput,
    options?: RpcV2JsonProtocolRequestOptions
  ): Promise<GreetingWithErrorsCommandOutput>;
  greetingWithErrors(
    args: GreetingWithErrorsCommandInput,
    cb: (err: any, data?: GreetingWithErrorsCommandOutput) => void
  ): void;
  greetingWithErrors(
    args: GreetingWithErrorsCommandInput,
    options: RpcV2JsonProtocolRequestOptions,
    cb: (err: any, data?: GreetingWithErrorsCommandOutput) => void
  ): void;

  /**
   * @see {@link NoInputOutputCommand}
   */
  noInputOutput(): Promise<NoInputOutputCommandOutput>;
  noInputOutput(
    args: NoInputOutputCommandInput,
    options?: RpcV2JsonProtocolRequestOptions
  ): Promise<NoInputOutputCommandOutput>;
  noInputOutput(
    args: NoInputOutputCommandInput,
    cb: (err: any, data?: NoInputOutputCommandOutput) => void
  ): void;
  noInputOutput(
    args: NoInputOutputCommandInput,
    options: RpcV2JsonProtocolRequestOptions,
    cb: (err: any, data?: NoInputOutputCommandOutput) => void
  ): void;

  /**
   * @see {@link OperationWithDefaultsCommand}
   */
  operationWithDefaults(): Promise<OperationWithDefaultsCommandOutput>;
  operationWithDefaults(
    args: OperationWithDefaultsCommandInput,
    options?: RpcV2JsonProtocolRequestOptions
  ): Promise<OperationWithDefaultsCommandOutput>;
  operationWithDefaults(
    args: OperationWithDefaultsCommandInput,
    cb: (err: any, data?: OperationWithDefaultsCommandOutput) => void
  ): void;
  operationWithDefaults(
    args: OperationWithDefaultsCommandInput,
    options: RpcV2JsonProtocolRequestOptions,
    cb: (err: any, data?: OperationWithDefaultsCommandOutput) => void
  ): void;

  /**
   * @see {@link OptionalInputOutputCommand}
   */
  optionalInputOutput(): Promise<OptionalInputOutputCommandOutput>;
  optionalInputOutput(
    args: OptionalInputOutputCommandInput,
    options?: RpcV2JsonProtocolRequestOptions
  ): Promise<OptionalInputOutputCommandOutput>;
  optionalInputOutput(
    args: OptionalInputOutputCommandInput,
    cb: (err: any, data?: OptionalInputOutputCommandOutput) => void
  ): void;
  optionalInputOutput(
    args: OptionalInputOutputCommandInput,
    options: RpcV2JsonProtocolRequestOptions,
    cb: (err: any, data?: OptionalInputOutputCommandOutput) => void
  ): void;

  /**
   * @see {@link RecursiveShapesCommand}
   */
  recursiveShapes(): Promise<RecursiveShapesCommandOutput>;
  recursiveShapes(
    args: RecursiveShapesCommandInput,
    options?: RpcV2JsonProtocolRequestOptions
  ): Promise<RecursiveShapesCommandOutput>;
  recursiveShapes(
    args: RecursiveShapesCommandInput,
    cb: (err: any, data?: RecursiveShapesCommandOutput) => void
  ): void;
  recursiveShapes(
    args: RecursiveShapesCommandInput,
    options: RpcV2JsonProtocolRequestOptions,
    cb: (err: any, data?: RecursiveShapesCommandOutput) => void
  ): void;

  /**
   * @see {@link RpcV2JsonDenseMapsCommand}
   */
  rpcV2JsonDenseMaps(): Promise<RpcV2JsonDenseMapsCommandOutput>;
  rpcV2JsonDenseMaps(
    args: RpcV2JsonDenseMapsCommandInput,
    options?: RpcV2JsonProtocolRequestOptions
  ): Promise<RpcV2JsonDenseMapsCommandOutput>;
  rpcV2JsonDenseMaps(
    args: RpcV2JsonDenseMapsCommandInput,
    cb: (err: any, data?: RpcV2JsonDenseMapsCommandOutput) => void
  ): void;
  rpcV2JsonDenseMaps(
    args: RpcV2JsonDenseMapsCommandInput,
    options: RpcV2JsonProtocolRequestOptions,
    cb: (err: any, data?: RpcV2JsonDenseMapsCommandOutput) => void
  ): void;

  /**
   * @see {@link RpcV2JsonListsCommand}
   */
  rpcV2JsonLists(): Promise<RpcV2JsonListsCommandOutput>;
  rpcV2JsonLists(
    args: RpcV2JsonListsCommandInput,
    options?: RpcV2JsonProtocolRequestOptions
  ): Promise<RpcV2JsonListsCommandOutput>;
  rpcV2JsonLists(
    args: RpcV2JsonListsCommandInput,
    cb: (err: any, data?: RpcV2JsonListsCommandOutput) => void
  ): void;
  rpcV2JsonLists(
    args: RpcV2JsonListsCommandInput,
    options: RpcV2JsonProtocolRequestOptions,
    cb: (err: any, data?: RpcV2JsonListsCommandOutput) => void
  ): void;

  /**
   * @see {@link RpcV2JsonSparseMapsCommand}
   */
  rpcV2JsonSparseMaps(): Promise<RpcV2JsonSparseMapsCommandOutput>;
  rpcV2JsonSparseMaps(
    args: RpcV2JsonSparseMapsCommandInput,
    options?: RpcV2JsonProtocolRequestOptions
  ): Promise<RpcV2JsonSparseMapsCommandOutput>;
  rpcV2JsonSparseMaps(
    args: RpcV2JsonSparseMapsCommandInput,
    cb: (err: any, data?: RpcV2JsonSparseMapsCommandOutput) => void
  ): void;
  rpcV2JsonSparseMaps(
    args: RpcV2JsonSparseMapsCommandInput,
    options: RpcV2JsonProtocolRequestOptions,
    cb: (err: any, data?: RpcV2JsonSparseMapsCommandOutput) => void
  ): void;

  /**
   * @see {@link SimpleScalarPropertiesCommand}
   */
  simpleScalarProperties(): Promise<SimpleScalarPropertiesCommandOutput>;
  simpleScalarProperties(
    args: SimpleScalarPropertiesCommandInput,
    options?: RpcV2JsonProtocolRequestOptions
  ): Promise<SimpleScalarPropertiesCommandOutput>;
  simpleScalarProperties(
    args: SimpleScalarPropertiesCommandInput,
    cb: (err: any, data?: SimpleScalarPropertiesCommandOutput) => void
  ): void;
  simpleScalarProperties(
    args: SimpleScalarPropertiesCommandInput,
    options: RpcV2JsonProtocolRequestOptions,
    cb: (err: any, data?: SimpleScalarPropertiesCommandOutput) => void
  ): void;

  /**
   * @see {@link SparseNullsOperationCommand}
   */
  sparseNullsOperation(): Promise<SparseNullsOperationCommandOutput>;
  sparseNullsOperation(
    args: SparseNullsOperationCommandInput,
    options?: RpcV2JsonProtocolRequestOptions
  ): Promise<SparseNullsOperationCommandOutput>;
  sparseNullsOperation(
    args: SparseNullsOperationCommandInput,
    cb: (err: any, data?: SparseNullsOperationCommandOutput) => void
  ): void;
  sparseNullsOperation(
    args: SparseNullsOperationCommandInput,
    options: RpcV2JsonProtocolRequestOptions,
    cb: (err: any, data?: SparseNullsOperationCommandOutput) => void
  ): void;

  /**
   * @see {@link TimestampFormatIgnoredCommand}
   */
  timestampFormatIgnored(): Promise<TimestampFormatIgnoredCommandOutput>;
  timestampFormatIgnored(
    args: TimestampFormatIgnoredCommandInput,
    options?: RpcV2JsonProtocolRequestOptions
  ): Promise<TimestampFormatIgnoredCommandOutput>;
  timestampFormatIgnored(
    args: TimestampFormatIgnoredCommandInput,
    cb: (err: any, data?: TimestampFormatIgnoredCommandOutput) => void
  ): void;
  timestampFormatIgnored(
    args: TimestampFormatIgnoredCommandInput,
    options: RpcV2JsonProtocolRequestOptions,
    cb: (err: any, data?: TimestampFormatIgnoredCommandOutput) => void
  ): void;
}

/**
 * @public
 */
export class RpcV2JsonProtocol extends RpcV2JsonProtocolClient implements RpcV2JsonProtocol {}
createAggregatedClient(commands, RpcV2JsonProtocol);
