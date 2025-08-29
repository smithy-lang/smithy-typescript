export const _CE = "ComplexError";
export const _CNED = "ComplexNestedErrorData";
export const _COD = "ClientOptionalDefaults";
export const _D = "Defaults";
export const _DSM = "DenseSetMap";
export const _DSMe = "DenseStructMap";
export const _EIO = "EmptyInputOutput";
export const _ES = "EmptyStructure";
export const _F = "Foo";
export const _FO = "Float16Output";
export const _FS = "FractionalSeconds";
export const _FSO = "FractionalSecondsOutput";
export const _Fl = "Float16";
export const _GS = "GreetingStruct";
export const _GWE = "GreetingWithErrors";
export const _GWEO = "GreetingWithErrorsOutput";
export const _IG = "InvalidGreeting";
export const _M = "Message";
export const _N = "Nested";
export const _NIO = "NoInputOutput";
export const _NSL = "NestedStringList";
export const _OIO = "OptionalInputOutput";
export const _OWD = "OperationWithDefaults";
export const _OWDI = "OperationWithDefaultsInput";
export const _OWDO = "OperationWithDefaultsOutput";
export const _RS = "RecursiveShapes";
export const _RSIO = "RecursiveShapesInputOutput";
export const _RSION = "RecursiveShapesInputOutputNested1";
export const _RSIONe = "RecursiveShapesInputOutputNested2";
export const _RVCDM = "RpcV2CborDenseMaps";
export const _RVCDMIO = "RpcV2CborDenseMapsInputOutput";
export const _RVCL = "RpcV2CborLists";
export const _RVCLIO = "RpcV2CborListInputOutput";
export const _RVCSM = "RpcV2CborSparseMaps";
export const _RVCSMIO = "RpcV2CborSparseMapsInputOutput";
export const _SBM = "SparseBooleanMap";
export const _SL = "StructureList";
export const _SLM = "StructureListMember";
export const _SNM = "SparseNumberMap";
export const _SNO = "SparseNullsOperation";
export const _SNOIO = "SparseNullsOperationInputOutput";
export const _SS = "SimpleStructure";
export const _SSL = "SparseStringList";
export const _SSM = "SparseSetMap";
export const _SSMp = "SparseStructMap";
export const _SSMpa = "SparseStringMap";
export const _SSP = "SimpleScalarProperties";
export const _SSS = "SimpleScalarStructure";
export const _TL = "TopLevel";
export const _VE = "ValidationException";
export const _VEF = "ValidationExceptionField";
export const _VEFL = "ValidationExceptionFieldList";
export const _a = "a";
export const _b = "bar";
export const _bL = "booleanList";
export const _bLl = "blobList";
export const _bV = "byteValue";
export const _bVl = "blobValue";
export const _b_ = "b";
export const _c = "client";
export const _cOD = "clientOptionalDefaults";
export const _d = "datetime";
export const _dB = "defaultBoolean";
export const _dBM = "denseBooleanMap";
export const _dBe = "defaultBlob";
export const _dBef = "defaultByte";
export const _dD = "defaultDouble";
export const _dE = "defaultEnum";
export const _dF = "defaultFloat";
export const _dI = "defaultInteger";
export const _dIE = "defaultIntEnum";
export const _dL = "defaultList";
export const _dLe = "defaultLong";
export const _dM = "defaultMap";
export const _dNM = "denseNumberMap";
export const _dS = "defaultString";
export const _dSM = "denseStructMap";
export const _dSMe = "denseStringMap";
export const _dSMen = "denseSetMap";
export const _dSe = "defaultShort";
export const _dT = "defaultTimestamp";
export const _dV = "doubleValue";
export const _de = "defaults";
export const _e = "error";
export const _eB = "emptyBlob";
export const _eL = "enumList";
export const _eS = "emptyString";
export const _f = "foo";
export const _fB = "falseBoolean";
export const _fBV = "falseBooleanValue";
export const _fL = "fieldList";
export const _fV = "floatValue";
export const _g = "greeting";
export const _h = "hi";
export const _iEL = "intEnumList";
export const _iL = "integerList";
export const _iV = "integerValue";
export const _lV = "longValue";
export const _m = "message";
export const _me = "member";
export const _n = "nested";
export const _nSL = "nestedStringList";
export const _oTLD = "otherTopLevelDefault";
export const _p = "path";
export const _rM = "recursiveMember";
export const _s = "sparse";
export const _sBM = "sparseBooleanMap";
export const _sL = "stringList";
export const _sLt = "structureList";
export const _sNM = "sparseNumberMap";
export const _sS = "stringSet";
export const _sSL = "sparseStringList";
export const _sSM = "sparseStructMap";
export const _sSMp = "sparseStringMap";
export const _sSMpa = "sparseSetMap";
export const _sV = "shortValue";
export const _sVt = "stringValue";
export const _tBV = "trueBooleanValue";
export const _tL = "timestampList";
export const _tLD = "topLevelDefault";
export const _v = "value";
export const _zB = "zeroByte";
export const _zD = "zeroDouble";
export const _zF = "zeroFloat";
export const _zI = "zeroInteger";
export const _zL = "zeroLong";
export const _zS = "zeroShort";
export const n0 = "smithy.framework";
export const n1 = "smithy.protocoltests.rpcv2Cbor";
export const n2 = "smithy.protocoltests.shared";

// smithy-typescript generated code
import { RpcV2ProtocolServiceException as __RpcV2ProtocolServiceException } from "../models/RpcV2ProtocolServiceException";
import {
  ComplexError as __ComplexError,
  InvalidGreeting as __InvalidGreeting,
  ValidationException as __ValidationException,
} from "../models/index";
import { error, list, map, op, struct } from "@smithy/core/schema";

/* eslint no-var: 0 */

export var Unit = "unit" as const;

export var ValidationException = error(
  n0,
  _VE,
  {
    [_e]: _c,
  },
  [_m, _fL],
  [0, () => ValidationExceptionFieldList],

  __ValidationException
);
export var ValidationExceptionField = struct(n0, _VEF, 0, [_p, _m], [0, 0]);
export var ClientOptionalDefaults = struct(n1, _COD, 0, [_me], [1]);
export var ComplexError = error(
  n1,
  _CE,
  {
    [_e]: _c,
  },
  [_TL, _N],
  [0, () => ComplexNestedErrorData],

  __ComplexError
);
export var ComplexNestedErrorData = struct(n1, _CNED, 0, [_F], [0]);
export var Defaults = struct(
  n1,
  _D,
  0,
  [
    _dS,
    _dB,
    _dL,
    _dT,
    _dBe,
    _dBef,
    _dSe,
    _dI,
    _dLe,
    _dF,
    _dD,
    _dM,
    _dE,
    _dIE,
    _eS,
    _fB,
    _eB,
    _zB,
    _zS,
    _zI,
    _zL,
    _zF,
    _zD,
  ],
  [0, 2, 64 | 0, 4, 21, 1, 1, 1, 1, 1, 1, 128 | 0, 0, 1, 0, 2, 21, 1, 1, 1, 1, 1, 1]
);
export var GreetingWithErrorsOutput = struct(n1, _GWEO, 0, [_g], [0]);
export var InvalidGreeting = error(
  n1,
  _IG,
  {
    [_e]: _c,
  },
  [_M],
  [0],

  __InvalidGreeting
);
export var OperationWithDefaultsInput = struct(
  n1,
  _OWDI,
  0,
  [_de, _cOD, _tLD, _oTLD],
  [() => Defaults, () => ClientOptionalDefaults, 0, 1]
);
export var OperationWithDefaultsOutput = struct(
  n1,
  _OWDO,
  0,
  [
    _dS,
    _dB,
    _dL,
    _dT,
    _dBe,
    _dBef,
    _dSe,
    _dI,
    _dLe,
    _dF,
    _dD,
    _dM,
    _dE,
    _dIE,
    _eS,
    _fB,
    _eB,
    _zB,
    _zS,
    _zI,
    _zL,
    _zF,
    _zD,
  ],
  [0, 2, 64 | 0, 4, 21, 1, 1, 1, 1, 1, 1, 128 | 0, 0, 1, 0, 2, 21, 1, 1, 1, 1, 1, 1]
);
export var RecursiveShapesInputOutput = struct(n1, _RSIO, 0, [_n], [() => RecursiveShapesInputOutputNested1]);
export var RecursiveShapesInputOutputNested1 = struct(
  n1,
  _RSION,
  0,
  [_f, _n],
  [0, () => RecursiveShapesInputOutputNested2]
);
export var RecursiveShapesInputOutputNested2 = struct(
  n1,
  _RSIONe,
  0,
  [_b, _rM],
  [0, () => RecursiveShapesInputOutputNested1]
);
export var RpcV2CborDenseMapsInputOutput = struct(
  n1,
  _RVCDMIO,
  0,
  [_dSM, _dNM, _dBM, _dSMe, _dSMen],
  [() => DenseStructMap, 128 | 1, 128 | 2, 128 | 0, map(n1, _DSM, 0, 0, 64 | 0)]
);
export var RpcV2CborListInputOutput = struct(
  n1,
  _RVCLIO,
  0,
  [_sL, _sS, _iL, _bL, _tL, _eL, _iEL, _nSL, _sLt, _bLl],
  [64 | 0, 64 | 0, 64 | 1, 64 | 2, 64 | 4, 64 | 0, 64 | 1, list(n2, _NSL, 0, 64 | 0), () => StructureList, 64 | 21]
);
export var RpcV2CborSparseMapsInputOutput = struct(
  n1,
  _RVCSMIO,
  0,
  [_sSM, _sNM, _sBM, _sSMp, _sSMpa],
  [
    [() => SparseStructMap, 0],
    [() => SparseNumberMap, 0],
    [() => SparseBooleanMap, 0],
    [() => SparseStringMap, 0],
    [() => SparseSetMap, 0],
  ]
);
export var SimpleScalarStructure = struct(
  n1,
  _SSS,
  0,
  [_tBV, _fBV, _bV, _dV, _fV, _iV, _lV, _sV, _sVt, _bVl],
  [2, 2, 1, 1, 1, 1, 1, 1, 0, 21]
);
export var SimpleStructure = struct(n1, _SS, 0, [_v], [0]);
export var SparseNullsOperationInputOutput = struct(
  n1,
  _SNOIO,
  0,
  [_sSL, _sSMp],
  [
    [() => SparseStringList, 0],
    [() => SparseStringMap, 0],
  ]
);
export var StructureListMember = struct(n1, _SLM, 0, [_a, _b_], [0, 0]);
export var GreetingStruct = struct(n2, _GS, 0, [_h], [0]);
export var RpcV2ProtocolServiceException = error(
  "smithy.ts.sdk.synthetic.smithy.protocoltests.rpcv2Cbor",
  "RpcV2ProtocolServiceException",
  0,
  [],
  [],
  __RpcV2ProtocolServiceException
);
export var ValidationExceptionFieldList = list(n0, _VEFL, 0, () => ValidationExceptionField);
export var StructureList = list(n1, _SL, 0, () => StructureListMember);
export var TestStringList = 64 | 0;

export var BlobList = 64 | 21;

export var BooleanList = 64 | 2;

export var FooEnumList = 64 | 0;

export var IntegerEnumList = 64 | 1;

export var IntegerList = 64 | 1;

export var NestedStringList = list(n2, _NSL, 0, 64 | 0);
export var SparseStringList = list(
  n2,
  _SSL,
  {
    [_s]: 1,
  },
  0
);
export var StringList = 64 | 0;

export var StringSet = 64 | 0;

export var TimestampList = 64 | 4;

export var DenseBooleanMap = 128 | 2;

export var DenseNumberMap = 128 | 1;

export var DenseSetMap = map(n1, _DSM, 0, 0, 64 | 0);
export var DenseStringMap = 128 | 0;

export var DenseStructMap = map(n1, _DSMe, 0, 0, () => GreetingStruct);
export var SparseBooleanMap = map(
  n1,
  _SBM,
  {
    [_s]: 1,
  },
  0,
  2
);
export var SparseNumberMap = map(
  n1,
  _SNM,
  {
    [_s]: 1,
  },
  0,
  1
);
export var SparseSetMap = map(
  n1,
  _SSM,
  {
    [_s]: 1,
  },
  0,
  64 | 0
);
export var SparseStructMap = map(
  n1,
  _SSMp,
  {
    [_s]: 1,
  },
  0,
  () => GreetingStruct
);
export var TestStringMap = 128 | 0;

export var SparseStringMap = map(
  n2,
  _SSMpa,
  {
    [_s]: 1,
  },
  0,
  0
);
export var GreetingWithErrors = op(
  n1,
  _GWE,
  2,
  () => Unit,
  () => GreetingWithErrorsOutput
);
export var OperationWithDefaults = op(
  n1,
  _OWD,
  0,
  () => OperationWithDefaultsInput,
  () => OperationWithDefaultsOutput
);
export var OptionalInputOutput = op(
  n1,
  _OIO,
  0,
  () => SimpleStructure,
  () => SimpleStructure
);
export var RecursiveShapes = op(
  n1,
  _RS,
  0,
  () => RecursiveShapesInputOutput,
  () => RecursiveShapesInputOutput
);
export var RpcV2CborDenseMaps = op(
  n1,
  _RVCDM,
  0,
  () => RpcV2CborDenseMapsInputOutput,
  () => RpcV2CborDenseMapsInputOutput
);
export var RpcV2CborLists = op(
  n1,
  _RVCL,
  2,
  () => RpcV2CborListInputOutput,
  () => RpcV2CborListInputOutput
);
export var RpcV2CborSparseMaps = op(
  n1,
  _RVCSM,
  0,
  () => RpcV2CborSparseMapsInputOutput,
  () => RpcV2CborSparseMapsInputOutput
);
export var SimpleScalarProperties = op(
  n1,
  _SSP,
  0,
  () => SimpleScalarStructure,
  () => SimpleScalarStructure
);
export var SparseNullsOperation = op(
  n1,
  _SNO,
  0,
  () => SparseNullsOperationInputOutput,
  () => SparseNullsOperationInputOutput
);
