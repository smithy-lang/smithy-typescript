/**
 * A function for matching the 'Accept' header to an explicit MIME type.
 *
 * @param acceptHeader the header as specified by the caller
 * @param responseContentType the content type that we expect to return
 * @return true if the specified content-type is acceptable given the Accept value
 */
export const acceptMatches = (acceptHeader: string | null | undefined, responseContentType: string): boolean => {
  if (acceptHeader === null || acceptHeader === undefined) {
    return true;
  }

  // see: https://datatracker.ietf.org/doc/html/rfc7231#section-5.3.2
  // we only care if anything in Accept matches a content-type we want to respond with,
  // so we disregard all of the accept-params
  const acceptableContentTypes = acceptHeader.split(",").map((s) => s.split(";")[0].trim());
  const responsePrimaryType = responseContentType.split("/")[0];

  for (const type of acceptableContentTypes) {
    if (type === "*/*" || type === `${responsePrimaryType}/*` || type === responseContentType) {
      return true;
    }
  }

  return false;
};
