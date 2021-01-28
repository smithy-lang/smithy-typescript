/**
 * Returns a map of key names that were un-equal to value objects showing the
 * discrepancies between the components.
 */
const compareEquivalentTextBodies = (expectedBody: string, generatedBody: string): Object => {
  const expectedParts = {Value: expectedBody};
  const generatedParts = {Value: generatedBody};

  return compareParts(expectedParts, generatedParts);
}
