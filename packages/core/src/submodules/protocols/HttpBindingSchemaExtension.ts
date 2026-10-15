import { NormalizedSchema, SchemaExtensionKey, translateTraits } from "@smithy/core/schema";
import type {
  OperationSchema,
  Schema,
  StaticStructureSchema,
  TimestampDateTimeSchema,
  TimestampEpochSecondsSchema,
  TimestampHttpDateSchema,
} from "@smithy/types";

import type { HttpBindingValueLocation } from "./serde/determineTimestampFormat";

const HTTP_BODY = 0;
const HTTP_HEADER = 1;
const HTTP_LABEL = 2;
const HTTP_PAYLOAD = 3;
const HTTP_PREFIX_HEADERS = 4;
const HTTP_QUERY = 5;
const HTTP_QUERY_PARAMS = 6;
const HTTP_RESPONSE_CODE = 7;

const HTTP_PATH_LITERAL = 0;
const HTTP_PATH_LABEL = 1;
const HTTP_PATH_GREEDY_LABEL = 2;

const HTTP_VALUE_OTHER = 0;
const HTTP_VALUE_STRING = 1;
const HTTP_VALUE_BLOB = 2;
const HTTP_VALUE_TIMESTAMP = 3;
const HTTP_VALUE_NUMBER = 4;
const HTTP_VALUE_BIG_INTEGER = 5;
const HTTP_VALUE_BIG_DECIMAL = 6;
const HTTP_VALUE_BOOLEAN = 7;
const HTTP_VALUE_LIST = 8;

type HttpBindingLocation =
  | typeof HTTP_BODY
  | typeof HTTP_HEADER
  | typeof HTTP_LABEL
  | typeof HTTP_PAYLOAD
  | typeof HTTP_PREFIX_HEADERS
  | typeof HTTP_QUERY
  | typeof HTTP_QUERY_PARAMS
  | typeof HTTP_RESPONSE_CODE;

export type HttpBindingTimestampFormat =
  | TimestampDateTimeSchema
  | TimestampHttpDateSchema
  | TimestampEpochSecondsSchema;

export interface HttpBindingValueMetadata {
  readonly kind:
    | typeof HTTP_VALUE_OTHER
    | typeof HTTP_VALUE_STRING
    | typeof HTTP_VALUE_BLOB
    | typeof HTTP_VALUE_TIMESTAMP
    | typeof HTTP_VALUE_NUMBER
    | typeof HTTP_VALUE_BIG_INTEGER
    | typeof HTTP_VALUE_BIG_DECIMAL
    | typeof HTTP_VALUE_BOOLEAN
    | typeof HTTP_VALUE_LIST;
  readonly timestampFormat: HttpBindingTimestampFormat | undefined;
  readonly mediaType: string | undefined;
  readonly isJsonMediaType: boolean;
  readonly idempotencyToken: boolean;
  readonly isStreaming: boolean;
  readonly isEventStream: boolean;
  readonly listValueSchema: NormalizedSchema | undefined;
  readonly listValueMetadata: HttpBindingValueMetadata | undefined;
}

export interface HttpRequestBindingMember {
  readonly memberName: string;
  readonly memberSchema: NormalizedSchema;
  readonly location: HttpBindingLocation;
  readonly wireName: string | undefined;
  readonly valueMetadata: HttpBindingValueMetadata;
  readonly collectionValueSchema: NormalizedSchema | undefined;
  readonly collectionValueMetadata: HttpBindingValueMetadata | undefined;
}

export interface HttpResponseHeaderBinding {
  readonly memberName: string;
  readonly memberSchema: NormalizedSchema;
  readonly wireName: string;
  readonly valueMetadata: HttpBindingValueMetadata;
  readonly listValueSchema: NormalizedSchema | undefined;
  readonly listValueMetadata: HttpBindingValueMetadata | undefined;
  readonly listDeserializerSchema: Schema | undefined;
  readonly splitTimestampList: boolean;
}

export interface HttpResponsePrefixHeadersBinding {
  readonly memberName: string;
  readonly memberSchema: NormalizedSchema;
  readonly prefix: string;
  readonly valueSchema: NormalizedSchema;
  readonly valueMetadata: HttpBindingValueMetadata;
}

export interface HttpRequestBindingExtension {
  readonly members: readonly HttpRequestBindingMember[];
  readonly labelNames: Readonly<Record<string, true>>;
  readonly bodySchema: StaticStructureSchema | undefined;
  /**
   * The fixed payload content type, `null` when the protocol default applies,
   * or `undefined` when the request has no modeled body or payload.
   */
  readonly contentType: string | null | undefined;
  readonly hasUnstructuredPayload: boolean;
}

export interface HttpResponseBindingExtension {
  readonly scalarHeadersByName: Readonly<Record<string, HttpResponseHeaderBinding>>;
  readonly scalarHeaderCount: number;
  readonly listHeaders: readonly HttpResponseHeaderBinding[];
  readonly prefixHeaders: readonly HttpResponsePrefixHeadersBinding[];
  readonly payloadMember: HttpRequestBindingMember | undefined;
  readonly responseCodeMember: string | undefined;
  readonly bodyMemberNames: string[] & { discardResponseBody?: boolean };
  readonly bodySchema: StaticStructureSchema | undefined;
}

/**
 * Direction-specific, lazily-computed HTTP binding metadata for a structure.
 *
 * @internal
 */
export class HttpStructBindingExtension {
  private requestBinding?: HttpRequestBindingExtension;
  private responseBinding?: HttpResponseBindingExtension;

  public constructor(private readonly schema: NormalizedSchema) {}

  public request(): HttpRequestBindingExtension {
    return (this.requestBinding ??= buildRequestBinding(this.schema));
  }

  public response(): HttpResponseBindingExtension {
    return (this.responseBinding ??= buildResponseBinding(this.schema));
  }
}

export interface HttpOperationBindingExtension {
  readonly method: string | undefined;
  readonly path: string | undefined;
  readonly pathSegments: readonly HttpPathSegment[] | undefined;
  readonly query: readonly (readonly [string, string])[];
}

export type HttpPathSegment = readonly [
  value: string,
  kind: typeof HTTP_PATH_LITERAL | typeof HTTP_PATH_LABEL | typeof HTTP_PATH_GREEDY_LABEL,
];

const structBindingKey = new SchemaExtensionKey<NormalizedSchema, HttpStructBindingExtension>({
  provide: (schema) => new HttpStructBindingExtension(schema),
});

const operationBindingKey = new SchemaExtensionKey<OperationSchema, HttpOperationBindingExtension>({
  provide: (schema) => {
    const http = translateTraits(schema.traits).http;
    if (!http) {
      return {
        method: undefined,
        path: undefined,
        pathSegments: undefined,
        query: [],
      };
    }

    const [path, search] = http[1].split("?");
    return {
      method: http[0],
      path,
      pathSegments: buildPathSegments(path),
      query: search ? [...new URLSearchParams(search)] : [],
    };
  },
});

/**
 * @internal
 */
export const getHttpStructBindingExtension = (schema: NormalizedSchema): HttpStructBindingExtension =>
  schema.getExtension(structBindingKey);

/**
 * @internal
 */
export const getHttpOperationBindingExtension = (schema: OperationSchema): HttpOperationBindingExtension =>
  operationBindingKey.get(schema);

function buildRequestBinding(schema: NormalizedSchema): HttpRequestBindingExtension {
  const members: HttpRequestBindingMember[] = [];
  const labelNames = Object.create(null) as Record<string, true>;
  const bodyMemberNames: StaticStructureSchema[4] = [];
  const bodyMemberSchemas: StaticStructureSchema[5] = [];
  let contentType: string | null | undefined;
  let hasUnstructuredPayload = false;

  for (const [memberName, memberSchema] of schema.structIterator()) {
    const traits = memberSchema.getMergedTraits();
    let location: HttpBindingLocation;
    let wireName: string | undefined;

    if (traits.httpPayload) {
      location = HTTP_PAYLOAD;
      contentType =
        (traits.mediaType as string | undefined) ??
        (memberSchema.isStringSchema()
          ? "text/plain"
          : memberSchema.isBlobSchema()
            ? "application/octet-stream"
            : null);
      hasUnstructuredPayload =
        !memberSchema.isStructSchema() && !memberSchema.isMapSchema() && !memberSchema.isListSchema();
    } else if (traits.httpLabel) {
      location = HTTP_LABEL;
      labelNames[memberName] = true;
    } else if (traits.httpHeader) {
      location = HTTP_HEADER;
      wireName = traits.httpHeader.toLowerCase();
    } else if (typeof traits.httpPrefixHeaders === "string") {
      location = HTTP_PREFIX_HEADERS;
      wireName = traits.httpPrefixHeaders.toLowerCase();
    } else if (traits.httpQuery) {
      location = HTTP_QUERY;
      wireName = traits.httpQuery;
    } else if (traits.httpQueryParams) {
      location = HTTP_QUERY_PARAMS;
    } else {
      location = HTTP_BODY;
      bodyMemberNames.push(memberName);
      bodyMemberSchemas.push(memberSchema);
    }

    members.push({
      memberName,
      memberSchema,
      location,
      wireName,
      valueMetadata: buildValueMetadata(memberSchema, bindingValueLocation(location)),
      collectionValueSchema:
        location === HTTP_PREFIX_HEADERS || location === HTTP_QUERY_PARAMS ? memberSchema.getValueSchema() : undefined,
      collectionValueMetadata:
        location === HTTP_PREFIX_HEADERS || location === HTTP_QUERY_PARAMS
          ? buildValueMetadata(memberSchema.getValueSchema(), location === HTTP_PREFIX_HEADERS ? "header" : "query")
          : undefined,
    });
  }

  if (contentType === undefined && bodyMemberNames.length) {
    contentType = null;
  }

  return {
    members,
    labelNames,
    bodySchema: createBodySchema(schema, bodyMemberNames, bodyMemberSchemas),
    contentType,
    hasUnstructuredPayload,
  };
}

function buildResponseBinding(schema: NormalizedSchema): HttpResponseBindingExtension {
  const scalarHeadersByName = Object.create(null) as Record<string, HttpResponseHeaderBinding>;
  const listHeaders: HttpResponseHeaderBinding[] = [];
  const prefixHeaders: HttpResponsePrefixHeadersBinding[] = [];
  const bodyMemberNames = [] as string[] & { discardResponseBody?: boolean };
  const bodyMemberSchemas: StaticStructureSchema[5] = [];
  let payloadMember: HttpRequestBindingMember | undefined;
  let responseCodeMember: string | undefined;

  for (const [memberName, memberSchema] of schema.structIterator()) {
    const traits = memberSchema.getMemberTraits();

    if (traits.httpPayload) {
      payloadMember = {
        memberName,
        memberSchema,
        location: HTTP_PAYLOAD,
        wireName: undefined,
        valueMetadata: buildValueMetadata(memberSchema),
        collectionValueSchema: undefined,
        collectionValueMetadata: undefined,
      };
    } else if (traits.httpHeader) {
      const wireName = String(traits.httpHeader).toLowerCase();
      const valueMetadata = buildValueMetadata(memberSchema, "header");
      const listValueSchema = memberSchema.isListSchema() ? memberSchema.getValueSchema() : undefined;
      const binding: HttpResponseHeaderBinding = {
        memberName,
        memberSchema,
        wireName,
        valueMetadata,
        listValueSchema,
        listValueMetadata: valueMetadata.listValueMetadata,
        listDeserializerSchema: listValueSchema ? [listValueSchema, { httpHeader: wireName }] : undefined,
        splitTimestampList:
          valueMetadata.listValueMetadata?.kind === HTTP_VALUE_TIMESTAMP &&
          valueMetadata.listValueMetadata.timestampFormat === (6 satisfies TimestampHttpDateSchema),
      };
      if (listValueSchema) {
        listHeaders.push(binding);
      } else {
        scalarHeadersByName[wireName] = binding;
      }
    } else if (traits.httpPrefixHeaders !== undefined) {
      prefixHeaders.push({
        memberName,
        memberSchema,
        prefix: String(traits.httpPrefixHeaders).toLowerCase(),
        valueSchema: memberSchema.getValueSchema(),
        valueMetadata: buildValueMetadata(memberSchema.getValueSchema(), "header"),
      });
    } else if (traits.httpResponseCode) {
      responseCodeMember = memberName;
    } else {
      bodyMemberNames.push(memberName);
      bodyMemberSchemas.push(memberSchema);
    }
  }

  bodyMemberNames.discardResponseBody = payloadMember === undefined;

  return {
    scalarHeadersByName,
    scalarHeaderCount: Object.keys(scalarHeadersByName).length,
    listHeaders,
    prefixHeaders,
    payloadMember,
    responseCodeMember,
    bodyMemberNames,
    bodySchema: createBodySchema(schema, bodyMemberNames, bodyMemberSchemas),
  };
}

function buildPathSegments(path: string): readonly HttpPathSegment[] | undefined {
  const segments: HttpPathSegment[] = [];
  const labelPattern = /\{([^{}+]+)(\+)?\}/g;
  let offset = 0;
  let match: RegExpExecArray | null;

  while ((match = labelPattern.exec(path))) {
    if (match.index > offset) {
      segments.push([path.slice(offset, match.index), HTTP_PATH_LITERAL]);
    }
    segments.push([match[1], match[2] ? HTTP_PATH_GREEDY_LABEL : HTTP_PATH_LABEL]);
    offset = match.index + match[0].length;
  }

  if (!segments.length) {
    return undefined;
  }
  if (offset < path.length) {
    segments.push([path.slice(offset), HTTP_PATH_LITERAL]);
  }
  return segments;
}

function bindingValueLocation(location: HttpBindingLocation): HttpBindingValueLocation | undefined {
  switch (location) {
    case HTTP_HEADER:
    case HTTP_PREFIX_HEADERS:
      return "header";
    case HTTP_LABEL:
      return "label";
    case HTTP_QUERY:
    case HTTP_QUERY_PARAMS:
      return "query";
    default:
      return undefined;
  }
}

function buildValueMetadata(schema: NormalizedSchema, location?: HttpBindingValueLocation): HttpBindingValueMetadata {
  const traits = schema.getMergedTraits();
  let kind: HttpBindingValueMetadata["kind"];
  let listValueSchema: NormalizedSchema | undefined;
  let listValueMetadata: HttpBindingValueMetadata | undefined;

  if (schema.isListSchema()) {
    kind = HTTP_VALUE_LIST;
    listValueSchema = schema.getValueSchema();
    listValueMetadata = buildValueMetadata(NormalizedSchema.of([listValueSchema, traits]), location);
  } else if (schema.isBlobSchema()) {
    kind = HTTP_VALUE_BLOB;
  } else if (schema.isTimestampSchema()) {
    kind = HTTP_VALUE_TIMESTAMP;
  } else if (schema.isStringSchema()) {
    kind = HTTP_VALUE_STRING;
  } else if (schema.isNumericSchema()) {
    kind = HTTP_VALUE_NUMBER;
  } else if (schema.isBigIntegerSchema()) {
    kind = HTTP_VALUE_BIG_INTEGER;
  } else if (schema.isBigDecimalSchema()) {
    kind = HTTP_VALUE_BIG_DECIMAL;
  } else if (schema.isBooleanSchema()) {
    kind = HTTP_VALUE_BOOLEAN;
  } else {
    kind = HTTP_VALUE_OTHER;
  }

  const mediaType = traits.mediaType as string | undefined;
  const rawSchema = schema.getSchema();
  const isStreaming = !!traits.streaming || rawSchema === 42;

  return {
    kind,
    timestampFormat:
      kind === HTTP_VALUE_TIMESTAMP
        ? rawSchema === 5 || rawSchema === 6 || rawSchema === 7
          ? rawSchema
          : location === "header"
            ? (6 satisfies TimestampHttpDateSchema)
            : location === "label" || location === "query"
              ? (5 satisfies TimestampDateTimeSchema)
              : undefined
        : undefined,
    mediaType,
    isJsonMediaType: !!mediaType && (mediaType === "application/json" || mediaType.endsWith("+json")),
    idempotencyToken: !!traits.idempotencyToken,
    isStreaming,
    isEventStream: isStreaming && schema.isStructSchema(),
    listValueSchema,
    listValueMetadata,
  };
}

function createBodySchema(
  schema: NormalizedSchema,
  memberNames: StaticStructureSchema[4],
  memberSchemas: StaticStructureSchema[5]
): StaticStructureSchema | undefined {
  if (!memberNames.length) {
    return undefined;
  }

  const source = schema.getSchema() as StaticStructureSchema;
  const bodySchema: StaticStructureSchema = [
    3,
    source[1],
    source[2],
    schema.getMergedTraits(),
    memberNames,
    memberSchemas,
  ];
  const requiredMemberCount = source[6] ?? 0;
  if (requiredMemberCount) {
    const requiredMemberNames = new Set(source[4].slice(0, requiredMemberCount));
    const bodyRequiredMemberCount = memberNames.reduce(
      (count, memberName) => count + Number(requiredMemberNames.has(memberName)),
      0
    );
    if (bodyRequiredMemberCount) {
      bodySchema[6] = bodyRequiredMemberCount;
    }
  }
  return bodySchema;
}

export const HttpBindingLocation = {
  BODY: HTTP_BODY,
  HEADER: HTTP_HEADER,
  LABEL: HTTP_LABEL,
  PAYLOAD: HTTP_PAYLOAD,
  PREFIX_HEADERS: HTTP_PREFIX_HEADERS,
  QUERY: HTTP_QUERY,
  QUERY_PARAMS: HTTP_QUERY_PARAMS,
  RESPONSE_CODE: HTTP_RESPONSE_CODE,
} as const;

export const HttpPathSegmentKind = {
  LITERAL: HTTP_PATH_LITERAL,
  LABEL: HTTP_PATH_LABEL,
  GREEDY_LABEL: HTTP_PATH_GREEDY_LABEL,
} as const;

export const HttpBindingValueKind = {
  OTHER: HTTP_VALUE_OTHER,
  STRING: HTTP_VALUE_STRING,
  BLOB: HTTP_VALUE_BLOB,
  TIMESTAMP: HTTP_VALUE_TIMESTAMP,
  NUMBER: HTTP_VALUE_NUMBER,
  BIG_INTEGER: HTTP_VALUE_BIG_INTEGER,
  BIG_DECIMAL: HTTP_VALUE_BIG_DECIMAL,
  BOOLEAN: HTTP_VALUE_BOOLEAN,
  LIST: HTTP_VALUE_LIST,
} as const;

/**
 * Resolves the effective request content type from cached HTTP binding data.
 *
 * @internal
 */
export const resolveHttpBindingContentType = (
  defaultContentType: string,
  schema: NormalizedSchema
): string | undefined => {
  const contentType = getHttpStructBindingExtension(schema).request().contentType;
  return contentType === null ? defaultContentType : contentType;
};

/**
 * Returns whether the request has a simple, unstructured `@httpPayload`.
 *
 * @internal
 */
export const hasHttpBindingUnstructuredPayload = (schema: NormalizedSchema): boolean =>
  getHttpStructBindingExtension(schema).request().hasUnstructuredPayload;
