import type { Checksum, Hash } from "@smithy/types";
import type { WritableOptions } from "stream";
import { Writable } from "stream";

import { toUint8Array } from "../util-utf8/toUint8Array";

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
