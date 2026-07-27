import { SerdeContext } from "@smithy/core/protocols";
import { _parseEpochTimestamp } from "@smithy/core/serde";
import type { Codec } from "@smithy/types";

import { CborShapeSerializer } from "./codec-v1/CborShapeSerializer";
import { CborShapeDeserializer } from "./codec-v1/CborShapeDeserializer";

/**
 * @public
 */
export class CborCodec extends SerdeContext implements Codec<Uint8Array, Uint8Array> {
  public createSerializer(): CborShapeSerializer {
    const serializer = new CborShapeSerializer();
    serializer.setSerdeContext(this.serdeContext!);
    return serializer;
  }

  public createDeserializer(): CborShapeDeserializer {
    const deserializer = new CborShapeDeserializer();
    deserializer.setSerdeContext(this.serdeContext!);
    return deserializer;
  }
}
