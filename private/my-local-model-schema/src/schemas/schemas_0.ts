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
export var Alpha$: StaticStructureSchema = [3, n0, _A,
  0,
  [_i, _t],
  [0, 4]
];
export var CodedThrottlingError$: StaticErrorSchema = [-3, n0, _CTE,
  { [_e]: _c, [_hE]: 429 },
  [],
  []
];
TypeRegistry.for(n0).registerError(CodedThrottlingError$, __CodedThrottlingError);
export var GetNumbersRequest$: StaticStructureSchema = [3, n0, _GNR,
  0,
  [_bD, _bI, _fWM, _fWMi],
  [17, 19, 0, 0]
];
export var GetNumbersResponse$: StaticStructureSchema = [3, n0, _GNRe,
  0,
  [_bD, _bI],
  [17, 19]
];
export var HaltError$: StaticErrorSchema = [-3, n0, _HE,
  { [_e]: _c },
  [],
  []
];
TypeRegistry.for(n0).registerError(HaltError$, __HaltError);
export var MainServiceLinkedError$: StaticErrorSchema = [-3, n0, _MSLE,
  { [_e]: _c, [_hE]: 400 },
  [],
  []
];
TypeRegistry.for(n0).registerError(MainServiceLinkedError$, __MainServiceLinkedError);
export var MysteryThrottlingError$: StaticErrorSchema = [-3, n0, _MTE,
  { [_e]: _c },
  [],
  []
];
TypeRegistry.for(n0).registerError(MysteryThrottlingError$, __MysteryThrottlingError);
export var RetryableError$: StaticErrorSchema = [-3, n0, _RE,
  { [_e]: _c },
  [],
  []
];
TypeRegistry.for(n0).registerError(RetryableError$, __RetryableError);
export var TradeEventStreamRequest$: StaticStructureSchema = [3, n0, _TESR,
  0,
  [_eS],
  [[() => TradeEvents$, 0]]
];
export var TradeEventStreamResponse$: StaticStructureSchema = [3, n0, _TESRr,
  0,
  [_eS],
  [[() => TradeEvents$, 0]]
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
export var TradeEvents$: StaticStructureSchema = [3, n0, _TE,
  { [_st]: 1 },
  [_a, _b, _g],
  [() => Alpha$, () => __Unit, () => __Unit]
];
export var GetNumbers$: StaticOperationSchema = [9, n0, _GN,
  0, () => GetNumbersRequest$, () => GetNumbersResponse$
];
export var TradeEventStream$: StaticOperationSchema = [9, n0, _TES,
  0, () => TradeEventStreamRequest$, () => TradeEventStreamResponse$
];
