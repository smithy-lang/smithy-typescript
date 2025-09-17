import { describe, expect, test as it } from "vitest";
import { Weather } from "weather";

import { requireRequestsFrom } from "../../../private/util-test/src/index";

describe("middleware-content-length", () => {
  describe(Weather.name, () => {
    it("should not add content-length if no body", async () => {
      const client = new Weather({
        endpoint: "https://foo.bar",
        region: "us-west-2",
        credentials: {
          accessKeyId: "INTEG",
          secretAccessKey: "INTEG",
        },
      });
      requireRequestsFrom(client).toMatch({
        headers: {
          "content-length": /undefined/,
        },
      });

      await client.getCity({
        cityId: "my-city",
      });

      expect.assertions(1);
    });

    // Weather uses TestProtocolGenerator, which serializes all bodies as `{}`.
    // This tests that content-length gets set to `2`, only where bodies are
    // sent in the request.
    it("should add content-length if body present", async () => {
      const client = new Weather({
        endpoint: "https://foo.bar",
        region: "us-west-2",
        credentials: {
          accessKeyId: "INTEG",
          secretAccessKey: "INTEG",
        },
      });
      requireRequestsFrom(client).toMatch({
        headers: {
          "content-length": /2/,
        },
      });

      await client.createCity({
        name: "MyCity",
        coordinates: {
          latitude: 0,
          longitude: 0,
        },
      });

      expect.assertions(1);
    });
  });
});
