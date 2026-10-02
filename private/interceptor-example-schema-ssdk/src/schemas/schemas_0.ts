const _GI = "GetItem";
const _GII = "GetItemInput";
const _GIO = "GetItemOutput";
const _P = "Ping";
const _PI = "PingInput";
const _PO = "PingOutput";
const _h = "http";
const _i = "id";
const _m = "message";
const _n = "name";
const _s = "smithy.ts.sdk.synthetic.example.interceptors";
const n0 = "example.interceptors";

// smithy-typescript generated code
import { TypeRegistry } from "@smithy/core/schema";
import type { StaticErrorSchema, StaticOperationSchema, StaticStructureSchema } from "@smithy/types";

import { InterceptorExampleServiceServiceException } from "../models/InterceptorExampleServiceServiceException";

/* eslint no-var: 0 */
const _s_registry = new TypeRegistry(_s);
export var InterceptorExampleServiceServiceException$: StaticErrorSchema = [-3, _s, "InterceptorExampleServiceServiceException", 0, [], []];
_s_registry.registerError(InterceptorExampleServiceServiceException$, InterceptorExampleServiceServiceException);
/**
 * TypeRegistry instances containing modeled errors.
 * @internal
 *
 */
export const errorTypeRegistries = [
  _s_registry,
]
export var GetItemInput$: StaticStructureSchema = [3, n0, _GII,
  0,
  [_i],
  [[0, 1]], 1
];
export var GetItemOutput$: StaticStructureSchema = [3, n0, _GIO,
  0,
  [_i, _n],
  [0, 0]
];
export var PingInput$: StaticStructureSchema = [3, n0, _PI,
  0,
  [_m],
  [0]
];
export var PingOutput$: StaticStructureSchema = [3, n0, _PO,
  0,
  [_m],
  [0]
];
export var GetItem$: StaticOperationSchema = [9, n0, _GI,
  { [_h]: ["GET", "/item/{id}", 200] }, () => GetItemInput$, () => GetItemOutput$
];
export var Ping$: StaticOperationSchema = [9, n0, _P,
  { [_h]: ["POST", "/ping", 200] }, () => PingInput$, () => PingOutput$
];
