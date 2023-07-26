import { requireRequestsFrom } from "@smithy/util-test";
import { Weather } from "weather";

describe("middleware-retry", () => {
  describe(Weather.name, () => {
    it("should set retry headers", async () => {
      const client = new Weather({ endpoint: "https://foo.bar" });

      requireRequestsFrom(client).toMatch({
        hostname: "foo.bar",
        headers: {
          "amz-sdk-invocation-id": /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/,
          "amz-sdk-request": "attempt=1; max=3",
        },
      });

      await client.getCity({
        cityId: "my-city",
      });

      expect.hasAssertions();
    });
  });
});
