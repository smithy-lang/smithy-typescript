export const ALGORITHM_QUERY_PARAM = "X-Amz-Algorithm";
export const CREDENTIAL_QUERY_PARAM = "X-Amz-Credential";
export const AMZ_DATE_QUERY_PARAM = "X-Amz-Date";
export const SIGNED_HEADERS_QUERY_PARAM = "X-Amz-SignedHeaders";
export const EXPIRES_QUERY_PARAM = "X-Amz-Expires";
export const SIGNATURE_QUERY_PARAM = "X-Amz-Signature";
export const TOKEN_QUERY_PARAM = "X-Amz-Security-Token";
export const REGION_SET_PARAM = "X-Amz-Region-Set";

export const AUTH_HEADER = "authorization";
export const AMZ_DATE_HEADER = AMZ_DATE_QUERY_PARAM.toLowerCase();
export const DATE_HEADER = "date";
export const GENERATED_HEADERS = [AUTH_HEADER, AMZ_DATE_HEADER, DATE_HEADER];
export const SIGNATURE_HEADER = SIGNATURE_QUERY_PARAM.toLowerCase();
export const SHA256_HEADER = "x-amz-content-sha256";
export const TOKEN_HEADER = TOKEN_QUERY_PARAM.toLowerCase();
export const REGION_HEADER = REGION_SET_PARAM.toLowerCase();
export const HOST_HEADER = "host";

export const ALWAYS_UNSIGNABLE_HEADERS = {
  authorization: true,
  "cache-control": true,
  connection: true,
  expect: true,
  from: true,
  "keep-alive": true,
  "max-forwards": true,
  pragma: true,
  referer: true,
  te: true,
  trailer: true,
  "transfer-encoding": true,
  upgrade: true,
  "user-agent": true,
  "x-amzn-trace-id": true,
};

export const PROXY_HEADER_PATTERN = /^proxy-/;

export const SEC_HEADER_PATTERN = /^sec-/;

export const UNSIGNABLE_PATTERNS = [/^proxy-/i, /^sec-/i];

export const ALGORITHM_IDENTIFIER = "AWS4-HMAC-SHA256";
export const ALGORITHM_IDENTIFIER_V4A = "AWS4-ECDSA-P256-SHA256";

export const EVENT_ALGORITHM_IDENTIFIER = "AWS4-HMAC-SHA256-PAYLOAD";

export const UNSIGNED_PAYLOAD = "UNSIGNED-PAYLOAD";

export const MAX_CACHE_SIZE = 50;
export const KEY_TYPE_IDENTIFIER = "aws4_request";

export const MAX_PRESIGNED_TTL = 60 * 60 * 24 * 7;

// AWS SigV4a private signing key constants
export const ONE_AS_4_BYTES = [0x00, 0x00, 0x00, 0x01];
export const TWOFIFTYSIX_AS_4_BYTES = [0x00, 0x00, 0x01, 0x00];
export const N_MINUS_TWO = [0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xBC, 0xE6, 0xFA, 0xAD, 0xA7, 0x17, 0x9E, 0x84, 0xF3, 0xB9, 0xCA, 0xC2, 0xFC, 0x63, 0x25, 0x4F];
