const _A = "Alpha";
const _CTE = "CodedThrottlingError";
const _GN = "GetNumbers";
const _GNR = "GetNumbersRequest";
const _GNRe = "GetNumbersResponse";
const _HE = "HaltError";
const _MSLE = "MainServiceLinkedError";
const _MTE = "MysteryThrottlingError";
const _RE = "RetryableError";
const _TE = "TradeEvents";
const _TES = "TradeEventStream";
const _TESR = "TradeEventStreamRequest";
const _TESRr = "TradeEventStreamResponse";
const _XYZSSE = "XYZServiceServiceException";
const _a = "alpha";
const _b = "beta";
const _bD = "bigDecimal";
const _bI = "bigInteger";
const _c = "client";
const _e = "error";
const _eS = "eventStream";
const _fWM = "fieldWithoutMessage";
const _fWMi = "fieldWithMessage";
const _g = "gamma";
const _hE = "httpError";
const _i = "id";
const _s = "smithy.ts.sdk.synthetic.org.xyz.v1";
const _st = "streaming";
const _t = "timestamp";
const n0 = "org.xyz.v1";

// smithy-typescript generated code
import { TypeRegistry } from "@smithy/core/schema";
import type { StaticErrorSchema, StaticOperationSchema, StaticStructureSchema } from "@smithy/types";

import {
  CodedThrottlingError as __CodedThrottlingError,
  HaltError as __HaltError,
  MainServiceLinkedError as __MainServiceLinkedError,
  MysteryThrottlingError as __MysteryThrottlingError,
  RetryableError as __RetryableError,
  XYZServiceServiceException as __XYZServiceServiceException,
} from "../models/errors";
import {
  XYZServiceSyntheticServiceException as __XYZServiceSyntheticServiceException,
} from "../models/XYZServiceSyntheticServiceException";

/* eslint no-var: 0 */
export var alpha: StaticStructureSchema = [3, n0, _A,
  0,
  [_i, _t],
  [0, 4]
];
export var codedThrottlingError: StaticErrorSchema = [-3, n0, _CTE,
  { [_e]: _c, [_hE]: 429 },
  [],
  []
];
TypeRegistry.for(n0).registerError(codedThrottlingError, __CodedThrottlingError);
export var getNumbersRequest: StaticStructureSchema = [3, n0, _GNR,
  0,
  [_bD, _bI, _fWM, _fWMi],
  [17, 19, 0, 0]
];
export var getNumbersResponse: StaticStructureSchema = [3, n0, _GNRe,
  0,
  [_bD, _bI],
  [17, 19]
];
export var haltError: StaticErrorSchema = [-3, n0, _HE,
  { [_e]: _c },
  [],
  []
];
TypeRegistry.for(n0).registerError(haltError, __HaltError);
export var mainServiceLinkedError: StaticErrorSchema = [-3, n0, _MSLE,
  { [_e]: _c, [_hE]: 400 },
  [],
  []
];
TypeRegistry.for(n0).registerError(mainServiceLinkedError, __MainServiceLinkedError);
export var mysteryThrottlingError: StaticErrorSchema = [-3, n0, _MTE,
  { [_e]: _c },
  [],
  []
];
TypeRegistry.for(n0).registerError(mysteryThrottlingError, __MysteryThrottlingError);
export var retryableError: StaticErrorSchema = [-3, n0, _RE,
  { [_e]: _c },
  [],
  []
];
TypeRegistry.for(n0).registerError(retryableError, __RetryableError);
export var tradeEventStreamRequest: StaticStructureSchema = [3, n0, _TESR,
  0,
  [_eS],
  [[() => tradeEvents, 0]]
];
export var tradeEventStreamResponse: StaticStructureSchema = [3, n0, _TESRr,
  0,
  [_eS],
  [[() => tradeEvents, 0]]
];
export var XYZServiceServiceException$: StaticErrorSchema = [-3, n0, _XYZSSE,
  { [_e]: _c },
  [],
  []
];
TypeRegistry.for(n0).registerError(XYZServiceServiceException$, __XYZServiceServiceException);
var __Unit = "unit" as const;
export var XYZServiceSyntheticServiceException: StaticErrorSchema = [-3, _s, "XYZServiceSyntheticServiceException", 0, [], []];
TypeRegistry.for(_s).registerError(XYZServiceSyntheticServiceException, __XYZServiceSyntheticServiceException);
export var tradeEvents: StaticStructureSchema = [3, n0, _TE,
  { [_st]: 1 },
  [_a, _b, _g],
  [() => alpha, () => __Unit, () => __Unit]
];
export var getNumbers: StaticOperationSchema = [9, n0, _GN,
  0, () => getNumbersRequest, () => getNumbersResponse
];
export var tradeEventStream: StaticOperationSchema = [9, n0, _TES,
  0, () => tradeEventStreamRequest, () => tradeEventStreamResponse
];
