import node_http from "node:http";
import { describe, test as it } from "vitest";

/**
 * @deprecated for tests only. Runtime import of node:http is async.
 */
export { node_http };

describe("placeholder", () => {
  it("", () => {});
});
