/**
 * Returns a map of key names that were un-equal to value objects showing the
 * discrepancies between the components.
 */
const compareEquivalentBodies = (expectedBody: string, generatedBody: string): Object => {
  const decodeEscapedXml = (str: string) => {
    return str
      .replace(/&amp;/g, "&")
      .replace(/&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&gt;/g, ">")
      .replace(/&lt;/g, "<");
  };

  const parseConfig = {
    attributeNamePrefix: '',
    ignoreAttributes: false,
    parseNodeValue: false,
    tagValueProcessor: (val: any, tagName: any) => decodeEscapedXml(val)
  };

  const expectedParts = xmlParse(expectedBody, parseConfig);
  const generatedParts = xmlParse(generatedBody, parseConfig);

  return compareParts(expectedParts, generatedParts);
}
