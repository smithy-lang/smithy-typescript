import { describe, expect, test as it } from "vitest";
import { Weather } from "weather";

import { requireRequestsFrom } from "../../../private/util-test/src/index";

describe("middleware-retry", () => {
  describe(Weather.name, () => {
    it("should set retry headers", async () => {
      const client = new Weather({
        endpoint: "https://foo.bar",
        region: "us-west-2",
        credentials: {
          accessKeyId: "INTEG",
          secretAccessKey: "INTEG",
        },
      });

      requireRequestsFrom(client).toMatch({
        hostname: "foo.bar",
        headers: {
          "amz-sdk-invocation-id":
            /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/,
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
