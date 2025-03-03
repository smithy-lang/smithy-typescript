import { EndpointV2 } from "../endpoint";
import { HandlerExecutionContext } from "../middleware";
import { MetadataBearer } from "../response";
import { SerdeContext } from "../serde";
import type {
  BigDecimalSchema,
  BigIntegerSchema,
  BlobSchema,
  BooleanSchema,
  DocumentSchema,
  NumericSchema,
  StreamingBlobSchema,
  StringSchema,
  TimestampDateTimeSchema,
  TimestampDefaultSchema,
  TimestampEpochSecondsSchema,
  TimestampHttpDateSchema,
} from "./sentinels";

/**
 * Sentinel value for Timestamp schema.
 * "time" means unspecified and to use the protocol serializer's default format.
 *
 * @public
 */
export type TimestampSchemas =
  | TimestampDefaultSchema
  | TimestampDateTimeSchema
  | TimestampHttpDateSchema
  | TimestampEpochSecondsSchema
  | string;

/**
 * Sentinel values for Blob schema.
 * @public
 */
export type BlobSchemas = BlobSchema | StreamingBlobSchema;

/**
 * Signal value for operation Unit input or output.
 *
 * @internal
 */
export type UnitSchema = "Unit";

/**
 * Traits attached to schema objects.
 * @public
 */
export type SchemaTraits = {
  httpLabel?: 1;
  httpHeader?: string;
  httpQuery?: string;
  httpPrefixHeaders?: string;
  httpQueryParams?: {};
  httpPayload?: {};
  http?: [string?, string?, number?];
  xmlName?: string;
  xmlFlattened?: 1;
  jsonName?: string;
  [traitName: string]: any;
};

/**
 * A schema having traits.
 *
 * @public
 */
export interface TraitsSchema {
  name: string;
  traits: SchemaTraits;
}

/**
 * A data object containing serialization traits of a
 * shape to assist with (de)serialization.
 *
 * @public
 */
export interface StructureSchema extends TraitsSchema {
  name: string;
  traits: SchemaTraits;
  members: Record<string, [SchemaRef, SchemaTraits]>;
}

/**
 * @public
 */
export interface ListSchema extends TraitsSchema {
  name: string;
  traits: SchemaTraits;
  valueSchema: SchemaRef;
}

/**
 * @public
 */
export interface MapSchema extends TraitsSchema {
  name: string;
  traits: SchemaTraits;
  valueSchema: SchemaRef;
}

/**
 * @public
 */
export type MemberSchema = [SchemaRef, SchemaTraits];

/**
 * Schema for an operation.
 *
 * @public
 */
export interface OperationSchema extends TraitsSchema {
  name: string;
  traits: Record<string, any>;
  input: SchemaRef;
  output: SchemaRef;
}

/**
 * Normalization wrapper for various schema data objects.
 * @internal
 */
export interface NormalizedSchema extends TraitsSchema {
  name: string;
  traits: SchemaTraits;
  getSchema(): Schema;
  getName(): string | undefined;
  isMemberSchema(): boolean;
  isListSchema(): boolean;
  isMapSchema(): boolean;
  isStructSchema(): boolean;
  isBlobSchema(): boolean;
  isTimestampSchema(): boolean;
  isStringSchema(): boolean;
  isBooleanSchema(): boolean;
  isNumericSchema(): boolean;
  isBigIntegerSchema(): boolean;
  isBigDecimalSchema(): boolean;
  isStreaming(): boolean;
  getMergedTraits(): SchemaTraits;
  getMemberTraits(): SchemaTraits;
  getOwnTraits(): SchemaTraits;
  /**
   * For list/set/map.
   */
  getValueSchema(): NormalizedSchema;
  /**
   * For struct/union.
   */
  getMemberSchema(member: string): NormalizedSchema | undefined;
  getMemberSchemas(): Record<string, NormalizedSchema>;
}

/**
 * @public
 */
export type SimpleSchema =
  | BlobSchemas
  | StringSchema
  | BooleanSchema
  | NumericSchema
  | BigIntegerSchema
  | BigDecimalSchema
  | DocumentSchema
  | TimestampSchemas
  | number;

/**
 * @public
 */
export type Schema =
  | UnitSchema
  | TraitsSchema
  | SimpleSchema
  | ListSchema
  | MapSchema
  | StructureSchema
  | MemberSchema
  | OperationSchema
  | NormalizedSchema;

/**
 * @public
 */
export type SchemaRef = Schema | (() => Schema);

/**
 * A codec creates serializers and deserializers for some format such as JSON, XML, or CBOR.
 *
 * @public
 */
export interface Codec<S, D> extends ConfigurableSerdeContext {
  createSerializer(): ShapeSerializer<S>;
  createDeserializer(): ShapeDeserializer<D>;
}

/**
 * @public
 */
export interface ShapeDeserializer<SerializationType = Uint8Array> extends ConfigurableSerdeContext {
  /**
   * The returned value is awaited so it optionally can be a Promise.
   */
  read(schema: Schema, data: SerializationType): any | Promise<any>;
}

/**
 * @public
 */
export interface ShapeSerializer<SerializationType = Uint8Array> extends ConfigurableSerdeContext {
  write(schema: Schema, value: unknown): void;

  flush(): SerializationType;
}

/**
 * @public
 */
export interface Protocol<Request, Response> extends ConfigurableSerdeContext {
  getShapeId(): string;

  getRequestType(): { new (...args: any[]): Request };
  getResponseType(): { new (...args: any[]): Response };

  serializeRequest<Input extends object>(
    operationSchema: OperationSchema,
    input: Input,
    context: HandlerExecutionContext
  ): Promise<Request>;

  updateServiceEndpoint(request: Request, endpoint: EndpointV2): Request;

  deserializeResponse<Output extends MetadataBearer>(
    operationSchema: OperationSchema,
    context: HandlerExecutionContext,
    response: Response
  ): Promise<Output>;
}

/**
 * Indicates implementation may need the request's serdeContext to
 * be provided.
 *
 * @internal
 */
interface ConfigurableSerdeContext {
  setSerdeContext(serdeContext: SerdeContext): void;
}

/**
 * @public
 */
export interface Transport<Request, Response> {
  getRequestType(): { new (...args: any[]): Request };
  getResponseType(): { new (...args: any[]): Response };

  send(context: HandlerExecutionContext, request: Request): Promise<Response>;
}
