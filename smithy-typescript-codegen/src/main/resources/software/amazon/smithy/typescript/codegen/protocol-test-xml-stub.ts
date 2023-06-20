/**
 * Returns a map of key names that were un-equal to value objects showing the
 * discrepancies between the components.
 */
const compareEquivalentXmlBodies = (
  expectedBody: string,
  generatedBody: string
): Object => {
  const parseConfig = {
    attributeNamePrefix: "",
    htmlEntities: true,
    ignoreAttributes: false,
    ignoreDeclaration: true,
    parseTagValue: false,
    trimValues: false,
    tagValueProcessor: (_: any, val: any) => (val.trim() === "" && val.includes("\n") ? "" : undefined),
  };

  const parseXmlBody = (body: string) => {
    const parser = new XMLParser(parseConfig);
    parser.addEntity("#xD", "\r");
    parser.addEntity("#10", "\n");
    const parsedObj = parser.parse(body);
    const textNodeName = "#text";
    const key = Object.keys(parsedObj)[0];
    const parsedObjToReturn = parsedObj[key];
    if (parsedObjToReturn[textNodeName]) {
      parsedObjToReturn[key] = parsedObjToReturn[textNodeName];
      delete parsedObjToReturn[textNodeName];
    }
    return parsedObj;
  };

  const expectedParts = parseXmlBody(expectedBody);
  const generatedParts = parseXmlBody(generatedBody);

  return compareParts(expectedParts, generatedParts);
};
