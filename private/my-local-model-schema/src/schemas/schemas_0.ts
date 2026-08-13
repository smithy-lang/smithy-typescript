const _A = "Alpha";
const _AI = "AccountId";
const _CA = "ConstrainedAddress";
const _CTE = "CodedThrottlingError";
const _DSN = "DifferentShapeName";
const _G = "Gamma";
const _GN = "GetNumbers";
const _GNR = "GetNumbersRequest";
const _GNRe = "GetNumbersResponse";
const _GP = "GammaPayload";
const _HE = "HaltError";
const _HEe = "HeartbeatEvent";
const _HLC = "HttpLabelCommand";
const _HLCI = "HttpLabelCommandInput";
const _HLCO = "HttpLabelCommandOutput";
const _HPO = "HostPrefixOperation";
const _HPOI = "HostPrefixOperationInput";
const _LDNATRP = "LabelDoesNotApplyToRpcProtocol";
const _LE = "LogEvent";
const _ME = "MetricEvent";
const _MSLE = "MainServiceLinkedError";
const _MTE = "MysteryThrottlingError";
const _NE = "NotificationEvent";
const _PE = "PublishEvents";
const _PER = "PublishEventsRequest";
const _PERu = "PublishEventsResponse";
const _PES = "PublishEventStream";
const _RE = "RetryableError";
const _SES = "SubscribeEventStream";
const _SIL = "SparseIntegerList";
const _SIM = "SparseIntegerMap";
const _STE = "SubscribeToEvents";
const _STER = "SubscribeToEventsRequest";
const _STERu = "SubscribeToEventsResponse";
const _TE = "TradeEvents";
const _TES = "TradeEventStream";
const _TESR = "TradeEventStreamRequest";
const _TESRr = "TradeEventStreamResponse";
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
const _ch = "channel";
const _d = "delta";
const _dN = "deprecatedNumbers";
const _dNWC = "deprecatedNumbersWithoutChronology";
const _dNWE = "deprecatedNumbersWithoutExplanation";
const _e = "error";
const _eC = "eventCount";
const _eH = "eventHeader";
const _eP = "eventPayload";
const _eS = "eventStream";
const _em = "email";
const _en = "endpoint";
const _ev = "events";
const _fWM = "fieldWithoutMessage";
const _fWMi = "fieldWithMessage";
const _g = "gamma";
const _h = "heartbeat";
const _hE = "httpError";
const _hH = "httpHeader";
const _hL = "hostLabel";
const _ht = "http";
const _i = "id";
const _iDN = "inexplicablyDeprecatedNumbers";
const _l = "level";
const _lo = "log";
const _m = "message";
const _mE = "maxEvents";
const _mR = "maxResults";
const _me = "metric";
const _n = "name";
const _nT = "nextToken";
const _no = "notification";
const _nu = "number";
const _num = "numbers";
const _oP = "overloadedParam";
const _p = "payload";
const _r = "results";
const _s = "smithy.ts.sdk.synthetic.org.xyz.v1";
const _sI = "subscriptionId";
const _sIe = "sessionId";
const _sN = "sequenceNumber";
const _sNp = "sparseNumbers";
const _sT = "startToken";
const _sp = "sparse";
const _st = "state";
const _str = "streaming";
const _t = "timestamp";
const _ta = "tags";
const _to = "token";
const _top = "topic";
const _u = "username";
const _uT = "uniqueTags";
const _v = "values";
const _va = "value";
const _xc = "x-channel";
const _xec = "x-event-count";
const _xme = "x-max-events";
const _xsi = "x-subscription-id";
const _xsi_ = "x-session-id";
const _zC = "zipCode";
const n0 = "org.xyz.v1";
const n1 = "org.xyz.secondary";

// smithy-typescript generated code
import { TypeRegistry } from "@smithy/core/schema";
import type {
  StaticErrorSchema,
  StaticListSchema,
  StaticMapSchema,
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
const _s_registry = TypeRegistry.for(_s);
export var XYZServiceSyntheticServiceException$: StaticErrorSchema = [-3, _s, "XYZServiceSyntheticServiceException", 0, [], []];
_s_registry.registerError(XYZServiceSyntheticServiceException$, XYZServiceSyntheticServiceException);
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
  [_to, _oP],
  [0, 0]
];
export var camelCaseOperationOutput$: StaticStructureSchema = [3, n0, _cCOO,
  0,
  [_to, _r],
  [0, 64 | 21]
];
export var ConstrainedAddress$: StaticStructureSchema = [3, n0, _CA,
  0,
  [_zC, _st],
  [0, 0]
];
export var DifferentShapeName$: StaticStructureSchema = [3, n0, _DSN,
  0,
  [_n, _nu],
  [0, 1]
];
export var Gamma$: StaticStructureSchema = [3, n0, _G,
  0,
  [_sN, _p],
  [[1, { [_eH]: 1 }], [() => GammaPayload$, { [_eP]: 1 }]]
];
export var GammaPayload$: StaticStructureSchema = [3, n0, _GP,
  0,
  [_m, _v],
  [0, 64 | 1]
];
export var GetNumbersRequest$: StaticStructureSchema = [3, n0, _GNR,
  0,
  [_bD, _bI, _fWM, _fWMi, _sT, _mR, _cHI, _num, _sNp],
  [19, 17, 0, 0, 0, 1, 0, 128 | 1, [() => SparseIntegerMap, 0]]
];
export var GetNumbersResponse$: StaticStructureSchema = [3, n0, _GNRe,
  0,
  [_bD, _bI, _num, _sNp, _nT, _dN, _dNWE, _dNWC, _iDN],
  [19, 17, 64 | 1, [() => SparseIntegerList, 0], 0, 64 | 1, 64 | 1, 64 | 1, 64 | 1]
];
export var HeartbeatEvent$: StaticStructureSchema = [3, n0, _HEe,
  0,
  [_t],
  [4]
];
export var HostPrefixOperationInput$: StaticStructureSchema = [3, n0, _HPOI,
  0,
  [_AI],
  [[0, { [_hL]: 1 }]], 1
];
export var LogEvent$: StaticStructureSchema = [3, n0, _LE,
  0,
  [_l, _m],
  [0, 0]
];
export var MetricEvent$: StaticStructureSchema = [3, n0, _ME,
  0,
  [_n, _va],
  [0, 1]
];
export var NotificationEvent$: StaticStructureSchema = [3, n0, _NE,
  0,
  [_top, _p],
  [0, 0]
];
export var PublishEventsRequest$: StaticStructureSchema = [3, n0, _PER,
  0,
  [_ch, _ev],
  [[0, { [_hH]: _xc }], [() => PublishEventStream$, 16]]
];
export var PublishEventsResponse$: StaticStructureSchema = [3, n0, _PERu,
  0,
  [_eC, _m],
  [[1, { [_hH]: _xec }], 0]
];
export var SubscribeToEventsRequest$: StaticStructureSchema = [3, n0, _STER,
  0,
  [_ch, _mE],
  [[0, { [_hH]: _xc }], [1, { [_hH]: _xme }]]
];
export var SubscribeToEventsResponse$: StaticStructureSchema = [3, n0, _STERu,
  0,
  [_sI, _ev],
  [[0, { [_hH]: _xsi }], [() => SubscribeEventStream$, 16]]
];
export var TradeEventStreamRequest$: StaticStructureSchema = [3, n0, _TESR,
  0,
  [_sIe, _eS],
  [[0, { [_hH]: _xsi_ }], [() => TradeEvents$, 16]]
];
export var TradeEventStreamResponse$: StaticStructureSchema = [3, n0, _TESRr,
  0,
  [_sIe, _eS],
  [[0, { [_hH]: _xsi_ }], [() => TradeEvents$, 16]]
];
export var ValidatedInput$: StaticStructureSchema = [3, n0, _VI,
  0,
  [_u, _a, _em, _ta, _uT, _ad],
  [0, 1, 0, 64 | 0, 64 | 0, () => ConstrainedAddress$]
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
var TagList = 64 | 0;
var UniqueTagList = 64 | 0;
var IntegerMap = 128 | 1;
var SparseIntegerMap: StaticMapSchema = [2, n0, _SIM,
  { [_sp]: 1 }, 0, 1
];
export var PublishEventStream$: StaticUnionSchema = [4, n0, _PES,
  { [_str]: 1 },
  [_lo, _me],
  [() => LogEvent$, () => MetricEvent$]
];
export var SubscribeEventStream$: StaticUnionSchema = [4, n0, _SES,
  { [_str]: 1 },
  [_no, _h],
  [() => NotificationEvent$, () => HeartbeatEvent$]
];
export var TradeEvents$: StaticUnionSchema = [4, n0, _TE,
  { [_str]: 1 },
  [_al, _b, _g, _d],
  [() => Alpha$, () => __Unit, [() => Gamma$, 0], () => DifferentShapeName$]
];
export var HttpLabelCommand$: StaticOperationSchema = [9, n1, _HLC,
  { [_ht]: ["POST", "/{LabelDoesNotApplyToRpcProtocol}", 200] }, () => HttpLabelCommandInput$, () => HttpLabelCommandOutput$
];
export var camelCaseOperation$: StaticOperationSchema = [9, n0, _cCO,
  { [_ht]: ["POST", "/camel-case", 200] }, () => camelCaseOperationInput$, () => camelCaseOperationOutput$
];
export var GetNumbers$: StaticOperationSchema = [9, n0, _GN,
  { [_ht]: ["POST", "/get-numbers", 200] }, () => GetNumbersRequest$, () => GetNumbersResponse$
];
export var HostPrefixOperation$: StaticOperationSchema = [9, n0, _HPO,
  { [_en]: ["{AccountId}."] }, () => HostPrefixOperationInput$, () => __Unit
];
export var PublishEvents$: StaticOperationSchema = [9, n0, _PE,
  { [_ht]: ["POST", "/publish-events", 200] }, () => PublishEventsRequest$, () => PublishEventsResponse$
];
export var SubscribeToEvents$: StaticOperationSchema = [9, n0, _STE,
  { [_ht]: ["POST", "/subscribe-to-events", 200] }, () => SubscribeToEventsRequest$, () => SubscribeToEventsResponse$
];
export var TradeEventStream$: StaticOperationSchema = [9, n0, _TES,
  { [_ht]: ["POST", "/trade-event-stream", 200] }, () => TradeEventStreamRequest$, () => TradeEventStreamResponse$
];
export var ValidatedOperation$: StaticOperationSchema = [9, n0, _VOa,
  { [_ht]: ["POST", "/validated", 200] }, () => ValidatedInput$, () => ValidatedOutput$
];
