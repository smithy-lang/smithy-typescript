import { EndpointV2 } from "../endpoint";
import { HandlerExecutionContext } from "../middleware";
import { MetadataBearer } from "../response";
import { SerdeContext } from "../serde";

/**
 * The default schema is a sentinel value
 * indicating that the schema for a shape
 * behaves no differently than a Document.
 *
 * @public
 */
export type DefaultSchema = undefined;

/**
 * Sentinel value for Timestamp schema.
 * "time" means unspecified and to use the protocol serializer's default format.
 *
 * @public
 */
export type TimestampSchema = "time" | "date-time" | "http-date" | "epoch-seconds" | string;

/**
 * Sentinel value for Blob schema.
 *
 * @public
 */
export type BlobSchema = "blob" | "streaming-blob";

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
 * Sentinel value for structure schema with no traits.
 * @public
 */
export type DefaultStructureSchema = 8;

/**
 * @public
 */
export interface ListSchema extends TraitsSchema {
  name: string;
  traits: SchemaTraits;
  valueSchema: SchemaRef;
}

/**
 * Sentinel value for list schema with no traits.
 * @public
 */
export type DefaultListSchema = 2;

/**
 * @public
 */
export interface MapSchema extends TraitsSchema {
  name: string;
  traits: SchemaTraits;
  valueSchema: SchemaRef;
}

/**
 * Sentinel value for map schema with no traits.
 * @public
 */
export type DefaultMapSchema = 4;

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
  getMergedTraits(): SchemaTraits;
  getMemberTraits(): SchemaTraits;
  getOwnTraits(): SchemaTraits;
  getMemberSchema(member?: string): NormalizedSchema;
}

/**
 * @public
 */
export type Schema =
  | UnitSchema
  | DefaultSchema
  | TimestampSchema
  | BlobSchema
  | ListSchema
  | DefaultListSchema
  | MapSchema
  | DefaultMapSchema
  | StructureSchema
  | DefaultStructureSchema
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
