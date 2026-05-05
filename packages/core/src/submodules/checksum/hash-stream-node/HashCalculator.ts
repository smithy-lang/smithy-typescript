import { Writable, type WritableOptions } from "node:stream";
import { toUint8Array } from "@smithy/core/serde";
import type { Checksum, Hash } from "@smithy/types";

/**
 * @internal
 */
export class HashCalculator extends Writable {
  constructor(
    public readonly hash: Checksum | Hash,
    options?: WritableOptions
  ) {
    super(options);
  }

  _write(chunk: Buffer, encoding: string, callback: (err?: Error) => void) {
    try {
      this.hash.update(toUint8Array(chunk));
    } catch (err) {
      return callback(err);
    }
    callback();
  }
}
