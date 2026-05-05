import { Readable } from "node:stream";
import { streamCollector } from "@smithy/node-http-handler";
import type { HttpResponse } from "@smithy/types";

import { SnapshotPayloadSerializer } from "./SnapshotPayloadSerializer";

/**
 * @internal
 */
export async function serializeHttpResponse(r: HttpResponse, mayBufferResponseBody?: boolean): Promise<string> {
  const { statusCode, headers } = r;

  let headerLines = ``;
  for (const [k, v] of Object.entries(headers ?? {})) {
    headerLines += `${k}: ${v}\n`;
  }

  if (mayBufferResponseBody && r.body instanceof Readable) {
    r.body = await streamCollector(r.body);
  }

  const [bodyAnnotation, bodySnapshot] = await new SnapshotPayloadSerializer(r).toStringAsync();

  return `[status] ${statusCode}
  
${headerLines}
${bodyAnnotation}
${bodySnapshot}
`;
}
