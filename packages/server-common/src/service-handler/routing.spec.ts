/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { HttpRequest } from "@smithy/core/protocols";
import { describe, expect, it, vi } from "vitest";

import type { ServerProtocol } from "../protocols-schema/layer-0-interface-and-base/ServerProtocol";
import { createCombinedRouter } from "./routing";

function makeProtocol(id: string, claim: () => boolean): ServerProtocol<any, any> {
  return {
    getShapeId: () => id,
    claim,
    route: vi.fn(),
    deserializeRequest: vi.fn(),
    serializeResponse: vi.fn(),
    setSerdeContext: vi.fn(),
  };
}

describe("createCombinedRouter", () => {
  const request = new HttpRequest({
    method: "POST",
    path: "/",
    headers: {},
  });

  it("asks protocols to claim in configured array order", () => {
    const calls: string[] = [];
    const first = makeProtocol("test#first", () => {
      calls.push("first");
      return true;
    });
    const second = makeProtocol("test#second", () => {
      calls.push("second");
      return true;
    });
    const router = createCombinedRouter([first, second]);

    expect(router(request)).toEqual({ protocol: first });
    expect(calls).toEqual(["first"]);
  });

  it("continues only when a protocol does not claim the request", () => {
    const first = makeProtocol("test#first", () => false);
    const second = makeProtocol("test#second", () => true);
    const router = createCombinedRouter([first, second]);

    expect(router(request)).toEqual({ protocol: second });
  });

  it("does not fall through after a protocol claims the request", () => {
    const secondClaim = vi.fn(() => true);
    const first = makeProtocol("test#first", () => true);
    const second = makeProtocol("test#second", secondClaim);
    const router = createCombinedRouter([first, second]);

    expect(router(request)).toEqual({ protocol: first });
    expect(secondClaim).not.toHaveBeenCalled();
  });
});
