import type { CodecSettings } from "@smithy/types";
/**
 * @public
 */
export type JsonSettings = CodecSettings & {
  jsonName: boolean;
  /**
   * When true, bigInteger and bigDecimal values are serialized as JSON strings
   * to preserve arbitrary precision (Smithy RPCv2 JSON behavior). When false or
   * unset, they are serialized as unquoted JSON numbers (AWS JSON 1.0/1.1 behavior).
   */
  bigNumberAsString?: boolean;
};
