/**
 * Returns a map of key names that were un-equal to value objects showing the
 * discrepancies between the components.
 */
const compareEquivalentFormUrlencodedBodies = (expectedBody: string, generatedBody: string): Object => {
  const fromEntries = (components: string[][]): { [key: string]: string } => {
    const parts: { [key: string]: string } = {};

    components.forEach(component => {
      parts[component[0]] = component[1];
    });

    return parts;
  };

  // Generate to k:v maps from query components
  const expectedParts = fromEntries(expectedBody.split("&").map(part => part.trim().split("=")));
  const generatedParts = fromEntries(generatedBody.split("&").map(part => part.trim().split("=")));

  return compareParts(expectedParts, generatedParts);
}
