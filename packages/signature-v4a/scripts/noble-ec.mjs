import { p256 } from "@noble/curves/nist.js";

/**
 * Compatibility wrapper matching the elliptic.js Ec interface used by SignatureV4a.
 * Provides: new Ec("p256").keyFromPrivate(key).sign(hash).toDER()
 */
export class Ec {
  constructor(curve) {
    if (curve !== "p256") throw new Error(`Unsupported curve: ${curve}`);
  }

  keyFromPrivate(privateKey) {
    return {
      sign(hash) {
        const sig = p256.sign(hash, privateKey, { prehash: false, format: "der" });
        return {
          toDER() {
            return sig;
          },
        };
      },
    };
  }
}
