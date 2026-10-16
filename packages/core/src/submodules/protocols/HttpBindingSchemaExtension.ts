import type { NormalizedSchema } from "@smithy/core/schema";
import type { StaticStructureSchema } from "@smithy/types";

export type HttpBody = 0;
export type HttpHeader = 1;
export type HttpQuery = 2;
export type HttpLabel = 3;
export type HttpPayload = 4;
export type HttpPrefixHeaders = 5;
export type HttpQueryParams = 6;
export type HttpResponseCode = 7;

export type HttpBindingLocation =
  | HttpBody
  | HttpHeader
  | HttpQuery
  | HttpLabel
  | HttpPayload
  | HttpPrefixHeaders
  | HttpQueryParams
  | HttpResponseCode;

export type HttpBinding = readonly [
  memberName: string,
  memberSchema: NormalizedSchema,
  location: HttpBindingLocation,
  wireName?: string,
];

const HTTP_BINDINGS = Symbol.for("@smithy/schema-x");
type HttpBindingSchema = StaticStructureSchema & { [HTTP_BINDINGS]?: readonly HttpBinding[] };

const buildHttpBindings = (schema: NormalizedSchema): readonly HttpBinding[] => {
  const bindings: HttpBinding[] = [];
  for (const [name, member] of schema.structIterator()) {
    const traits = member.getMergedTraits();
    let location: HttpBindingLocation = 0 satisfies HttpBody;
    let wireName: string | undefined;
    if (traits.httpPayload) location = 4 satisfies HttpPayload;
    else if (traits.httpLabel) location = 3 satisfies HttpLabel;
    else if (traits.httpHeader) {
      location = 1 satisfies HttpHeader;
      wireName = traits.httpHeader.toLowerCase();
    } else if (typeof traits.httpPrefixHeaders === "string") {
      location = 5 satisfies HttpPrefixHeaders;
      wireName = traits.httpPrefixHeaders.toLowerCase();
    } else if (traits.httpQuery) {
      location = 2 satisfies HttpQuery;
      wireName = traits.httpQuery;
    } else if (traits.httpQueryParams) location = 6 satisfies HttpQueryParams;
    else if (traits.httpResponseCode) location = 7 satisfies HttpResponseCode;
    bindings.push([name, member, location, wireName]);
  }
  return bindings;
};

/**
 * Returns cached HTTP binding information for the members of a structure.
 *
 * @internal
 */
export const getHttpBindings = (schema: NormalizedSchema): readonly HttpBinding[] => {
  const source = schema.getSchema() as HttpBindingSchema;
  if (typeof source !== "object" || source === null) {
    return [];
  }
  return (source[HTTP_BINDINGS] ??= buildHttpBindings(schema));
};

/**
 * @internal
 */
export const resolveHttpBindingContentType = (
  defaultContentType: string,
  schema: NormalizedSchema
): string | undefined => {
  let hasBody = false;
  for (const [, member, location] of getHttpBindings(schema)) {
    if (location === (4 satisfies HttpPayload)) {
      const mediaType = member.getMergedTraits().mediaType;
      return (
        mediaType ??
        (member.isStringSchema()
          ? "text/plain"
          : member.isBlobSchema()
            ? "application/octet-stream"
            : defaultContentType)
      );
    }
    hasBody ||= location === (0 satisfies HttpBody) || location === (7 satisfies HttpResponseCode);
  }
  return hasBody ? defaultContentType : undefined;
};

/**
 * @internal
 */
export const hasHttpBindingUnstructuredPayload = (schema: NormalizedSchema): boolean => {
  for (const [, member, location] of getHttpBindings(schema)) {
    if (location === (4 satisfies HttpPayload)) {
      return !member.isStructSchema() && !member.isMapSchema() && !member.isListSchema();
    }
  }
  return false;
};
