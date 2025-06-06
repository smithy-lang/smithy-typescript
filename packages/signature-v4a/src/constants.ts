import { REGION_SET_PARAM } from "@smithy/signature-v4";

/**
 * @internal
 */
export const REGION_HEADER = REGION_SET_PARAM.toLowerCase();

// AWS SigV4a private signing key constants
/**
 * @internal
 */
export const ONE_AS_4_BYTES = [0x00, 0x00, 0x00, 0x01];

/**
 * @internal
 */
export const TWOFIFTYSIX_AS_4_BYTES = [0x00, 0x00, 0x01, 0x00];

/**
 * @internal
 */
export const N_MINUS_TWO = [
  0xff, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xbc, 0xe6, 0xfa,
  0xad, 0xa7, 0x17, 0x9e, 0x84, 0xf3, 0xb9, 0xca, 0xc2, 0xfc, 0x63, 0x25, 0x4f,
];
