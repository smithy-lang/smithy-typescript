const _VE = "ValidationException";
const _VEF = "ValidationExceptionField";
const _VEFL = "ValidationExceptionFieldList";
const _c = "client";
const _e = "error";
const _fL = "fieldList";
const _m = "message";
const _p = "path";

// smithy-typescript generated code
import { ValidationException as __ValidationException } from "../models/index";
import { TypeRegistry, error as __error, list as __list, struct as __struct } from "@smithy/core/schema";

/* eslint no-var: 0 */

export const smithy_frameworkRegistry = TypeRegistry.for("smithy.framework");
smithy_frameworkRegistry.startCapture();
export var ValidationException = __error(
  _VE,
  {
    [_e]: _c,
  },
  [_m, _fL],
  [0, () => ValidationExceptionFieldList],

  __ValidationException
);
export var ValidationExceptionField = __struct(_VEF, 0, [_p, _m], [0, 0]);
export var ValidationExceptionFieldList = __list(_VEFL, 0, () => ValidationExceptionField);
smithy_frameworkRegistry.stopCapture();
