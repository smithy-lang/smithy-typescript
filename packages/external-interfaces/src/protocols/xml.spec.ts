import { XMLParser } from "./xml";

describe("XMLParser", () => {
  it("parses XML", () => {
    const parser = new XMLParser({
      attributeNamePrefix: "",
      htmlEntities: true,
      ignoreAttributes: false,
      ignoreDeclaration: true,
      parseTagValue: false,
      trimValues: false,
      tagValueProcessor: (_: any, val: any) => (val.trim() === "" && val.includes("\n") ? "" : undefined),
    });
    parser.addEntity("#xD", "\r");
    parser.addEntity("#10", "\n");

    const xml = `
<Error>
  <Code>InvalidObjectState</Code>
  <Message>The action is not valid for the object's storage class</Message>
  <RequestId>9FEFFF118E15B86F</RequestId>
  <HostId>WVQ5kzhiT+oiUfDCOiOYv8W4Tk9eNcxWi/MK+hTS/av34Xy4rBU3zsavf0aaaaa</HostId>
</Error>`;

    const parsed = parser.parse(xml);

    expect(parsed).toEqual({
      Error: {
        Code: "InvalidObjectState",
        Message: "The action is not valid for the object's storage class",
        RequestId: "9FEFFF118E15B86F",
        HostId: "WVQ5kzhiT+oiUfDCOiOYv8W4Tk9eNcxWi/MK+hTS/av34Xy4rBU3zsavf0aaaaa",
      },
    });

    // *clapping*
  });
});
