import { collectBody } from "./collect-stream-body";
import { toUtf8 } from "@smithy/core/serde";
import type { SerdeFunctions } from "@smithy/types";

export const collectBodyString = (streamBody: any, context: SerdeFunctions): Promise<string> =>
  collectBody(streamBody, context).then((body) => (context?.utf8Encoder ?? toUtf8)(body));
