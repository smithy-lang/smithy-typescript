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
    ignoreAttributes: false,
    parseTagValue: false,
    trimValues: false,
    tagValueProcessor: (val: any, tagName: any) =>
      val.trim() === "" ? "" : decodeHTML(val),
  };

  const parseXmlBody = (body: string) => {
    const parsedObj = new XMLParser(parseConfig).parse(body);
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
