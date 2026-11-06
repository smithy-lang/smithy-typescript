import { NormalizedSchema, translateTraits } from "@smithy/core/schema";
import type {
  BlobSchema,
  ListSchemaModifier,
  OperationSchema,
  StaticSchemaIdStruct,
  StaticStructureSchema,
  StreamingBlobSchema,
  StringSchema,
  TimestampDefaultSchema,
  TimestampEpochSecondsSchema,
  TimestampHttpDateSchema,
} from "@smithy/types";

import { writeKey } from "./writeKey";

export type HttpBody = 0b100_000;
export type HttpLabel = 0b100_001;
export type HttpQuery = 0b100_010;
export type HttpQueryParams = 0b100_011;
export type HttpPayload = 0b100_100;
export type HttpResponseCode = 0b100_101;
export type HttpHeader = 0b100_110;
export type HttpPrefixHeaders = 0b100_111;

export type HttpBindingLocation =
  | HttpBody
  | HttpHeader
  | HttpQuery
  | HttpLabel
  | HttpPayload
  | HttpPrefixHeaders
  | HttpQueryParams
  | HttpResponseCode;

/**
 * The low byte is the schema type. Higher bits cache HTTP serde traits.
 *
 * @internal
 */
export type HttpBindingValue = readonly [
  schema: HttpBindingNormalizedSchema,
  flags: number,
  collectionValue?: HttpBindingValue,
];

export type HttpBinding = readonly [
  memberName: string,
  value: HttpBindingValue,
  location: HttpBindingLocation,
  wireName?: string,
];

export type HttpPathSegment = readonly [value: string, kind: 0 | 1 | 2];
export type HttpOperationBindings = readonly [
  method: string | undefined,
  path: string | undefined,
  query: readonly (readonly [string, string])[],
  pathSegments: readonly HttpPathSegment[] | undefined,
  hostPrefix: string | undefined,
];

const HTTP_BINDINGS = Symbol.for("@smithy/schema-x");
export type HttpBindingIndex = {
  request: {
    memberBindings: HttpBinding[];
    byName: Record<string, HttpBinding>;
    hasIdempotency?: boolean;
    hasPrefixHeaders?: boolean;
    syntheticBodySchema?: StaticStructureSchema;
    contentTypeInstruction?: string | null;
  };
  response: {
    bodyMemberNames: string[];
    syntheticBodySchema?: StaticStructureSchema;
    bindings: {
      payload?: HttpBinding;
      statusCode?: HttpBinding;
      headers: Record<string, HttpBinding>;
      prefixHeaders: HttpBinding[];
    };
  };
};
type HttpBindingCache<T> = { [HTTP_BINDINGS]?: T };

/**
 * A normalized schema with lazily cached HTTP binding metadata.
 *
 * @internal
 */
export class HttpBindingNormalizedSchema extends NormalizedSchema {
  private static readonly identity = Symbol.for("@smithy/HttpBindingNormalizedSchema");

  private readonly identity = HttpBindingNormalizedSchema.identity;
  private bindings?: HttpBindingIndex;

  private constructor(schema: NormalizedSchema) {
    super(schema);
  }

  public static of(schema: Parameters<typeof NormalizedSchema.of>[0]): HttpBindingNormalizedSchema {
    const ns = NormalizedSchema.of(schema);
    if ((ns as HttpBindingNormalizedSchema).identity === HttpBindingNormalizedSchema.identity) {
      return ns as HttpBindingNormalizedSchema;
    }
    const schemaCache = ns.isMemberSchema() ? ns : ns.getSchema();
    const cache = typeof schemaCache === "object" && schemaCache !== null ? schemaCache : ns;
    return ((cache as HttpBindingCache<HttpBindingNormalizedSchema>)[HTTP_BINDINGS] ??= new HttpBindingNormalizedSchema(
      ns
    ));
  }

  public getHttpBindingLocation(traits: ReturnType<NormalizedSchema["getMergedTraits"]>): HttpBindingLocation {
    if (traits.httpPayload) {
      return 0b100_100 satisfies HttpPayload;
    }
    if (traits.httpLabel) {
      return 0b100_001 satisfies HttpLabel;
    }
    if (traits.httpHeader) {
      return 0b100_110 satisfies HttpHeader;
    }
    if (typeof traits.httpPrefixHeaders === "string") {
      return 0b100_111 satisfies HttpPrefixHeaders;
    }
    if (traits.httpQuery) {
      return 0b100_010 satisfies HttpQuery;
    }
    if (traits.httpQueryParams) {
      return 0b100_011 satisfies HttpQueryParams;
    }
    if (traits.httpResponseCode) {
      return 0b100_101 satisfies HttpResponseCode;
    }
    return 0b100_000 satisfies HttpBody;
  }

  public getHttpBindingValue(
    location: HttpBindingLocation,
    traits: ReturnType<NormalizedSchema["getMergedTraits"]>,
    nested = false
  ): HttpBindingValue {
    const raw = this.getSchema();
    const type =
      typeof raw === "number" ? raw & 0xff : this.isListSchema() ? (0b0100_0000 satisfies ListSchemaModifier) : 0xff;
    const slot = location & 0b111;
    const media = (
      traits.mediaType ? (traits.mediaType === "application/json" || traits.mediaType.endsWith("+json") ? 2 : 1) : 0
    ) satisfies 0 | 1 | 2;
    const stream = (
      traits.streaming || type === (42 satisfies StreamingBlobSchema) ? (this.isStructSchema() ? 2 : 1) : 0
    ) satisfies 0 | 1 | 2;
    const timestamp = (
      type >= (4 satisfies TimestampDefaultSchema) && type <= (7 satisfies TimestampEpochSecondsSchema)
        ? slot >= 6
          ? 2
          : slot > 0 && slot < 4
            ? 1
            : 0
        : 0
    ) satisfies 0 | 1 | 2;
    let flags =
      type |
      (media << 8) |
      ((traits.idempotencyToken ? 1 : 0) << 10) |
      (stream << 11) |
      ((traits.sparse ? 1 : 0) << 13) |
      (timestamp << 14) |
      ((traits.hostLabel ? 1 : 0) << 17) |
      ((location === (0b100_100 satisfies HttpPayload) && typeof raw !== "object" ? 1 : 0) << 18);
    const category = type & 0b1100_0000;
    const collectionValue =
      slot & 0b010 && (category === (0b0100_0000 satisfies ListSchemaModifier) || (!nested && slot & 1))
        ? this.getHttpBindingCollectionValue(location, traits)
        : undefined;
    const valueType = (collectionValue?.[1] ?? 0) & 0xff;
    flags |=
      (slot >= 6 &&
      (valueType === (4 satisfies TimestampDefaultSchema) || valueType === (6 satisfies TimestampHttpDateSchema))
        ? 1
        : 0) << 16;
    return [this, flags, collectionValue];
  }

  public getHttpBindingCollectionValue(
    location: HttpBindingLocation,
    traits = this.getMergedTraits()
  ): HttpBindingValue {
    const valueSchema = HttpBindingNormalizedSchema.of(this.getValueSchema());
    return valueSchema.getHttpBindingValue(location, { ...valueSchema.getMergedTraits(), ...traits }, true);
  }

  public getHttpBindings(): HttpBindingIndex {
    const source = this.getSchema();
    return typeof source !== "object" || source === null ? EMPTY_BINDINGS : (this.bindings ??= buildHttpBindings(this));
  }
}

const buildHttpBindings = (schema: HttpBindingNormalizedSchema): HttpBindingIndex => {
  const bodyMemberNames: string[] = [];
  const bodyMemberSchemas: StaticStructureSchema[5] = [];
  const requestBodyMemberNames: StaticStructureSchema[4] = [];
  const requestBodyMemberSchemas: StaticStructureSchema[5] = [];
  const memberBindings: HttpBinding[] = [];
  const byName: Record<string, HttpBinding> = {};
  const headers: Record<string, HttpBinding> = {};
  const prefixHeaders: HttpBinding[] = [];
  const responseBindings = { headers, prefixHeaders } as HttpBindingIndex["response"]["bindings"];
  const bindings: HttpBindingIndex = {
    request: { memberBindings, byName },
    response: {
      bodyMemberNames,
      bindings: responseBindings,
    },
  };
  const { request, response } = bindings;

  for (const [name, member] of schema.structIterator()) {
    const bindingSchema = HttpBindingNormalizedSchema.of(member);
    const traits = bindingSchema.getMergedTraits();
    const location = bindingSchema.getHttpBindingLocation(traits);
    const wireName = traits.httpHeader?.toLowerCase() ?? traits.httpPrefixHeaders?.toLowerCase() ?? traits.httpQuery;
    const value = bindingSchema.getHttpBindingValue(location, traits);
    const binding: HttpBinding = [name, value, location, wireName];
    if (name === "__proto__") {
      writeKey(byName);
    }
    byName[name] = binding;
    if ((value[1] >> 10) & 1) {
      request.hasIdempotency = true;
    }
    memberBindings.push(binding);

    const slot = location & 0b111;
    if (slot === 0) {
      requestBodyMemberNames.push(name);
      requestBodyMemberSchemas.push(member);
    }
    if ((slot & 0b100) === 0) {
      bodyMemberNames.push(name);
      bodyMemberSchemas.push(member);
    } else if ((slot & 0b110) === 0b100) {
      if (slot & 0b001) {
        responseBindings.statusCode = binding;
      } else {
        responseBindings.payload = binding;
        const type = value[1] & 0xff;
        request.contentTypeInstruction =
          traits.mediaType ??
          (type === (0 satisfies StringSchema)
            ? "text/plain"
            : type === (21 satisfies BlobSchema) || type === (42 satisfies StreamingBlobSchema)
              ? "application/octet-stream"
              : null);
      }
    } else if (slot & 0b001) {
      request.hasPrefixHeaders = true;
      prefixHeaders.push(binding);
    } else {
      if (wireName === "__proto__") {
        writeKey(headers);
      }
      headers[wireName!] = binding;
    }
  }
  if (request.contentTypeInstruction === undefined && requestBodyMemberNames.length) {
    request.contentTypeInstruction = null;
  }
  request.syntheticBodySchema = createBodySchema(schema, requestBodyMemberNames, requestBodyMemberSchemas);
  response.syntheticBodySchema = createBodySchema(schema, bodyMemberNames, bodyMemberSchemas);
  return bindings;
};

const buildPathSegments = (path: string): readonly HttpPathSegment[] | undefined => {
  const segments: HttpPathSegment[] = [];
  let offset = 0;
  for (const match of path.matchAll(/\{([^{}+]+)(\+)?\}/g)) {
    if (match.index > offset) {
      segments.push([path.slice(offset, match.index), 0]);
    }
    segments.push([match[1], match[2] ? 2 : 1]);
    offset = match.index + match[0].length;
  }
  if (segments.length && offset < path.length) {
    segments.push([path.slice(offset), 0]);
  }
  return segments.length ? segments : undefined;
};

const buildHttpOperationBindings = (schema: OperationSchema): HttpOperationBindings => {
  const { http, endpoint } = translateTraits(schema.traits ?? {});
  const [path, search] = http?.[1].split("?") ?? [];
  return [
    http?.[0],
    path,
    search ? [...new URLSearchParams(search)] : [],
    path ? buildPathSegments(path) : undefined,
    endpoint?.[0],
  ];
};

const EMPTY_BINDINGS: HttpBindingIndex = {
  request: { memberBindings: [], byName: {} },
  response: {
    bodyMemberNames: [],
    bindings: { headers: {}, prefixHeaders: [] },
  },
};

/**
 * @internal
 */
export const getHttpOperationBindings = (schema: OperationSchema): HttpOperationBindings =>
  ((schema as HttpBindingCache<HttpOperationBindings>)[HTTP_BINDINGS] ??= buildHttpOperationBindings(schema));

/**
 * @internal
 */
export const resolveHttpBindingContentType = (
  defaultContentType: string,
  schema: NormalizedSchema
): string | undefined => {
  const contentType = HttpBindingNormalizedSchema.of(schema).getHttpBindings().request.contentTypeInstruction;
  return contentType === null ? defaultContentType : contentType;
};

/**
 * @internal
 */
export const hasHttpBindingUnstructuredPayload = (schema: NormalizedSchema): boolean =>
  !!((HttpBindingNormalizedSchema.of(schema).getHttpBindings().response.bindings.payload?.[1][1] ?? 0) & (1 << 18));

const createBodySchema = (
  schema: NormalizedSchema,
  memberNames: StaticStructureSchema[4],
  memberSchemas: StaticStructureSchema[5]
): StaticStructureSchema | undefined => {
  if (!memberNames.length) {
    return undefined;
  }
  const source = schema.getSchema() as StaticStructureSchema;
  const body: StaticStructureSchema = [
    3 satisfies StaticSchemaIdStruct,
    source[1],
    source[2],
    schema.getMergedTraits(),
    memberNames,
    memberSchemas,
  ];
  const required = source[6];
  const bodyRequired =
    required && memberNames.reduce((count, name) => count + (source[4].indexOf(name) < required ? 1 : 0), 0);
  if (bodyRequired) {
    body[6] = bodyRequired;
  }
  return body;
};
