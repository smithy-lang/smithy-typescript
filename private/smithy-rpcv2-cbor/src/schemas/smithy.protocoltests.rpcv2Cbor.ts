const _CE = "ComplexError";
const _CNED = "ComplexNestedErrorData";
const _COD = "ClientOptionalDefaults";
const _D = "Defaults";
const _DBM = "DenseBooleanMap";
const _DNM = "DenseNumberMap";
const _DSM = "DenseStringMap";
const _DSMe = "DenseSetMap";
const _DSMen = "DenseStructMap";
const _EIO = "EmptyInputOutput";
const _ES = "EmptyStructure";
const _F = "Foo";
const _FO = "Float16Output";
const _FS = "FractionalSeconds";
const _FSO = "FractionalSecondsOutput";
const _Fl = "Float16";
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
const _RVCDM = "RpcV2CborDenseMaps";
const _RVCDMIO = "RpcV2CborDenseMapsInputOutput";
const _RVCL = "RpcV2CborLists";
const _RVCLIO = "RpcV2CborListInputOutput";
const _RVCSM = "RpcV2CborSparseMaps";
const _RVCSMIO = "RpcV2CborSparseMapsInputOutput";
const _SBM = "SparseBooleanMap";
const _SL = "StructureList";
const _SLM = "StructureListMember";
const _SNM = "SparseNumberMap";
const _SNO = "SparseNullsOperation";
const _SNOIO = "SparseNullsOperationInputOutput";
const _SS = "SimpleStructure";
const _SSM = "SparseSetMap";
const _SSMp = "SparseStructMap";
const _SSP = "SimpleScalarProperties";
const _SSS = "SimpleScalarStructure";
const _TE = "TestEnum";
const _TIE = "TestIntEnum";
const _TL = "TopLevel";
const _TSL = "TestStringList";
const _TSM = "TestStringMap";
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
const _dV = "doubleValue";
const _de = "defaults";
const _e = "error";
const _eB = "emptyBlob";
const _eL = "enumList";
const _eS = "emptyString";
const _f = "foo";
const _fB = "falseBoolean";
const _fBV = "falseBooleanValue";
const _fV = "floatValue";
const _g = "greeting";
const _iEL = "intEnumList";
const _iL = "integerList";
const _iV = "integerValue";
const _lV = "longValue";
const _m = "member";
const _n = "nested";
const _nSL = "nestedStringList";
const _oTLD = "otherTopLevelDefault";
const _rM = "recursiveMember";
const _s = "sparse";
const _sBM = "sparseBooleanMap";
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

// smithy-typescript generated code
import { ComplexError as __ComplexError, InvalidGreeting as __InvalidGreeting } from "../models/index";
import { Unit } from "./smithy.api";
import {
  BlobList,
  BooleanList,
  FooEnumList,
  GreetingStruct,
  IntegerEnumList,
  IntegerList,
  NestedStringList,
  SparseStringList,
  SparseStringMap,
  StringList,
  StringSet,
  TimestampList,
} from "./smithy.protocoltests.shared";
import {
  TypeRegistry,
  error as __error,
  list as __list,
  map as __map,
  op as __op,
  struct as __struct,
} from "@smithy/core/schema";

/* eslint no-var: 0 */

export const smithy_protocoltests_rpcv2CborRegistry = TypeRegistry.for("smithy.protocoltests.rpcv2Cbor");
smithy_protocoltests_rpcv2CborRegistry.startCapture();
export var ClientOptionalDefaults = __struct(_COD, 0, [_m], [1]);
export var ComplexError = __error(
  _CE,
  {
    [_e]: _c,
  },
  [_TL, _N],
  [0, () => ComplexNestedErrorData],

  __ComplexError
);
export var ComplexNestedErrorData = __struct(_CNED, 0, [_F], [0]);
export var Defaults = __struct(
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
export var EmptyStructure = __struct(_ES, 0, [], []);
export var Float16Output = __struct(_FO, 0, [_v], [1]);
export var FractionalSecondsOutput = __struct(_FSO, 0, [_d], [5]);
export var GreetingWithErrorsOutput = __struct(_GWEO, 0, [_g], [0]);
export var InvalidGreeting = __error(
  _IG,
  {
    [_e]: _c,
  },
  [_M],
  [0],

  __InvalidGreeting
);
export var OperationWithDefaultsInput = __struct(
  _OWDI,
  0,
  [_de, _cOD, _tLD, _oTLD],
  [() => Defaults, () => ClientOptionalDefaults, 0, 1]
);
export var OperationWithDefaultsOutput = __struct(
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
export var RecursiveShapesInputOutput = __struct(_RSIO, 0, [_n], [() => RecursiveShapesInputOutputNested1]);
export var RecursiveShapesInputOutputNested1 = __struct(
  _RSION,
  0,
  [_f, _n],
  [0, () => RecursiveShapesInputOutputNested2]
);
export var RecursiveShapesInputOutputNested2 = __struct(
  _RSIONe,
  0,
  [_b, _rM],
  [0, () => RecursiveShapesInputOutputNested1]
);
export var RpcV2CborDenseMapsInputOutput = __struct(
  _RVCDMIO,
  0,
  [_dSM, _dNM, _dBM, _dSMe, _dSMen],
  [() => DenseStructMap, 128 | 1, 128 | 2, 128 | 0, __map(_DSMe, 0, 64 | 0)]
);
export var RpcV2CborListInputOutput = __struct(
  _RVCLIO,
  0,
  [_sL, _sS, _iL, _bL, _tL, _eL, _iEL, _nSL, _sLt, _bLl],
  [64 | 0, 64 | 0, 64 | 1, 64 | 2, 64 | 4, 64 | 0, 64 | 1, __list(_NSL, 0, 64 | 0), () => StructureList, 64 | 21]
);
export var RpcV2CborSparseMapsInputOutput = __struct(
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
export var SimpleScalarStructure = __struct(
  _SSS,
  0,
  [_tBV, _fBV, _bV, _dV, _fV, _iV, _lV, _sV, _sVt, _bVl],
  [2, 2, 1, 1, 1, 1, 1, 1, 0, 21]
);
export var SimpleStructure = __struct(_SS, 0, [_v], [0]);
export var SparseNullsOperationInputOutput = __struct(
  _SNOIO,
  0,
  [_sSL, _sSMp],
  [
    [() => SparseStringList, 0],
    [() => SparseStringMap, 0],
  ]
);
export var StructureListMember = __struct(_SLM, 0, [_a, _b_], [0, 0]);
export var StructureList = __list(_SL, 0, () => StructureListMember);
export var TestStringList = 64 | 0;

export var DenseBooleanMap = 128 | 2;

export var DenseNumberMap = 128 | 1;

export var DenseSetMap = __map(_DSMe, 0, 64 | 0);
export var DenseStringMap = 128 | 0;

export var DenseStructMap = __map(_DSMen, 0, () => GreetingStruct);
export var SparseBooleanMap = __map(
  _SBM,
  {
    [_s]: 1,
  },
  2
);
export var SparseNumberMap = __map(
  _SNM,
  {
    [_s]: 1,
  },
  1
);
export var SparseSetMap = __map(
  _SSM,
  {
    [_s]: 1,
  },
  64 | 0
);
export var SparseStructMap = __map(
  _SSMp,
  {
    [_s]: 1,
  },
  () => GreetingStruct
);
export var TestStringMap = 128 | 0;

export var EmptyInputOutput = __op(
  _EIO,
  0,
  () => EmptyStructure,
  () => EmptyStructure
);
export var Float16 = __op(
  _Fl,
  0,
  () => Unit,
  () => Float16Output
);
export var FractionalSeconds = __op(
  _FS,
  0,
  () => Unit,
  () => FractionalSecondsOutput
);
export var GreetingWithErrors = __op(
  _GWE,
  2,
  () => Unit,
  () => GreetingWithErrorsOutput
);
export var NoInputOutput = __op(
  _NIO,
  0,
  () => Unit,
  () => Unit
);
export var OperationWithDefaults = __op(
  _OWD,
  0,
  () => OperationWithDefaultsInput,
  () => OperationWithDefaultsOutput
);
export var OptionalInputOutput = __op(
  _OIO,
  0,
  () => SimpleStructure,
  () => SimpleStructure
);
export var RecursiveShapes = __op(
  _RS,
  0,
  () => RecursiveShapesInputOutput,
  () => RecursiveShapesInputOutput
);
export var RpcV2CborDenseMaps = __op(
  _RVCDM,
  0,
  () => RpcV2CborDenseMapsInputOutput,
  () => RpcV2CborDenseMapsInputOutput
);
export var RpcV2CborLists = __op(
  _RVCL,
  2,
  () => RpcV2CborListInputOutput,
  () => RpcV2CborListInputOutput
);
export var RpcV2CborSparseMaps = __op(
  _RVCSM,
  0,
  () => RpcV2CborSparseMapsInputOutput,
  () => RpcV2CborSparseMapsInputOutput
);
export var SimpleScalarProperties = __op(
  _SSP,
  0,
  () => SimpleScalarStructure,
  () => SimpleScalarStructure
);
export var SparseNullsOperation = __op(
  _SNO,
  0,
  () => SparseNullsOperationInputOutput,
  () => SparseNullsOperationInputOutput
);
smithy_protocoltests_rpcv2CborRegistry.stopCapture();
