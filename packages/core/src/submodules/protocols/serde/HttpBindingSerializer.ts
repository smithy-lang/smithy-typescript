import { hasOwn } from "@smithy/core/transport";
import { NormalizedSchema } from "@smithy/core/schema";
import type { HttpRequest, Schema, ShapeSerializer } from "@smithy/types";

import {
  HttpBindingLocation,
  HttpBindingValueKind,
  HttpPathSegmentKind,
  type HttpBindingValueMetadata,
  type HttpOperationBindingExtension,
  type HttpPathSegment,
  type HttpRequestBindingExtension,
  type HttpRequestBindingMember,
} from "../HttpBindingSchemaExtension";
import { extendedEncodeURIComponent } from "../extended-encode-uri-component";
import type { HttpBindingValueLocation } from "./determineTimestampFormat";

interface DirectHttpBindingShapeSerializer extends ShapeSerializer<string | Uint8Array> {
  writeHttpBinding(
    schema: Schema,
    value: unknown,
    location: HttpBindingValueLocation,
    metadata?: HttpBindingValueMetadata
  ): void;
  writeCodec(schema: Schema, value: unknown): void;
}

export interface HttpBindingEventStreamInput {
  readonly eventStream: AsyncIterable<any>;
  readonly requestSchema: NormalizedSchema;
}

/**
 * Routes request structure members to their HTTP binding locations and
 * delegates only document bodies and non-streaming payloads to the codec.
 *
 * @internal
 */
export class HttpBindingSerializer {
  private readonly directSerializer: DirectHttpBindingShapeSerializer | undefined;

  public constructor(
    private readonly serializer: ShapeSerializer<string | Uint8Array>,
    private readonly bindings: HttpRequestBindingExtension,
    private readonly operationBinding: HttpOperationBindingExtension
  ) {
    this.directSerializer =
      "writeHttpBinding" in serializer && "writeCodec" in serializer
        ? (serializer as DirectHttpBindingShapeSerializer)
        : undefined;
  }

  public serialize(
    input: any,
    request: HttpRequest,
    requestSchema: NormalizedSchema
  ): HttpBindingEventStreamInput | undefined {
    const query = request.query ?? (request.query = {});
    const headers = request.headers ?? (request.headers = {});
    let hasBodyValue = false;
    let payload: any;
    let eventStreamInput: HttpBindingEventStreamInput | undefined;
    let labels: Record<string, string> | undefined;

    for (const binding of this.bindings.members) {
      const { memberName, memberSchema } = binding;
      const inputMemberValue = input[memberName];

      if (inputMemberValue == null && !binding.valueMetadata.idempotencyToken) {
        continue;
      }

      switch (binding.location) {
        case HttpBindingLocation.PAYLOAD:
          if (binding.valueMetadata.isStreaming) {
            if (binding.valueMetadata.isEventStream) {
              if (inputMemberValue) {
                eventStreamInput = {
                  eventStream: inputMemberValue,
                  requestSchema,
                };
              }
            } else {
              payload = inputMemberValue;
            }
          } else {
            payload = this.serializeCodec(memberSchema, inputMemberValue);
          }
          break;
        case HttpBindingLocation.LABEL:
          (labels ??= Object.create(null))[memberName] = this.serializeHttpValue(
            memberSchema,
            inputMemberValue,
            "label",
            binding.valueMetadata
          );
          break;
        case HttpBindingLocation.HEADER:
          headers[binding.wireName!] = this.serializeHttpValue(
            memberSchema,
            inputMemberValue,
            "header",
            binding.valueMetadata
          );
          break;
        case HttpBindingLocation.PREFIX_HEADERS:
          this.serializePrefixHeaders(binding, inputMemberValue, headers);
          break;
        case HttpBindingLocation.QUERY:
          this.serializeQueryValue(memberSchema, inputMemberValue, binding.wireName!, query, binding.valueMetadata);
          break;
        case HttpBindingLocation.QUERY_PARAMS:
          this.serializeQueryParams(binding, inputMemberValue, query);
          break;
        case HttpBindingLocation.BODY:
          hasBodyValue = true;
          break;
      }
    }

    if (this.bindings.bodySchema && hasBodyValue) {
      payload = this.serializeCodec(this.bindings.bodySchema, input);
    }

    if (
      this.operationBinding.path &&
      this.operationBinding.pathSegments &&
      request.path.endsWith(this.operationBinding.path)
    ) {
      const prefixLength = request.path.length - this.operationBinding.path.length;
      request.path =
        request.path.slice(0, prefixLength) + this.serializePath(this.operationBinding.pathSegments, labels);
    }

    request.body = payload;
    return eventStreamInput;
  }

  private serializePath(segments: readonly HttpPathSegment[], labels: Record<string, string> | undefined): string {
    let path = "";
    for (const [value, kind] of segments) {
      if (kind === HttpPathSegmentKind.LITERAL) {
        path += value;
        continue;
      }

      const replacement = labels?.[value];
      if (replacement === undefined) {
        if (this.bindings.labelNames[value]) {
          throw new Error(`No value provided for input HTTP label: ${value}.`);
        }
        path += `{${value}${kind === HttpPathSegmentKind.GREEDY_LABEL ? "+" : ""}}`;
        continue;
      }
      path +=
        kind === HttpPathSegmentKind.GREEDY_LABEL
          ? replacement.split("/").map(extendedEncodeURIComponent).join("/")
          : extendedEncodeURIComponent(replacement);
    }
    return path;
  }

  private serializePrefixHeaders(binding: HttpRequestBindingMember, data: any, headers: Record<string, string>): void {
    const valueSchema = binding.collectionValueSchema!;
    const valueMetadata = binding.collectionValueMetadata!;
    for (const key in data) {
      if (!hasOwn(data, key)) {
        continue;
      }
      const header = binding.wireName! + key;
      const schema: Schema = this.directSerializer ? valueSchema : [valueSchema, { httpHeader: header }];
      headers[header.toLowerCase()] = this.serializeHttpValue(schema, data[key], "header", valueMetadata);
    }
  }

  private serializeQueryParams(
    binding: HttpRequestBindingMember,
    data: any,
    query: NonNullable<HttpRequest["query"]>
  ): void {
    const valueSchema = binding.collectionValueSchema!;
    const valueMetadata = binding.collectionValueMetadata!;
    const traits = this.directSerializer ? undefined : binding.memberSchema.getMergedTraits();
    for (const key in data) {
      if (!hasOwn(data, key) || key in query) {
        continue;
      }
      const schemaWithInheritedTraits: Schema = this.directSerializer
        ? valueSchema
        : [
            valueSchema,
            {
              ...traits!,
              httpQuery: key,
              httpQueryParams: undefined,
            },
          ];
      this.serializeQueryValue(schemaWithInheritedTraits, data[key], key, query, valueMetadata);
    }
  }

  private serializeQueryValue(
    schema: Schema,
    data: any,
    wireName: string,
    query: NonNullable<HttpRequest["query"]>,
    metadata?: HttpBindingValueMetadata
  ): void {
    if (this.directSerializer && metadata) {
      if (metadata.kind === HttpBindingValueKind.LIST) {
        const buffer = [];
        for (const item of data) {
          const serializable = this.serializeHttpValue(
            metadata.listValueSchema!,
            item,
            "query",
            metadata.listValueMetadata
          );
          if (serializable !== undefined) {
            buffer.push(serializable);
          }
        }
        query[wireName] = buffer;
        return;
      }

      query[wireName] = this.serializeHttpValue(schema, data, "query", metadata);
      return;
    }

    const normalizedSchema = NormalizedSchema.of(schema);
    if (normalizedSchema.isListSchema()) {
      const traits = normalizedSchema.getMergedTraits();
      const valueSchema: Schema = [normalizedSchema.getValueSchema(), traits];
      const sparse = !!traits.sparse;
      const buffer = [];
      for (const item of data) {
        const serializable = this.serializeHttpValue(valueSchema, item, "query");
        if (sparse || serializable !== undefined) {
          buffer.push(serializable);
        }
      }
      query[wireName] = buffer;
      return;
    }

    query[wireName] = this.serializeHttpValue(schema, data, "query");
  }

  private serializeHttpValue(
    schema: Schema,
    value: unknown,
    location: HttpBindingValueLocation,
    metadata?: HttpBindingValueMetadata
  ): string {
    if (this.directSerializer) {
      this.directSerializer.writeHttpBinding(schema, value, location, metadata);
    } else {
      this.serializer.write(schema, value);
    }
    return String(this.serializer.flush());
  }

  private serializeCodec(schema: Schema, value: unknown): string | Uint8Array {
    if (this.directSerializer) {
      this.directSerializer.writeCodec(schema, value);
    } else {
      this.serializer.write(schema, value);
    }
    return this.serializer.flush();
  }
}
