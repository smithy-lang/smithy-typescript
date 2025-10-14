import type { EndpointV2 } from "../endpoint";
import type { HandlerExecutionContext } from "../middleware";
import type { MetadataBearer } from "../response";
import type { EndpointBearer, SerdeFunctions } from "../serde";
import type { ConfigurableSerdeContext, NormalizedSchema, SchemaTraits, SimpleSchema, UnitSchema } from "./schema";
import type { StaticSchema } from "./static-schemas";

/**
 * A schema is an object or value that describes how to serialize/deserialize data.
 * @public
 * @deprecated use $Schema
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
  | StaticSchema
  | NormalizedSchema;

/**
 * A schema "reference" is either a schema or a function that
 * provides a schema. This is useful for lazy loading, and to allow
 * code generation to define schema out of dependency order.
 * @public
 * @deprecated use $SchemaRef
 */
export type SchemaRef = Schema | (() => Schema);

/**
 * A schema that has traits.
 *
 * @public
 * @deprecated use static schema.
 */
export interface TraitsSchema {
  namespace: string;
  name: string;
  traits: SchemaTraits;
}

/**
 * Indicates the schema is a member of a parent Structure schema.
 * It may also have a set of member traits distinct from its target shape's traits.
 * @public
 * @deprecated use $MemberSchema
 */
export type MemberSchema = [SchemaRef, SchemaTraits];

/**
 * Schema for the structure aggregate type.
 * @public
 * @deprecated use static schema.
 */
export interface StructureSchema extends TraitsSchema {
  memberNames: string[];
  memberList: SchemaRef[];

  /**
   * @deprecated structure member iteration will be linear on the memberNames and memberList arrays.
   * It can be collected into a hashmap form on an ad-hoc basis, but will not initialize as such.
   */
  members?: Record<string, [SchemaRef, SchemaTraits]> | undefined;
}

/**
 * Schema for the list aggregate type.
 * @public
 * @deprecated use static schema.
 */
export interface ListSchema extends TraitsSchema {
  valueSchema: SchemaRef;
}

/**
 * Schema for the map aggregate type.
 * @public
 * @deprecated use static schema.
 */
export interface MapSchema extends TraitsSchema {
  keySchema: SchemaRef;
  valueSchema: SchemaRef;
}

/**
 * Schema for an operation.
 * @public
 * @deprecated use StaticOperationSchema or $OperationSchema
 */
export interface OperationSchema {
  namespace: string;
  name: string;
  traits: SchemaTraits;
  input: SchemaRef;
  output: SchemaRef;
}

/**
 * Turns a serialization into a data object.
 * @public
 * @deprecated use $ShapeDeserializer
 */
export interface ShapeDeserializer<SerializationType = Uint8Array> extends ConfigurableSerdeContext {
  /**
   * Optionally async.
   */
  read(schema: Schema, data: SerializationType): any | Promise<any>;
}

/**
 * Turns a data object into a serialization.
 * @public
 * @deprecated use $ShapeSerializer
 */
export interface ShapeSerializer<SerializationType = Uint8Array> extends ConfigurableSerdeContext {
  write(schema: Schema, value: unknown): void;

  flush(): SerializationType;
}

/**
 * A codec creates serializers and deserializers for some format such as JSON, XML, or CBOR.
 *
 * @public
 * @deprecated use $Codec
 */
export interface Codec<S, D> extends ConfigurableSerdeContext {
  createSerializer(): ShapeSerializer<S>;
  createDeserializer(): ShapeDeserializer<D>;
}

/**
 * A client protocol defines how to convert a message (e.g. HTTP request/response) to and from a data object.
 * @public
 * @deprecated use $ClientProtocol
 */
export interface ClientProtocol<Request, Response> extends ConfigurableSerdeContext {
  /**
   * @returns the Smithy qualified shape id.
   */
  getShapeId(): string;

  getRequestType(): { new (...args: any[]): Request };
  getResponseType(): { new (...args: any[]): Response };

  /**
   * @returns the payload codec if the requests/responses have a symmetric format.
   * It otherwise may return null.
   */
  getPayloadCodec(): Codec<any, any>;

  serializeRequest<Input extends object>(
    operationSchema: OperationSchema,
    input: Input,
    context: HandlerExecutionContext & SerdeFunctions & EndpointBearer
  ): Promise<Request>;

  updateServiceEndpoint(request: Request, endpoint: EndpointV2): Request;

  deserializeResponse<Output extends MetadataBearer>(
    operationSchema: OperationSchema,
    context: HandlerExecutionContext & SerdeFunctions,
    response: Response
  ): Promise<Output>;
}
