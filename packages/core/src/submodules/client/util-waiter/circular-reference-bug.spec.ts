/**
 * Regression test for https://github.com/aws/aws-sdk-js-v3/issues/7459
 *
 * When a waiter receives a response/error containing circular references
 * (e.g. Node.js IncomingMessage with req/res cycle), JSON.stringify should
 * not throw "Converting circular structure to JSON".
 */
import { afterEach, beforeEach, describe, expect, test as it, vi } from "vitest";

import { runPolling } from "./poller";
import { sleep } from "./utils/sleep";
import type { WaiterOptions, WaiterResult } from "./waiter";
import { checkExceptions, WaiterState } from "./waiter";

vi.mock("./utils/sleep");

/**
 * Creates a mock object that mimics the circular reference structure
 * of a Node.js IncomingMessage/ClientRequest pair, which is the exact
 * structure reported in the issue.
 */
function createCircularHttpResponse() {
  const incomingMessage: any = {
    constructor: { name: "IncomingMessage" },
    statusCode: 403,
    headers: { "content-type": "application/json" },
  };
  const clientRequest: any = {
    constructor: { name: "ClientRequest" },
    method: "POST",
    path: "/",
  };
  incomingMessage.req = clientRequest;
  clientRequest.res = incomingMessage;
  return incomingMessage;
}

describe("GitHub Issue #7459: circular structure in waiter results", () => {
  const config: WaiterOptions<any> = {
    minDelay: 2,
    maxDelay: 30,
    maxWaitTime: 99999,
    client: "mockClient",
  };

  describe("checkExceptions", () => {
    it("should not throw TypeError for FAILURE result with circular reason", () => {
      const result: WaiterResult = {
        state: WaiterState.FAILURE,
        reason: createCircularHttpResponse(),
      };

      expect(() => checkExceptions(result)).toThrow();
      try {
        checkExceptions(result);
      } catch (e: any) {
        expect(e).toBeInstanceOf(Error);
        expect(e.message).not.toContain("Converting circular structure to JSON");
        expect(e.message).toContain("[Circular]");
      }
    });
  });

  describe("runPolling", () => {
    beforeEach(() => {
      vi.mocked(sleep).mockResolvedValue("");
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it("should handle circular reason from acceptorChecks", async () => {
      const circularResponse = createCircularHttpResponse();
      const mockAcceptorChecks = vi.fn().mockResolvedValueOnce({
        state: WaiterState.FAILURE,
        reason: circularResponse,
      });

      const result = await runPolling(config, "input", mockAcceptorChecks);
      expect(result.state).toBe(WaiterState.FAILURE);
      expect(result.reason).toBe(circularResponse);
      const keys = Object.keys(result.observedResponses!);
      expect(keys.length).toBe(1);
      expect(keys[0]).not.toContain("Converting circular structure");
    });

    it("should handle reason with $metadata and message but no $response", async () => {
      const mockAcceptorChecks = vi.fn().mockResolvedValueOnce({
        state: WaiterState.FAILURE,
        reason: {
          message: "User is not authorized to perform acm-pca:IssueCertificate",
          $metadata: { httpStatusCode: 403 },
        },
      });

      const result = await runPolling(config, "input", mockAcceptorChecks);
      expect(result.state).toBe(WaiterState.FAILURE);
      const keys = Object.keys(result.observedResponses!);
      expect(keys.length).toBe(1);
      expect(keys[0]).toContain("403");
      expect(keys[0]).toContain("not authorized");
    });
  });
});
