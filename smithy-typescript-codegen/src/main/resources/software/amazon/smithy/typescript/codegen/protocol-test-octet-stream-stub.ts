/**
 * Returns a map of key names that were un-equal to value objects showing the
 * discrepancies between the components.
 */
const compareEquivalentOctetStreamBodies = (
  config: any,
  expectedBody: string,
  generatedBody: Uint8Array
): Object => {
  const expectedParts = {Value: expectedBody};
  const generatedParts = {Value: config.utf8Encoder(generatedBody)};

  return compareParts(expectedParts, generatedParts);
}
