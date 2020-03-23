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

  const parseXmlBody = (body: string) => {
    const parsedObj = xmlParse(body, parseConfig);
    const textNodeName = "#text";
    const key = Object.keys(parsedObj)[0];
    const parsedObjToReturn = parsedObj[key];
    if (parsedObjToReturn[textNodeName]) {
      parsedObjToReturn[key] = parsedObjToReturn[textNodeName];
      delete parsedObjToReturn[textNodeName];
    }
    return parsedObjToReturn;
  };

  const expectedParts = parseXmlBody(expectedBody);
  const generatedParts = parseXmlBody(generatedBody);

  return compareParts(expectedParts, generatedParts);
}
