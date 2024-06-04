import { byteVector } from "./ByteVector";
import { decode } from "./cbor-decode";
import { encode } from "./cbor-encode";
import { decodeView } from "./DecodeView";

/**
 * This implementation is synchronous and only implements the parts of CBOR
 * specification used by Smithy RPCv2 CBOR protocol.
 *
 * This cbor serde implementation is derived from AWS SDK for Go's implementation.
 * @see https://github.com/aws/smithy-go/tree/main/encoding/cbor
 *
 * The cbor-x implementation was also instructional:
 * @see https://github.com/kriszyp/cbor-x
 */
export const cbor = {
  deserialize(payload: Uint8Array) {
    decodeView.set(payload);
    return decode(payload, 0, payload.length)[0];
  },
  serialize(input: any) {
    encode(input);
    return byteVector.toUint8Array();
  },
};
