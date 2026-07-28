import { SerdeContext } from "@smithy/core/protocols";
import type { Codec } from "@smithy/types";

import { CborShapeSerializer2 } from "./codec-v2/CborShapeSerializer2";
import { CborShapeDeserializer2 } from "./codec-v2/CborShapeDeserializer2";

/**
 * @public
 */
export class CborCodec extends SerdeContext implements Codec<Uint8Array, Uint8Array> {
  public createSerializer(): CborShapeSerializer2 {
    const serializer = new CborShapeSerializer2();
    serializer.setSerdeContext(this.serdeContext!);
    return serializer;
  }

  public createDeserializer(): CborShapeDeserializer2 {
    const deserializer = new CborShapeDeserializer2();
    deserializer.setSerdeContext(this.serdeContext!);
    return deserializer;
  }
}
