const no = Symbol.for("node-only");

// @smithy/hash-blob-browser
export { blobHasher } from "./hash-blob-browser/blobHasher";

// @smithy/hash-stream-node
export const fileStreamHasher = no;
export const readableStreamHasher = no;

// @smithy/md5-js
export { Md5 } from "./md5-js/md5";

// crc32
export { Crc32Js, Crc32Js as Crc32 } from "./crc32/Crc32Js";
export const Crc32Node = no;

// sha256
export { Sha256Js } from "./sha256/Sha256Js";
export { Sha256WebCrypto, Sha256WebCrypto as Sha256 } from "./sha256/Sha256WebCrypto";
export const Sha256Node = no;

// @smithy/chunked-blob-reader-native
export { blobReader } from "./chunked-blob-reader/chunked-blob-reader.native";
