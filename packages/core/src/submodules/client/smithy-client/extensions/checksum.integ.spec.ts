import { RpcV2Protocol } from "@smithy/smithy-rpcv2-cbor-schema";
import type { Checksum } from "@smithy/types";
import { describe, expect, test as it } from "vitest";

import type { PartialChecksumRuntimeConfigType } from "./checksum";

describe("checksum extension", () => {
  it("should allow definition of new checksum algorithms via runtime extension", async () => {
    class Sha256Custom implements Checksum {
      update() {}
      async digest() {
        return new Uint8Array(4);
      }
      reset() {}
    }

    class R1 {
      update() {}
      async digest() {
        return new Uint8Array(4);
      }
      reset() {}
    }

    const client = new RpcV2Protocol({
      endpoint: "https://localhost",
      extensions: [
        {
          configure(ext) {
            ext.addChecksumAlgorithm({
              algorithmId() {
                return "r1";
              },
              checksumConstructor() {
                return R1;
              },
            });
            ext.addChecksumAlgorithm({
              algorithmId() {
                return "sha256";
              },
              checksumConstructor() {
                return Sha256Custom;
              },
            });
          },
        },
      ],
    });

    const config = client.config as typeof client.config & PartialChecksumRuntimeConfigType;

    expect(config.checksumAlgorithms).toEqual({
      // the algo id is used as the key if it is not recognized.
      r1: R1,

      // Rhe uppercase form is used if it is recognized.
      // This matches the key in the algorithm selector function.
      SHA256: Sha256Custom,
    });

    // for known algorithms that exist on the config, they are also set by the extension.
    expect(config.sha256).toEqual(Sha256Custom);
    expect(config.md5).toEqual(undefined);
    expect(config.sha1).toEqual(undefined);

    // for novel algorithms, they are not set to new fields on the config.
    expect((config as any).r1).toEqual(undefined);
  });
});
