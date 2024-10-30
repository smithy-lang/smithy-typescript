import { describe, test as it } from "vitest";
import { Weather } from "weather";

import { requireRequestsFrom } from "../../../private/util-test/src/index";

describe("middleware-serde", () => {
  describe(Weather.name, () => {
    it("should serialize TestProtocol", async () => {
      const client = new Weather({ endpoint: "https://foo.bar" });
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
