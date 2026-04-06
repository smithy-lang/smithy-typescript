import type { StandardRetryToken } from "@smithy/types";
import { StandardRetryStrategy } from "@smithy/util-retry";
import { describe, expect, test as it } from "vitest";
import { Weather } from "weather";

import { requireRequestsFrom } from "../../../private/util-test/src/index";
import { getLongPollPlugin } from "./longPollMiddleware";

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

    it("acquires retry tokens in long poll mode when the long poll plugin is attached", async () => {
      const client = new Weather({
        endpoint: "https://foo.bar",
        region: "us-west-2",
        credentials: {
          accessKeyId: "INTEG",
          secretAccessKey: "INTEG",
        },
        retryStrategy: new (class extends StandardRetryStrategy {
          public async acquireInitialRetryToken(retryTokenScope: string): Promise<StandardRetryToken> {
            expect(retryTokenScope).toEqual(":longpoll");
            return super.acquireInitialRetryToken(retryTokenScope);
          }
        })(3),
      });

      client.middlewareStack.use(getLongPollPlugin(client.config));

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

      expect.assertions(4);
    });
  });
});
