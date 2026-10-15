import { hasOwn } from "@smithy/core/transport";
import { sdkStreamMixin, splitEvery, splitHeader } from "@smithy/core/serde";
import type { NormalizedSchema } from "@smithy/core/schema";
import type { HandlerExecutionContext, HttpResponse, Schema, SerdeFunctions, ShapeDeserializer } from "@smithy/types";

import type { HttpBindingValueMetadata, HttpResponseBindingExtension } from "../HttpBindingSchemaExtension";
import { collectBody } from "../collect-stream-body";
import type { HttpBindingValueLocation } from "./determineTimestampFormat";

interface DirectHttpBindingShapeDeserializer extends ShapeDeserializer<string | Uint8Array> {
  readHttpBinding(
    schema: Schema,
    data: string | Uint8Array,
    location: HttpBindingValueLocation,
    metadata?: HttpBindingValueMetadata
  ): any;
  readPayload(schema: Schema, data: string | Uint8Array, metadata?: HttpBindingValueMetadata): any | Promise<any>;
  readCodec(schema: Schema, data: string | Uint8Array): any | Promise<any>;
}

export interface HttpBindingEventStreamOutput {
  readonly memberName: string;
  readonly responseSchema: NormalizedSchema;
}

/**
 * Routes response HTTP binding locations to output members and delegates only
 * document bodies and non-streaming payloads to the codec.
 *
 * @internal
 */
export class HttpBindingDeserializer {
  private readonly directDeserializer: DirectHttpBindingShapeDeserializer | undefined;

  public constructor(
    private readonly deserializer: ShapeDeserializer<string | Uint8Array>,
    private readonly bindings: HttpResponseBindingExtension
  ) {
    this.directDeserializer =
      "readHttpBinding" in deserializer && "readPayload" in deserializer && "readCodec" in deserializer
        ? (deserializer as DirectHttpBindingShapeDeserializer)
        : undefined;
  }

  public async deserialize(
    responseSchema: NormalizedSchema,
    context: HandlerExecutionContext & SerdeFunctions,
    response: HttpResponse,
    dataObject: any,
    includeBody: boolean
  ): Promise<HttpBindingEventStreamOutput | undefined> {
    const responseHeaderCount = this.normalizeHeaders(response.headers);

    let eventStreamOutput: HttpBindingEventStreamOutput | undefined;
    const payload = this.bindings.payloadMember;
    if (payload) {
      const { memberName, memberSchema, valueMetadata } = payload;
      if (valueMetadata.isStreaming) {
        if (valueMetadata.isEventStream) {
          eventStreamOutput = {
            memberName,
            responseSchema,
          };
        } else {
          dataObject[memberName] = sdkStreamMixin(response.body);
        }
      } else if (response.body) {
        const bytes = await collectBody(response.body, context);
        if (bytes.byteLength > 0) {
          dataObject[memberName] = await (this.directDeserializer
            ? this.directDeserializer.readPayload(memberSchema, bytes, valueMetadata)
            : this.deserializer.read(memberSchema, bytes));
        }
      }
    }

    for (const binding of this.bindings.listHeaders) {
      const value = response.headers[binding.wireName];
      if (value == null) {
        continue;
      }

      const sections = binding.splitTimestampList ? splitEvery(value, ",", 2) : splitHeader(value);
      const list = [];
      for (const section of sections) {
        list.push(
          this.directDeserializer
            ? this.directDeserializer.readHttpBinding(
                binding.listValueSchema!,
                section.trim(),
                "header",
                binding.listValueMetadata
              )
            : await this.deserializer.read(binding.listDeserializerSchema!, section.trim())
        );
      }
      dataObject[binding.memberName] = list;
    }

    const { scalarHeadersByName, scalarHeaderCount } = this.bindings;
    if (this.directDeserializer) {
      if (responseHeaderCount <= scalarHeaderCount) {
        for (const header in response.headers) {
          if (!hasOwn(response.headers, header)) {
            continue;
          }
          const binding = scalarHeadersByName[header];
          if (binding) {
            dataObject[binding.memberName] = this.directDeserializer.readHttpBinding(
              binding.memberSchema,
              response.headers[header],
              "header",
              binding.valueMetadata
            );
          }
        }
      } else {
        for (const header in scalarHeadersByName) {
          if (!hasOwn(scalarHeadersByName, header)) {
            continue;
          }
          const value = response.headers[header];
          if (value != null) {
            const binding = scalarHeadersByName[header];
            dataObject[binding.memberName] = this.directDeserializer.readHttpBinding(
              binding.memberSchema,
              value,
              "header",
              binding.valueMetadata
            );
          }
        }
      }
    } else if (responseHeaderCount <= scalarHeaderCount) {
      for (const header in response.headers) {
        if (!hasOwn(response.headers, header)) {
          continue;
        }
        const binding = scalarHeadersByName[header];
        if (binding) {
          dataObject[binding.memberName] = await this.deserializer.read(binding.memberSchema, response.headers[header]);
        }
      }
    } else {
      for (const header in scalarHeadersByName) {
        if (!hasOwn(scalarHeadersByName, header)) {
          continue;
        }
        const value = response.headers[header];
        if (value != null) {
          const binding = scalarHeadersByName[header];
          dataObject[binding.memberName] = await this.deserializer.read(binding.memberSchema, value);
        }
      }
    }

    for (const binding of this.bindings.prefixHeaders) {
      const values: Record<string, unknown> = {};
      dataObject[binding.memberName] = values;
      for (const header in response.headers) {
        if (!hasOwn(response.headers, header) || !header.startsWith(binding.prefix)) {
          continue;
        }
        values[header.slice(binding.prefix.length)] = this.directDeserializer
          ? this.directDeserializer.readHttpBinding(
              binding.valueSchema,
              response.headers[header],
              "header",
              binding.valueMetadata
            )
          : await this.deserializer.read([binding.valueSchema, { httpHeader: header }], response.headers[header]);
      }
    }

    if (this.bindings.responseCodeMember) {
      dataObject[this.bindings.responseCodeMember] = response.statusCode;
    }

    if (includeBody && this.bindings.bodyMemberNames.length) {
      const bytes = await collectBody(response.body, context);
      if (bytes.byteLength > 0) {
        const dataFromBody = await (this.directDeserializer
          ? this.directDeserializer.readCodec(this.bindings.bodySchema!, bytes)
          : this.deserializer.read(this.bindings.bodySchema!, bytes));
        for (const member of this.bindings.bodyMemberNames) {
          if (dataFromBody[member] != null) {
            dataObject[member] = dataFromBody[member];
          }
        }
      }
    } else if (includeBody && this.bindings.bodyMemberNames.discardResponseBody) {
      await collectBody(response.body, context);
    }

    return eventStreamOutput;
  }

  private normalizeHeaders(headers: Record<string, string>): number {
    let count = 0;
    for (const header in headers) {
      if (!hasOwn(headers, header)) {
        continue;
      }
      ++count;
      const lowerName = header.toLowerCase();
      if (lowerName !== header) {
        const value = headers[header];
        delete headers[header];
        headers[lowerName] = value;
      }
    }
    return count;
  }
}
