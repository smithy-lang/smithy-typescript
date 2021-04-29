/**
 * Returns a map of key names that were un-equal to value objects showing the
 * discrepancies between the components.
 */
const compareEquivalentUnknownTypeBodies = (
  utf8Encoder: __Encoder,
  expectedBody: string,
  generatedBody: string | Uint8Array
): Object => {
  const expectedParts = {Value: expectedBody};
  const generatedParts = {
    Value: generatedBody instanceof Uint8Array ? utf8Encoder(generatedBody) : generatedBody
  };

  return compareParts(expectedParts, generatedParts);
}
