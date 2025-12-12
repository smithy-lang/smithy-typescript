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
  CodedThrottlingError,
  HaltError,
  MainServiceLinkedError,
  MysteryThrottlingError,
  RetryableError,
  XYZServiceServiceException,
} from "../models/errors";
import { XYZServiceSyntheticServiceException } from "../models/XYZServiceSyntheticServiceException";

/* eslint no-var: 0 */
export var AlphaSchema: StaticStructureSchema = [3, n0, _A,
  0,
  [_i, _t],
  [0, 4]
];
export var CodedThrottlingErrorSchema: StaticErrorSchema = [-3, n0, _CTE,
  { [_e]: _c, [_hE]: 429 },
  [],
  []
];
TypeRegistry.for(n0).registerError(CodedThrottlingErrorSchema, CodedThrottlingError);
export var GetNumbersRequestSchema: StaticStructureSchema = [3, n0, _GNR,
  0,
  [_bD, _bI, _fWM, _fWMi],
  [17, 19, 0, 0]
];
export var GetNumbersResponseSchema: StaticStructureSchema = [3, n0, _GNRe,
  0,
  [_bD, _bI],
  [17, 19]
];
export var HaltErrorSchema: StaticErrorSchema = [-3, n0, _HE,
  { [_e]: _c },
  [],
  []
];
TypeRegistry.for(n0).registerError(HaltErrorSchema, HaltError);
export var MainServiceLinkedErrorSchema: StaticErrorSchema = [-3, n0, _MSLE,
  { [_e]: _c, [_hE]: 400 },
  [],
  []
];
TypeRegistry.for(n0).registerError(MainServiceLinkedErrorSchema, MainServiceLinkedError);
export var MysteryThrottlingErrorSchema: StaticErrorSchema = [-3, n0, _MTE,
  { [_e]: _c },
  [],
  []
];
TypeRegistry.for(n0).registerError(MysteryThrottlingErrorSchema, MysteryThrottlingError);
export var RetryableErrorSchema: StaticErrorSchema = [-3, n0, _RE,
  { [_e]: _c },
  [],
  []
];
TypeRegistry.for(n0).registerError(RetryableErrorSchema, RetryableError);
export var TradeEventStreamRequestSchema: StaticStructureSchema = [3, n0, _TESR,
  0,
  [_eS],
  [[() => TradeEventsSchema, 0]]
];
export var TradeEventStreamResponseSchema: StaticStructureSchema = [3, n0, _TESRr,
  0,
  [_eS],
  [[() => TradeEventsSchema, 0]]
];
export var XYZServiceServiceExceptionSchema: StaticErrorSchema = [-3, n0, _XYZSSE,
  { [_e]: _c },
  [],
  []
];
TypeRegistry.for(n0).registerError(XYZServiceServiceExceptionSchema, XYZServiceServiceException);
var __Unit = "unit" as const;
export var XYZServiceSyntheticServiceException$: StaticErrorSchema = [-3, _s, "XYZServiceSyntheticServiceException", 0, [], []];
TypeRegistry.for(_s).registerError(XYZServiceSyntheticServiceException$, XYZServiceSyntheticServiceException);
export var TradeEventsSchema: StaticStructureSchema = [3, n0, _TE,
  { [_st]: 1 },
  [_a, _b, _g],
  [() => AlphaSchema, () => __Unit, () => __Unit]
];
export var GetNumbersSchema: StaticOperationSchema = [9, n0, _GN,
  0, () => GetNumbersRequestSchema, () => GetNumbersResponseSchema
];
export var TradeEventStreamSchema: StaticOperationSchema = [9, n0, _TES,
  0, () => TradeEventStreamRequestSchema, () => TradeEventStreamResponseSchema
];
