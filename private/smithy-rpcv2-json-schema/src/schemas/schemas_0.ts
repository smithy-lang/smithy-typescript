const _BDO = "BigDecimalOperation";
const _BDS = "BigDecimalStructure";
const _BIO = "BigIntegerOperation";
const _BIS = "BigIntegerStructure";
const _CE = "ComplexError";
const _CNED = "ComplexNestedErrorData";
const _COD = "ClientOptionalDefaults";
const _D = "Defaults";
const _DSM = "DenseSetMap";
const _DSMe = "DenseStructMap";
const _EIO = "EmptyInputOutput";
const _ES = "EmptyStructure";
const _F = "Foo";
const _FS = "FractionalSeconds";
const _FSO = "FractionalSecondsOutput";
const _GS = "GreetingStruct";
const _GWE = "GreetingWithErrors";
const _GWEO = "GreetingWithErrorsOutput";
const _IG = "InvalidGreeting";
const _M = "Message";
const _N = "Nested";
const _NIO = "NoInputOutput";
const _NSL = "NestedStringList";
const _OIO = "OptionalInputOutput";
const _OWD = "OperationWithDefaults";
const _OWDI = "OperationWithDefaultsInput";
const _OWDO = "OperationWithDefaultsOutput";
const _RS = "RecursiveShapes";
const _RSIO = "RecursiveShapesInputOutput";
const _RSION = "RecursiveShapesInputOutputNested1";
const _RSIONe = "RecursiveShapesInputOutputNested2";
const _RVJDM = "RpcV2JsonDenseMaps";
const _RVJDMIO = "RpcV2JsonDenseMapsInputOutput";
const _RVJL = "RpcV2JsonLists";
const _RVJLIO = "RpcV2JsonListInputOutput";
const _RVJSM = "RpcV2JsonSparseMaps";
const _RVJSMIO = "RpcV2JsonSparseMapsInputOutput";
const _SBM = "SparseBooleanMap";
const _SL = "StructureList";
const _SLM = "StructureListMember";
const _SNM = "SparseNumberMap";
const _SNO = "SparseNullsOperation";
const _SNOIO = "SparseNullsOperationInputOutput";
const _SS = "SimpleStructure";
const _SSL = "SparseStringList";
const _SSM = "SparseSetMap";
const _SSMp = "SparseStructMap";
const _SSMpa = "SparseStringMap";
const _SSP = "SimpleScalarProperties";
const _SSS = "SimpleScalarStructure";
const _TFI = "TimestampFormatIgnored";
const _TFIIO = "TimestampFormatIgnoredIO";
const _TL = "TopLevel";
const _VE = "ValidationException";
const _VEF = "ValidationExceptionField";
const _VEFL = "ValidationExceptionFieldList";
const _a = "a";
const _b = "bar";
const _bL = "booleanList";
const _bLl = "blobList";
const _bV = "byteValue";
const _bVl = "blobValue";
const _b_ = "b";
const _c = "client";
const _cOD = "clientOptionalDefaults";
const _d = "datetime";
const _dB = "defaultBoolean";
const _dBM = "denseBooleanMap";
const _dBe = "defaultBlob";
const _dBef = "defaultByte";
const _dD = "defaultDouble";
const _dE = "defaultEnum";
const _dF = "defaultFloat";
const _dI = "defaultInteger";
const _dIE = "defaultIntEnum";
const _dL = "defaultList";
const _dLe = "defaultLong";
const _dM = "defaultMap";
const _dNM = "denseNumberMap";
const _dS = "defaultString";
const _dSM = "denseStructMap";
const _dSMe = "denseStringMap";
const _dSMen = "denseSetMap";
const _dSe = "defaultShort";
const _dT = "defaultTimestamp";
const _dTa = "dateTime";
const _dV = "doubleValue";
const _de = "defaults";
const _e = "error";
const _eB = "emptyBlob";
const _eL = "enumList";
const _eS = "emptyString";
const _eSp = "epochSeconds";
const _f = "foo";
const _fB = "falseBoolean";
const _fBV = "falseBooleanValue";
const _fL = "fieldList";
const _fV = "floatValue";
const _g = "greeting";
const _h = "hi";
const _hD = "httpDate";
const _iEL = "intEnumList";
const _iL = "integerList";
const _iV = "integerValue";
const _lV = "longValue";
const _m = "message";
const _me = "member";
const _n = "nested";
const _nSL = "nestedStringList";
const _no = "normal";
const _oTLD = "otherTopLevelDefault";
const _p = "path";
const _rM = "recursiveMember";
const _s = "sparse";
const _sBM = "sparseBooleanMap";
const _sJ = "smithy.ts.sdk.synthetic.smithy.protocoltests.rpcv2Json";
const _sL = "stringList";
const _sLt = "structureList";
const _sNM = "sparseNumberMap";
const _sS = "stringSet";
const _sSL = "sparseStringList";
const _sSM = "sparseStructMap";
const _sSMp = "sparseStringMap";
const _sSMpa = "sparseSetMap";
const _sV = "shortValue";
const _sVt = "stringValue";
const _tBV = "trueBooleanValue";
const _tL = "timestampList";
const _tLD = "topLevelDefault";
const _v = "value";
const _zB = "zeroByte";
const _zD = "zeroDouble";
const _zF = "zeroFloat";
const _zI = "zeroInteger";
const _zL = "zeroLong";
const _zS = "zeroShort";
const n0 = "smithy.framework";
const n1 = "smithy.protocoltests.rpcv2Json";
const n2 = "smithy.protocoltests.shared";

// smithy-typescript generated code
import { TypeRegistry } from "@smithy/core/schema";
import type {
  StaticErrorSchema,
  StaticListSchema,
  StaticMapSchema,
  StaticOperationSchema,
  StaticStructureSchema,
} from "@smithy/types";

import { ComplexError, InvalidGreeting, ValidationException } from "../models/errors";
import { RpcV2JsonProtocolServiceException } from "../models/RpcV2JsonProtocolServiceException";

/* eslint no-var: 0 */
const _sJ_registry = TypeRegistry.for(_sJ);
export var RpcV2JsonProtocolServiceException$: StaticErrorSchema = [-3, _sJ, "RpcV2JsonProtocolServiceException", 0, [], []];
_sJ_registry.registerError(RpcV2JsonProtocolServiceException$, RpcV2JsonProtocolServiceException);
const n0_registry = TypeRegistry.for(n0);
const n1_registry = TypeRegistry.for(n1);
export var ValidationException$: StaticErrorSchema = [-3, n0, _VE,
  { [_e]: _c },
  [_m, _fL],
  [0, () => ValidationExceptionFieldList], 1
];
n0_registry.registerError(ValidationException$, ValidationException);
export var ComplexError$: StaticErrorSchema = [-3, n1, _CE,
  { [_e]: _c },
  [_TL, _N],
  [0, () => ComplexNestedErrorData$]
];
n1_registry.registerError(ComplexError$, ComplexError);
export var InvalidGreeting$: StaticErrorSchema = [-3, n1, _IG,
  { [_e]: _c },
  [_M],
  [0]
];
n1_registry.registerError(InvalidGreeting$, InvalidGreeting);
/**
 * TypeRegistry instances containing modeled errors.
 * @internal
 *
 */
export const errorTypeRegistries = [
  _sJ_registry,
  n0_registry,
  n1_registry,
]
var __Unit = "unit" as const;
export var ValidationExceptionField$: StaticStructureSchema = [3, n0, _VEF,
  0,
  [_p, _m],
  [0, 0], 2
];
export var BigDecimalStructure$: StaticStructureSchema = [3, n1, _BDS,
  0,
  [_v],
  [19]
];
export var BigIntegerStructure$: StaticStructureSchema = [3, n1, _BIS,
  0,
  [_v],
  [17]
];
export var ClientOptionalDefaults$: StaticStructureSchema = [3, n1, _COD,
  0,
  [_me],
  [1]
];
export var ComplexNestedErrorData$: StaticStructureSchema = [3, n1, _CNED,
  0,
  [_F],
  [0]
];
export var Defaults$: StaticStructureSchema = [3, n1, _D,
  0,
  [_dS, _dB, _dL, _dT, _dBe, _dBef, _dSe, _dI, _dLe, _dF, _dD, _dM, _dE, _dIE, _eS, _fB, _eB, _zB, _zS, _zI, _zL, _zF, _zD],
  [0, 2, 64 | 0, 4, 21, 1, 1, 1, 1, 1, 1, 128 | 0, 0, 1, 0, 2, 21, 1, 1, 1, 1, 1, 1]
];
export var EmptyStructure$: StaticStructureSchema = [3, n1, _ES,
  0,
  [],
  []
];
export var FractionalSecondsOutput$: StaticStructureSchema = [3, n1, _FSO,
  0,
  [_d],
  [4]
];
export var GreetingWithErrorsOutput$: StaticStructureSchema = [3, n1, _GWEO,
  0,
  [_g],
  [0]
];
export var OperationWithDefaultsInput$: StaticStructureSchema = [3, n1, _OWDI,
  0,
  [_de, _cOD, _tLD, _oTLD],
  [() => Defaults$, () => ClientOptionalDefaults$, 0, 1]
];
export var OperationWithDefaultsOutput$: StaticStructureSchema = [3, n1, _OWDO,
  0,
  [_dS, _dB, _dL, _dT, _dBe, _dBef, _dSe, _dI, _dLe, _dF, _dD, _dM, _dE, _dIE, _eS, _fB, _eB, _zB, _zS, _zI, _zL, _zF, _zD],
  [0, 2, 64 | 0, 4, 21, 1, 1, 1, 1, 1, 1, 128 | 0, 0, 1, 0, 2, 21, 1, 1, 1, 1, 1, 1]
];
export var RecursiveShapesInputOutput$: StaticStructureSchema = [3, n1, _RSIO,
  0,
  [_n],
  [() => RecursiveShapesInputOutputNested1$]
];
export var RecursiveShapesInputOutputNested1$: StaticStructureSchema = [3, n1, _RSION,
  0,
  [_f, _n],
  [0, () => RecursiveShapesInputOutputNested2$]
];
export var RecursiveShapesInputOutputNested2$: StaticStructureSchema = [3, n1, _RSIONe,
  0,
  [_b, _rM],
  [0, () => RecursiveShapesInputOutputNested1$]
];
export var RpcV2JsonDenseMapsInputOutput$: StaticStructureSchema = [3, n1, _RVJDMIO,
  0,
  [_dSM, _dNM, _dBM, _dSMe, _dSMen],
  [() => DenseStructMap, 128 | 1, 128 | 2, 128 | 0, [2, n1, _DSM, 0, 0, 64 | 0]]
];
export var RpcV2JsonListInputOutput$: StaticStructureSchema = [3, n1, _RVJLIO,
  0,
  [_sL, _sS, _iL, _bL, _tL, _eL, _iEL, _nSL, _sLt, _bLl],
  [64 | 0, 64 | 0, 64 | 1, 64 | 2, 64 | 4, 64 | 0, 64 | 1, [1, n2, _NSL, 0, 64 | 0], () => StructureList, 64 | 21]
];
export var RpcV2JsonSparseMapsInputOutput$: StaticStructureSchema = [3, n1, _RVJSMIO,
  0,
  [_sSM, _sNM, _sBM, _sSMp, _sSMpa],
  [[() => SparseStructMap, 0], [() => SparseNumberMap, 0], [() => SparseBooleanMap, 0], [() => SparseStringMap, 0], [() => SparseSetMap, 0]]
];
export var SimpleScalarStructure$: StaticStructureSchema = [3, n1, _SSS,
  0,
  [_tBV, _fBV, _bV, _dV, _fV, _iV, _lV, _sV, _sVt, _bVl],
  [2, 2, 1, 1, 1, 1, 1, 1, 0, 21]
];
export var SimpleStructure$: StaticStructureSchema = [3, n1, _SS,
  0,
  [_v],
  [0]
];
export var SparseNullsOperationInputOutput$: StaticStructureSchema = [3, n1, _SNOIO,
  0,
  [_sSL, _sSMp],
  [[() => SparseStringList, 0], [() => SparseStringMap, 0]]
];
export var StructureListMember$: StaticStructureSchema = [3, n1, _SLM,
  0,
  [_a, _b_],
  [0, 0]
];
export var TimestampFormatIgnoredIO$: StaticStructureSchema = [3, n1, _TFIIO,
  0,
  [_dTa, _hD, _eSp, _no],
  [5, 6, 7, 4]
];
export var GreetingStruct$: StaticStructureSchema = [3, n2, _GS,
  0,
  [_h],
  [0]
];
var ValidationExceptionFieldList: StaticListSchema = [1, n0, _VEFL,
  0, () => ValidationExceptionField$
];
var StructureList: StaticListSchema = [1, n1, _SL,
  0, () => StructureListMember$
];
var TestStringList = 64 | 0;
var BlobList = 64 | 21;
var BooleanList = 64 | 2;
var FooEnumList = 64 | 0;
var IntegerEnumList = 64 | 1;
var IntegerList = 64 | 1;
var NestedStringList: StaticListSchema = [1, n2, _NSL,
  0, 64 | 0
];
var SparseStringList: StaticListSchema = [1, n2, _SSL,
  { [_s]: 1 }, 0
];
var StringList = 64 | 0;
var StringSet = 64 | 0;
var TimestampList = 64 | 4;
var DenseBooleanMap = 128 | 2;
var DenseNumberMap = 128 | 1;
var DenseSetMap: StaticMapSchema = [2, n1, _DSM,
  0, 0, 64 | 0
];
var DenseStringMap = 128 | 0;
var DenseStructMap: StaticMapSchema = [2, n1, _DSMe,
  0, 0, () => GreetingStruct$
];
var SparseBooleanMap: StaticMapSchema = [2, n1, _SBM,
  { [_s]: 1 }, 0, 2
];
var SparseNumberMap: StaticMapSchema = [2, n1, _SNM,
  { [_s]: 1 }, 0, 1
];
var SparseSetMap: StaticMapSchema = [2, n1, _SSM,
  { [_s]: 1 }, 0, 64 | 0
];
var SparseStructMap: StaticMapSchema = [2, n1, _SSMp,
  { [_s]: 1 }, 0, () => GreetingStruct$
];
var TestStringMap = 128 | 0;
var SparseStringMap: StaticMapSchema = [2, n2, _SSMpa,
  { [_s]: 1 }, 0, 0
];
export var BigDecimalOperation$: StaticOperationSchema = [9, n1, _BDO,
  0, () => BigDecimalStructure$, () => BigDecimalStructure$
];
export var BigIntegerOperation$: StaticOperationSchema = [9, n1, _BIO,
  0, () => BigIntegerStructure$, () => BigIntegerStructure$
];
export var EmptyInputOutput$: StaticOperationSchema = [9, n1, _EIO,
  0, () => EmptyStructure$, () => EmptyStructure$
];
export var FractionalSeconds$: StaticOperationSchema = [9, n1, _FS,
  0, () => __Unit, () => FractionalSecondsOutput$
];
export var GreetingWithErrors$: StaticOperationSchema = [9, n1, _GWE,
  2, () => __Unit, () => GreetingWithErrorsOutput$
];
export var NoInputOutput$: StaticOperationSchema = [9, n1, _NIO,
  0, () => __Unit, () => __Unit
];
export var OperationWithDefaults$: StaticOperationSchema = [9, n1, _OWD,
  0, () => OperationWithDefaultsInput$, () => OperationWithDefaultsOutput$
];
export var OptionalInputOutput$: StaticOperationSchema = [9, n1, _OIO,
  0, () => SimpleStructure$, () => SimpleStructure$
];
export var RecursiveShapes$: StaticOperationSchema = [9, n1, _RS,
  0, () => RecursiveShapesInputOutput$, () => RecursiveShapesInputOutput$
];
export var RpcV2JsonDenseMaps$: StaticOperationSchema = [9, n1, _RVJDM,
  0, () => RpcV2JsonDenseMapsInputOutput$, () => RpcV2JsonDenseMapsInputOutput$
];
export var RpcV2JsonLists$: StaticOperationSchema = [9, n1, _RVJL,
  2, () => RpcV2JsonListInputOutput$, () => RpcV2JsonListInputOutput$
];
export var RpcV2JsonSparseMaps$: StaticOperationSchema = [9, n1, _RVJSM,
  0, () => RpcV2JsonSparseMapsInputOutput$, () => RpcV2JsonSparseMapsInputOutput$
];
export var SimpleScalarProperties$: StaticOperationSchema = [9, n1, _SSP,
  0, () => SimpleScalarStructure$, () => SimpleScalarStructure$
];
export var SparseNullsOperation$: StaticOperationSchema = [9, n1, _SNO,
  0, () => SparseNullsOperationInputOutput$, () => SparseNullsOperationInputOutput$
];
export var TimestampFormatIgnored$: StaticOperationSchema = [9, n1, _TFI,
  0, () => TimestampFormatIgnoredIO$, () => TimestampFormatIgnoredIO$
];
