import { Sha256 } from "@aws-crypto/sha256-js";
import { expect } from "@esm-bundle/chai";
import { toHex } from "@smithy/util-hex-encoding";

import { blobHasher } from "./index";

describe("blobHasher", () => {
  const blob = new Blob(["Shot through the bar, but you're too late bizzbuzz you give foo, a bad name."]);

  it("calculates the SHA256 hash of a blob", async () => {
    const result = await blobHasher(Sha256, blob);

    expect(result instanceof Uint8Array).to.equal(true);
    expect(toHex(result)).to.equal("24dabf4db3774a3224d571d4c089a9c570c3045dbe1e67ee9ee2e2677f57dbe0");
  });
});
