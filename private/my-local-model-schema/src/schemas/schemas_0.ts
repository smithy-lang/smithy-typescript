const _A = "Alpha";
const _CTE = "CodedThrottlingError";
const _GN = "GetNumbers";
const _GNR = "GetNumbersRequest";
const _GNRe = "GetNumbersResponse";
const _HE = "HaltError";
const _HLC = "HttpLabelCommand";
const _HLCI = "HttpLabelCommandInput";
const _HLCO = "HttpLabelCommandOutput";
const _LDNATRP = "LabelDoesNotApplyToRpcProtocol";
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
const _cCO = "camelCaseOperation";
const _cCOI = "camelCaseOperationInput";
const _cCOO = "camelCaseOperationOutput";
const _e = "error";
const _eS = "eventStream";
const _fWM = "fieldWithoutMessage";
const _fWMi = "fieldWithMessage";
const _g = "gamma";
const _h = "http";
const _hE = "httpError";
const _i = "id";
const _mR = "maxResults";
const _n = "numbers";
const _nT = "nextToken";
const _r = "results";
const _s = "smithy.ts.sdk.synthetic.org.xyz.v1";
const _sT = "startToken";
const _st = "streaming";
const _t = "timestamp";
const _to = "token";
const n0 = "org.xyz.secondary";
const n1 = "org.xyz.v1";

// smithy-typescript generated code
import { TypeRegistry } from "@smithy/core/schema";
import type {
  StaticErrorSchema,
  StaticListSchema,
  StaticOperationSchema,
  StaticStructureSchema,
  StaticUnionSchema,
} from "@smithy/types";

import {
  CodedThrottlingError,
  HaltError,
  MainServiceLinkedError,
  MysteryThrottlingError,
  RetryableError,
  XYZServiceServiceException,
} from "../models/errors";
import { XYZServiceSyntheticServiceException } from "../models/XYZServiceSyntheticServiceException";

/* eslint no-var: 0 */
export var HttpLabelCommandInput$: StaticStructureSchema = [3, n0, _HLCI,
  0,
  [_LDNATRP],
  [[0, 1]], 1
];
export var HttpLabelCommandOutput$: StaticStructureSchema = [3, n0, _HLCO,
  0,
  [],
  []
];
export var Alpha$: StaticStructureSchema = [3, n1, _A,
  0,
  [_i, _t],
  [0, 4]
];
export var camelCaseOperationInput$: StaticStructureSchema = [3, n1, _cCOI,
  0,
  [_to],
  [0]
];
export var camelCaseOperationOutput$: StaticStructureSchema = [3, n1, _cCOO,
  0,
  [_to, _r],
  [0, 64 | 21]
];
export var CodedThrottlingError$: StaticErrorSchema = [-3, n1, _CTE,
  { [_e]: _c, [_hE]: 429 },
  [],
  []
];
TypeRegistry.for(n1).registerError(CodedThrottlingError$, CodedThrottlingError);
export var GetNumbersRequest$: StaticStructureSchema = [3, n1, _GNR,
  0,
  [_bD, _bI, _fWM, _fWMi, _sT, _mR],
  [19, 17, 0, 0, 0, 1]
];
export var GetNumbersResponse$: StaticStructureSchema = [3, n1, _GNRe,
  0,
  [_bD, _bI, _n, _nT],
  [19, 17, 64 | 1, 0]
];
export var HaltError$: StaticErrorSchema = [-3, n1, _HE,
  { [_e]: _c },
  [],
  []
];
TypeRegistry.for(n1).registerError(HaltError$, HaltError);
export var MainServiceLinkedError$: StaticErrorSchema = [-3, n1, _MSLE,
  { [_e]: _c, [_hE]: 400 },
  [],
  []
];
TypeRegistry.for(n1).registerError(MainServiceLinkedError$, MainServiceLinkedError);
export var MysteryThrottlingError$: StaticErrorSchema = [-3, n1, _MTE,
  { [_e]: _c },
  [],
  []
];
TypeRegistry.for(n1).registerError(MysteryThrottlingError$, MysteryThrottlingError);
export var RetryableError$: StaticErrorSchema = [-3, n1, _RE,
  { [_e]: _c },
  [],
  []
];
TypeRegistry.for(n1).registerError(RetryableError$, RetryableError);
export var TradeEventStreamRequest$: StaticStructureSchema = [3, n1, _TESR,
  0,
  [_eS],
  [[() => TradeEvents$, 0]]
];
export var TradeEventStreamResponse$: StaticStructureSchema = [3, n1, _TESRr,
  0,
  [_eS],
  [[() => TradeEvents$, 0]]
];
export var XYZServiceServiceException$: StaticErrorSchema = [-3, n1, _XYZSSE,
  { [_e]: _c },
  [],
  []
];
TypeRegistry.for(n1).registerError(XYZServiceServiceException$, XYZServiceServiceException);
var __Unit = "unit" as const;
export var XYZServiceSyntheticServiceException$: StaticErrorSchema = [-3, _s, "XYZServiceSyntheticServiceException", 0, [], []];
TypeRegistry.for(_s).registerError(XYZServiceSyntheticServiceException$, XYZServiceSyntheticServiceException);
var Blobs = 64 | 21;
var IntegerList = 64 | 1;
export var TradeEvents$: StaticUnionSchema = [4, n1, _TE,
  { [_st]: 1 },
  [_a, _b, _g],
  [() => Alpha$, () => __Unit, () => __Unit]
];
export var HttpLabelCommand$: StaticOperationSchema = [9, n0, _HLC,
  { [_h]: ["POST", "/{LabelDoesNotApplyToRpcProtocol}", 200] }, () => HttpLabelCommandInput$, () => HttpLabelCommandOutput$
];
export var camelCaseOperation$: StaticOperationSchema = [9, n1, _cCO,
  { [_h]: ["POST", "/camel-case", 200] }, () => camelCaseOperationInput$, () => camelCaseOperationOutput$
];
export var GetNumbers$: StaticOperationSchema = [9, n1, _GN,
  { [_h]: ["POST", "/get-numbers", 200] }, () => GetNumbersRequest$, () => GetNumbersResponse$
];
export var TradeEventStream$: StaticOperationSchema = [9, n1, _TES,
  { [_h]: ["POST", "/trade-event-stream", 200] }, () => TradeEventStreamRequest$, () => TradeEventStreamResponse$
];
