import { toHex } from "@smithy/util-hex-encoding";
import { describe, expect, test as it } from "vitest";

import { blobHasher } from "./index";

describe("blobHasher", () => {
  const blob = new Blob(["test-string"]);

  class Hash {
    public value: string = "";
    update(value: string) {
      this.value = value;
    }
    async digest() {
      return new TextEncoder().encode(this.value);
    }
  }

  it("calls update and digest of the given Hash class on the blob", async () => {
    const result = await blobHasher(Hash, blob);

    expect(result instanceof Uint8Array).toBe(true);
    expect(toHex(result)).toBe("3131362c3130312c3131352c3131362c34352c3131352c3131362c3131342c3130352c3131302c313033");
  });
});
