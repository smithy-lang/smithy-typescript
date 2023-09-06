import { requireRequestsFrom } from "@smithy/util-test";
import { Weather } from "weather";

describe("middleware-apply-body-checksum", () => {
  describe(Weather.name, () => {
    it("should add body-checksum", async () => {
      const client = new Weather({ endpoint: "https://foo.bar" });
      requireRequestsFrom(client).toMatch({
        headers: {
          "content-md5": /^.{22}(==)?$/i,
        },
      });

      await client.getCity({
        cityId: "my-city",
      });

      expect.assertions(1);
    });
  });
});
