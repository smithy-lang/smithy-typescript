import { translateTraits, type NormalizedSchema } from "@smithy/core/schema";
import type { OperationSchema, StaticStructureSchema } from "@smithy/types";

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

/** The low byte is the schema type. Higher bits cache HTTP serde traits. @internal */
export type HttpBindingValue = readonly [schema: NormalizedSchema, flags: number, collectionValue?: HttpBindingValue];

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
type HttpBodyMemberNames = string[] & {
  discardResponseBody?: boolean;
  schema?: StaticStructureSchema;
};
type HttpBindingIndex = HttpBinding[] & {
  byName: Readonly<Record<string, HttpBinding>>;
  hasIdempotency?: boolean;
  schema?: StaticStructureSchema;
  contentType?: string | null;
  responseBody: HttpBodyMemberNames;
  responsePayload?: HttpBinding;
  responseCode?: HttpBinding;
  responseHeaders: Readonly<Record<string, HttpBinding>>;
  responsePrefixHeaders: readonly HttpBinding[];
};
type HttpBindingSchema = StaticStructureSchema & { [HTTP_BINDINGS]?: HttpBindingIndex };
type HttpOperationSchema = OperationSchema & { [HTTP_BINDINGS]?: HttpOperationBindings };

const getHttpBindingLocation = (traits: ReturnType<NormalizedSchema["getMergedTraits"]>): HttpBindingLocation => {
  if (traits.httpPayload) return 0b100_100 satisfies HttpPayload;
  if (traits.httpLabel) return 0b100_001 satisfies HttpLabel;
  if (traits.httpHeader) return 0b100_110 satisfies HttpHeader;
  if (typeof traits.httpPrefixHeaders === "string") return 0b100_111 satisfies HttpPrefixHeaders;
  if (traits.httpQuery) return 0b100_010 satisfies HttpQuery;
  if (traits.httpQueryParams) return 0b100_011 satisfies HttpQueryParams;
  if (traits.httpResponseCode) return 0b100_101 satisfies HttpResponseCode;
  return 0b100_000 satisfies HttpBody;
};

export const getHttpBindingValue = (
  schema: NormalizedSchema,
  location: HttpBindingLocation,
  traits = schema.getMergedTraits(),
  collection = schema.isListSchema()
): HttpBindingValue => {
  const raw = schema.getSchema();
  const type = typeof raw === "number" ? raw & 0xff : schema.isListSchema() ? 0b0100_0000 : 0xff;
  const slot = location & 0b111;
  const media = (
    traits.mediaType ? (traits.mediaType === "application/json" || traits.mediaType.endsWith("+json") ? 2 : 1) : 0
  ) satisfies 0 | 1 | 2;
  const stream = (traits.streaming || type === 42 ? (schema.isStructSchema() ? 2 : 1) : 0) satisfies 0 | 1 | 2;
  const timestamp = (type >= 4 && type <= 7 ? (slot >= 6 ? 2 : slot > 0 && slot < 4 ? 1 : 0) : 0) satisfies 0 | 1 | 2;
  let flags =
    type |
    (media << 8) |
    (Number(!!traits.idempotencyToken) << 10) |
    (stream << 11) |
    (Number(!!traits.sparse) << 13) |
    (timestamp << 14) |
    (Number(!!traits.hostLabel) << 17) |
    (Number(
      location === (0b100_100 satisfies HttpPayload) &&
        !schema.isStructSchema() &&
        !schema.isMapSchema() &&
        !schema.isListSchema()
    ) <<
      18);
  const valueSchema = collection ? schema.getValueSchema() : undefined;
  const collectionValue = valueSchema
    ? getHttpBindingValue(valueSchema, location, { ...valueSchema.getMergedTraits(), ...traits })
    : undefined;
  const valueType = (collectionValue?.[1] ?? 0) & 0xff;
  flags |= Number(slot >= 6 && (valueType === 4 || valueType === 6)) << 16;
  return [schema, flags, collectionValue];
};

export const resolveHttpBinding = (
  schema: NormalizedSchema
): readonly [location: HttpBindingLocation, value: HttpBindingValue] => {
  const traits = schema.getMergedTraits();
  const location = getHttpBindingLocation(traits);
  return [location, getHttpBindingValue(schema, location, traits)];
};

const buildHttpBindings = (schema: NormalizedSchema): HttpBindingIndex => {
  const bodyMemberNames: HttpBodyMemberNames = [];
  const bodyMemberSchemas: StaticStructureSchema[5] = [];
  const requestBodyMemberNames: StaticStructureSchema[4] = [];
  const requestBodyMemberSchemas: StaticStructureSchema[5] = [];
  const byName: Record<string, HttpBinding> = Object.create(null);
  const headers: Record<string, HttpBinding> = Object.create(null);
  const prefixHeaders: HttpBinding[] = [];
  const bindings: HttpBindingIndex = Object.assign([], {
    byName,
    responseBody: bodyMemberNames,
    responseHeaders: headers,
    responsePrefixHeaders: prefixHeaders,
  });

  for (const [name, member] of schema.structIterator()) {
    const traits = member.getMergedTraits();
    const location = getHttpBindingLocation(traits);
    let wireName: string | undefined;
    if (location === (0b100_110 satisfies HttpHeader)) {
      wireName = traits.httpHeader!.toLowerCase();
    } else if (location === (0b100_111 satisfies HttpPrefixHeaders)) {
      wireName = traits.httpPrefixHeaders!.toLowerCase();
    } else if (location === (0b100_010 satisfies HttpQuery)) {
      wireName = traits.httpQuery;
    }
    const value = getHttpBindingValue(
      member,
      location,
      traits,
      member.isListSchema() ||
        location === (0b100_011 satisfies HttpQueryParams) ||
        location === (0b100_111 satisfies HttpPrefixHeaders)
    );
    const binding: HttpBinding = [name, value, location, wireName];
    byName[name] = binding;
    if ((value[1] >> 10) & 1) bindings.hasIdempotency = true;
    bindings.push(binding);

    const slot = location & 0b111;
    if (slot === 0) {
      requestBodyMemberNames.push(name);
      requestBodyMemberSchemas.push(member);
    }
    if ((slot & 0b100) === 0) {
      bodyMemberNames.push(name);
      bodyMemberSchemas.push(member);
    } else if ((slot & 0b110) === 0b100) {
      if (slot & 0b001) bindings.responseCode = binding;
      else {
        bindings.responsePayload = binding;
        const type = value[1] & 0xff;
        bindings.contentType =
          traits.mediaType ??
          (type === 0 ? "text/plain" : type === 21 || type === 42 ? "application/octet-stream" : null);
      }
    } else if (slot & 0b001) {
      prefixHeaders.push(binding);
    } else {
      headers[wireName!] = binding;
    }
  }
  if (bindings.contentType === undefined && requestBodyMemberNames.length) bindings.contentType = null;
  bindings.schema = createBodySchema(schema, requestBodyMemberNames, requestBodyMemberSchemas);
  bodyMemberNames.discardResponseBody = bindings.responsePayload === undefined;
  bodyMemberNames.schema = createBodySchema(schema, [...bodyMemberNames], bodyMemberSchemas);
  return bindings;
};

const buildPathSegments = (path: string): readonly HttpPathSegment[] | undefined => {
  const segments: HttpPathSegment[] = [];
  let offset = 0;
  for (const match of path.matchAll(/\{([^{}+]+)(\+)?\}/g)) {
    if (match.index > offset) segments.push([path.slice(offset, match.index), 0]);
    segments.push([match[1], match[2] ? 2 : 1]);
    offset = match.index + match[0].length;
  }
  if (segments.length && offset < path.length) segments.push([path.slice(offset), 0]);
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

const EMPTY_BODY_MEMBERS: HttpBodyMemberNames = [];
EMPTY_BODY_MEMBERS.discardResponseBody = true;
const EMPTY_BINDINGS: HttpBindingIndex = Object.assign([], {
  byName: {},
  responseBody: EMPTY_BODY_MEMBERS,
  responseHeaders: {},
  responsePrefixHeaders: [],
});

/** Returns cached structure member HTTP bindings. @internal */
export const getHttpBindings = (schema: NormalizedSchema): HttpBindingIndex => {
  const source = schema.getSchema() as HttpBindingSchema;
  return typeof source !== "object" || source === null
    ? EMPTY_BINDINGS
    : (source[HTTP_BINDINGS] ??= buildHttpBindings(schema));
};

/** @internal */
export const getHttpOperationBindings = (schema: OperationSchema): HttpOperationBindings => {
  const source = schema as HttpOperationSchema;
  return (source[HTTP_BINDINGS] ??= buildHttpOperationBindings(schema));
};

/** @internal */
export const resolveHttpBindingContentType = (
  defaultContentType: string,
  schema: NormalizedSchema
): string | undefined => {
  const contentType = getHttpBindings(schema).contentType;
  return contentType === null ? defaultContentType : contentType;
};

/** @internal */
export const hasHttpBindingUnstructuredPayload = (schema: NormalizedSchema): boolean =>
  !!((getHttpBindings(schema).responsePayload?.[1][1] ?? 0) & (1 << 18));

const createBodySchema = (
  schema: NormalizedSchema,
  memberNames: StaticStructureSchema[4],
  memberSchemas: StaticStructureSchema[5]
): StaticStructureSchema | undefined => {
  if (!memberNames.length) return undefined;
  const source = schema.getSchema() as StaticStructureSchema;
  const body: StaticStructureSchema = [3, source[1], source[2], schema.getMergedTraits(), memberNames, memberSchemas];
  const required = source[6];
  const bodyRequired =
    required && memberNames.reduce((count, name) => count + Number(source[4].indexOf(name) < required), 0);
  if (bodyRequired) body[6] = bodyRequired;
  return body;
};
