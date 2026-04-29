import { requireRequestsFrom } from "@smithy/util-test/src";
import { describe, test as it } from "vitest";
import { Weather } from "weather";

describe("middleware-serde", () => {
  describe(Weather.name, () => {
    it("should serialize TestProtocol", async () => {
      const client = new Weather({
        endpoint: "https://foo.bar",
        region: "us-west-2",
        credentials: {
          accessKeyId: "INTEG",
          secretAccessKey: "INTEG",
        },
      });
      requireRequestsFrom(client).toMatch({
        method: "PUT",
        hostname: "foo.bar",
        body: "{}",
        protocol: "https:",
        path: "/city",
      });
      await client.createCity({
        name: "MyCity",
        coordinates: {
          latitude: 0,
          longitude: 0,
        },
      });
    });
  });
});
