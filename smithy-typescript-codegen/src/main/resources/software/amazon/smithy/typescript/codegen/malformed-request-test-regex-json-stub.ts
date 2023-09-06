/**
 * Returns 'true' if the 'message' field in the serialized JSON document matches the given regex.
 */
const matchMessageInJsonBody = (body: string, messageRegex: string): Object => {
  const parsedBody = JSON.parse(body);
  if (!parsedBody.hasOwnProperty("message")) {
    return false;
  }
  return new RegExp(messageRegex).test(parsedBody["message"]);
}
