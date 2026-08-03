const _B = "Bird";
const _BE = "BirdError";
const _BM = "BirdMeasurements";
const _CN = "CavityNest";
const _GN = "GroundNest";
const _N = "Nest";
const _OCN = "OpenCupNest";
const _SC = "ScientificClassification";
const _c = "client";
const _cS = "conservationStatus";
const _ca = "cavity";
const _co = "concealed";
const _dC = "depthCm";
const _e = "error";
const _eDC = "entranceDiameterCm";
const _f = "family";
const _g = "genus";
const _gr = "ground";
const _h = "habitat";
const _lM = "liningMaterial";
const _m = "message";
const _mLC = "minLengthCm";
const _mLCa = "maxLengthCm";
const _mWC = "minWingspanCm";
const _mWCa = "maxWingspanCm";
const _mWG = "minWeightGrams";
const _mWGa = "maxWeightGrams";
const _me = "measurements";
const _n = "name";
const _ne = "nest";
const _o = "order";
const _oC = "openCup";
const _p = "problem";
const _pM = "primaryMaterial";
const _pl = "placement";
const _r = "reason";
const _s = "substrate";
const _sC = "scientificClassification";
const _sp = "species";
const _t = "tags";
const n0 = "org.xyz.types";

// smithy-typescript generated code
import { TypeRegistry } from "@smithy/core/schema";
import type { StaticErrorSchema, StaticListSchema, StaticStructureSchema, StaticUnionSchema } from "@smithy/types";

import { BirdError } from "../models/errors";

/* eslint no-var: 0 */
const n0_registry = TypeRegistry.for(n0);
export var BirdError$: StaticErrorSchema = [-3, n0, _BE,
  { [_e]: _c },
  [_m, _r],
  [0, 0]
];
n0_registry.registerError(BirdError$, BirdError);
/**
 * TypeRegistry instances containing modeled errors.
 * @internal
 *
 */
export const errorTypeRegistries = [
  n0_registry,
]
export var Bird$: StaticStructureSchema = [3, n0, _B,
  0,
  [_n, _sC, _me, _cS, _t, _ne, _p],
  [0, () => ScientificClassification$, () => BirdMeasurements$, 0, 64 | 0, () => Nest$, [() => BirdError$, 0]]
];
export var BirdMeasurements$: StaticStructureSchema = [3, n0, _BM,
  0,
  [_mWC, _mWCa, _mLC, _mLCa, _mWG, _mWGa],
  [1, 1, 1, 1, 1, 1]
];
export var CavityNest$: StaticStructureSchema = [3, n0, _CN,
  0,
  [_s, _eDC, _dC],
  [0, 1, 1]
];
export var GroundNest$: StaticStructureSchema = [3, n0, _GN,
  0,
  [_h, _co],
  [0, 2]
];
export var OpenCupNest$: StaticStructureSchema = [3, n0, _OCN,
  0,
  [_pl, _pM, _lM],
  [0, 0, 0]
];
export var ScientificClassification$: StaticStructureSchema = [3, n0, _SC,
  0,
  [_o, _f, _g, _sp],
  [0, 0, 0, 0]
];
var __Unit = "unit" as const;
var BirdTagList = 64 | 0;
export var Nest$: StaticUnionSchema = [4, n0, _N,
  0,
  [_oC, _ca, _gr],
  [() => OpenCupNest$, () => CavityNest$, () => GroundNest$]
];
