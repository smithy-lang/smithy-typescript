// smithy-typescript generated code
import { Unit, _FS, _FSO, _d, n1 } from "./schemas_0";
import { op, struct } from "@smithy/core/schema";

/* eslint no-var: 0 */

export var FractionalSecondsOutput = struct(n1, _FSO, 0, [_d], [5]);
export var FractionalSeconds = op(
  n1,
  _FS,
  0,
  () => Unit,
  () => FractionalSecondsOutput
);
