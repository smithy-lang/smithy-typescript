const _VE = "ValidationException";
const _c = "client";
const _e = "error";

// smithy-typescript generated code
import { ValidationException as __ValidationException } from "../models/index";
import { TypeRegistry, error as __error } from "@smithy/core/schema";

/* eslint no-var: 0 */

export const smithy_frameworkRegistry = TypeRegistry.for("smithy.framework");
smithy_frameworkRegistry.startCapture();
export var ValidationException = __error(
  _VE,
  {
    [_e]: _c,
  },
  {},

  __ValidationException
);
export var ValidationExceptionField: undefined;

export var ValidationExceptionFieldList: undefined;

smithy_frameworkRegistry.stopCapture();
