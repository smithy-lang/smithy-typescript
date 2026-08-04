const _ = "^[0-9]{5}$";
const _A = "Alpha";
const _AI = "AccountId";
const _CA = "ConstrainedAddress";
const _CTE = "CodedThrottlingError";
const _DSN = "DifferentShapeName";
const _GN = "GetNumbers";
const _GNR = "GetNumbersRequest";
const _GNRe = "GetNumbersResponse";
const _HE = "HaltError";
const _HLC = "HttpLabelCommand";
const _HLCI = "HttpLabelCommandInput";
const _HLCO = "HttpLabelCommandOutput";
const _HPO = "HostPrefixOperation";
const _HPOI = "HostPrefixOperationInput";
const _LDNATRP = "LabelDoesNotApplyToRpcProtocol";
const _MSLE = "MainServiceLinkedError";
const _MTE = "MysteryThrottlingError";
const _RE = "RetryableError";
const _SIL = "SparseIntegerList";
const _SIM = "SparseIntegerMap";
const _T = "Tag";
const _TE = "TradeEvents";
const _TES = "TradeEventStream";
const _TESR = "TradeEventStreamRequest";
const _TESRr = "TradeEventStreamResponse";
const _TL = "TagList";
const _UTL = "UniqueTagList";
const _VI = "ValidatedInput";
const _VO = "ValidatedOutput";
const _VOa = "ValidatedOperation";
const _XYZSSE = "XYZServiceServiceException";
const _a = "age";
const _ad = "address";
const _al = "alpha";
const _b = "beta";
const _bD = "bigDecimal";
const _bI = "bigInteger";
const _c = "client";
const _cCO = "camelCaseOperation";
const _cCOI = "camelCaseOperationInput";
const _cCOO = "camelCaseOperationOutput";
const _cHI = "customHeaderInput";
const _d = "delta";
const _dN = "deprecatedNumbers";
const _dNWC = "deprecatedNumbersWithoutChronology";
const _dNWE = "deprecatedNumbersWithoutExplanation";
const _e = "error";
const _eS = "eventStream";
const _em = "email";
const _en = "endpoint";
const _fWM = "fieldWithoutMessage";
const _fWMi = "fieldWithMessage";
const _g = "gamma";
const _h = "http";
const _hE = "httpError";
const _hL = "hostLabel";
const _i = "id";
const _iDN = "inexplicablyDeprecatedNumbers";
const _l = "length";
const _m = "message";
const _mR = "maxResults";
const _n = "name";
const _nT = "nextToken";
const _nu = "number";
const _num = "numbers";
const _p = "pattern";
const _r = "results";
const _ra = "range";
const _s = "smithy.ts.sdk.synthetic.org.xyz.v1";
const _sN = "sparseNumbers";
const _sT = "startToken";
const _sp = "sparse";
const _st = "state";
const _str = "streaming";
const _t = "timestamp";
const _ta = "tags";
const _to = "token";
const _u = "username";
const _uI = "uniqueItems";
const _uT = "uniqueTags";
const _zC = "zipCode";
const _zZzZzZ = "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$";
const n0 = "org.xyz.v1";
const n1 = "org.xyz.secondary";

// smithy-typescript generated code
import { TypeRegistry } from "@smithy/core/schema";
import type {
  StaticErrorSchema,
  StaticListSchema,
  StaticMapSchema,
  StaticOperationSchema,
  StaticSimpleSchema,
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
import { XYZServiceServiceServiceException } from "../models/XYZServiceServiceServiceException";

/* eslint no-var: 0 */
const _s_registry = TypeRegistry.for(_s);
export var XYZServiceServiceServiceException$: StaticErrorSchema = [-3, _s, "XYZServiceServiceServiceException", 0, [], []];
_s_registry.registerError(XYZServiceServiceServiceException$, XYZServiceServiceServiceException);
const n0_registry = TypeRegistry.for(n0);
export var CodedThrottlingError$: StaticErrorSchema = [-3, n0, _CTE,
  { [_e]: _c, [_hE]: 429 },
  [],
  []
];
n0_registry.registerError(CodedThrottlingError$, CodedThrottlingError);
export var HaltError$: StaticErrorSchema = [-3, n0, _HE,
  { [_e]: _c },
  [_m],
  [0]
];
n0_registry.registerError(HaltError$, HaltError);
export var MainServiceLinkedError$: StaticErrorSchema = [-3, n0, _MSLE,
  { [_e]: _c, [_hE]: 400 },
  [],
  []
];
n0_registry.registerError(MainServiceLinkedError$, MainServiceLinkedError);
export var MysteryThrottlingError$: StaticErrorSchema = [-3, n0, _MTE,
  { [_e]: _c },
  [],
  []
];
n0_registry.registerError(MysteryThrottlingError$, MysteryThrottlingError);
export var RetryableError$: StaticErrorSchema = [-3, n0, _RE,
  { [_e]: _c },
  [_m],
  [0]
];
n0_registry.registerError(RetryableError$, RetryableError);
export var XYZServiceServiceException$: StaticErrorSchema = [-3, n0, _XYZSSE,
  { [_e]: _c },
  [],
  []
];
n0_registry.registerError(XYZServiceServiceException$, XYZServiceServiceException);
/**
 * TypeRegistry instances containing modeled errors.
 * @internal
 *
 */
export const errorTypeRegistries = [
  _s_registry,
  n0_registry,
]
var Tag: StaticSimpleSchema = [0, n0, _T, { [_l]: [1, 50] }, 0];
export var HttpLabelCommandInput$: StaticStructureSchema = [3, n1, _HLCI,
  0,
  [_LDNATRP],
  [[0, 1]], 1
];
export var HttpLabelCommandOutput$: StaticStructureSchema = [3, n1, _HLCO,
  0,
  [],
  []
];
export var Alpha$: StaticStructureSchema = [3, n0, _A,
  0,
  [_i, _t],
  [0, 4]
];
export var camelCaseOperationInput$: StaticStructureSchema = [3, n0, _cCOI,
  0,
  [_to],
  [0]
];
export var camelCaseOperationOutput$: StaticStructureSchema = [3, n0, _cCOO,
  0,
  [_to, _r],
  [0, 64 | 21]
];
export var ConstrainedAddress$: StaticStructureSchema = [3, n0, _CA,
  0,
  [_zC, _st],
  [[0, { [_p]: _ }], [0, { [_l]: [2, 2] }]]
];
export var DifferentShapeName$: StaticStructureSchema = [3, n0, _DSN,
  0,
  [_n, _nu],
  [0, 1]
];
export var GetNumbersRequest$: StaticStructureSchema = [3, n0, _GNR,
  0,
  [_bD, _bI, _fWM, _fWMi, _sT, _mR, _cHI, _num, _sN],
  [19, 17, 0, 0, 0, 1, 0, 128 | 1, [() => SparseIntegerMap, 0]]
];
export var GetNumbersResponse$: StaticStructureSchema = [3, n0, _GNRe,
  0,
  [_bD, _bI, _num, _sN, _nT, _dN, _dNWE, _dNWC, _iDN],
  [19, 17, 64 | 1, [() => SparseIntegerList, 0], 0, 64 | 1, 64 | 1, 64 | 1, 64 | 1]
];
export var HostPrefixOperationInput$: StaticStructureSchema = [3, n0, _HPOI,
  0,
  [_AI],
  [[0, { [_hL]: 1 }]], 1
];
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
export var ValidatedInput$: StaticStructureSchema = [3, n0, _VI,
  0,
  [_u, _a, _em, _ta, _uT, _ad],
  [[0, { [_l]: [1, 100] }], [1, { [_ra]: [1, 150] }], [0, { [_p]: _zZzZzZ }], [() => TagList, { [_l]: [1, 5] }], [() => UniqueTagList, 0], [() => ConstrainedAddress$, 0]]
];
export var ValidatedOutput$: StaticStructureSchema = [3, n0, _VO,
  0,
  [_m],
  [0]
];
var __Unit = "unit" as const;
var Blobs = 64 | 21;
var IntegerList = 64 | 1;
var SparseIntegerList: StaticListSchema = [1, n0, _SIL,
  { [_sp]: 1 }, 1
];
var TagList: StaticListSchema = [1, n0, _TL,
  0, [() => Tag,
    0]
];
var UniqueTagList: StaticListSchema = [1, n0, _UTL,
  { [_uI]: 1 }, [() => Tag,
    0]
];
var IntegerMap = 128 | 1;
var SparseIntegerMap: StaticMapSchema = [2, n0, _SIM,
  { [_sp]: 1 }, 0, 1
];
export var TradeEvents$: StaticUnionSchema = [4, n0, _TE,
  { [_str]: 1 },
  [_al, _b, _g, _d],
  [() => Alpha$, () => __Unit, () => __Unit, () => DifferentShapeName$]
];
export var HttpLabelCommand$: StaticOperationSchema = [9, n1, _HLC,
  { [_h]: ["POST", "/{LabelDoesNotApplyToRpcProtocol}", 200] }, () => HttpLabelCommandInput$, () => HttpLabelCommandOutput$
];
export var camelCaseOperation$: StaticOperationSchema = [9, n0, _cCO,
  { [_h]: ["POST", "/camel-case", 200] }, () => camelCaseOperationInput$, () => camelCaseOperationOutput$
];
export var GetNumbers$: StaticOperationSchema = [9, n0, _GN,
  { [_h]: ["POST", "/get-numbers", 200] }, () => GetNumbersRequest$, () => GetNumbersResponse$
];
export var HostPrefixOperation$: StaticOperationSchema = [9, n0, _HPO,
  { [_en]: ["{AccountId}."] }, () => HostPrefixOperationInput$, () => __Unit
];
export var TradeEventStream$: StaticOperationSchema = [9, n0, _TES,
  { [_h]: ["POST", "/trade-event-stream", 200] }, () => TradeEventStreamRequest$, () => TradeEventStreamResponse$
];
export var ValidatedOperation$: StaticOperationSchema = [9, n0, _VOa,
  { [_h]: ["POST", "/validated", 200] }, () => ValidatedInput$, () => ValidatedOutput$
];
