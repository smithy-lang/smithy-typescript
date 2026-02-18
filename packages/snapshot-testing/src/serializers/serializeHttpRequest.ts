import type { HttpRequest as IHttpRequest } from "@smithy/types";

import { SnapshotPayloadSerializer } from "./SnapshotPayloadSerializer";

/**
 * Serialize an http request to string for snapshotting.
 * @param request
 */
export async function serializeHttpRequest(request: IHttpRequest): Promise<string> {
  const { method, protocol, hostname, port, path, query, headers, username, password, fragment, body } = request;
  const defaultPort = protocol === "https:" || protocol === "wss:" ? 443 : 80;

  let slug = `${path}`;
  let append = "?";
  for (const [k, v] of Object.entries(query ?? {})) {
    if (Array.isArray(v)) {
      for (const v2 of v) {
        slug += `${append}${k}=${v2}`;
        append = "&";
      }
    } else {
      slug += `${append}${k}=${v}`;
      append = "&";
    }
  }
  if (fragment) {
    slug += `#${fragment}`;
  }

  if (username || password) {
    slug = `<username>:***@${slug}`;
  }

  let headerLines = ``;
  for (const [k, v] of Object.entries(headers ?? {})) {
    if (k.toLowerCase().match(/security|-token/)) {
      headerLines += `${k}: ***\n`;
    } else if (k.toLowerCase() === "authorization") {
      let value = "***";
      if (headers[k].match(/Credential=\w+\//)) {
        value = headers[k]
          .replace(/Credential=\w+\//g, "Credential=***/")
          .replace(/Credential=\*\*\*\/\d{8}\//g, "Credential=***/19991231/")
          .replace(/Signature=\w+/g, "Signature=***");
      }
      headerLines += `${k}: ${value}\n`;
    } else if (k.toLowerCase() === "x-amz-date") {
      headerLines += `${k}: ${v.replace(/^(\d{8})T(\d{6}Z)$/, "19991231T235959Z")}\n`;
    } else if (k.toLowerCase() === "user-agent" || k.toLowerCase() === "x-amz-user-agent") {
      headerLines += `${k}: ${v
        .replace(/aws-sdk-js\/\d\.\d+\.\d+/, "aws-sdk-js/3.___._")
        .replace(/os\/(.*?)\s/g, "")
        .replace(/#(.*?)\s/g, "#_.__ ")}\n`;
    } else {
      headerLines += `${k}: ${v}\n`;
    }
  }

  const [bodyAnnotation, bodySnapshot] = await new SnapshotPayloadSerializer(request).toStringAsync();

  return derandomize(`${method} ${protocol}//${hostname}${port && port !== defaultPort ? `:${port}` : ""} 
${slug}

${headerLines}
${bodyAnnotation}
${bodySnapshot}
`);
}

function derandomize(str: string): string {
  return str.replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    "1111abcd-uuid-uuid-uuid-000000001111"
  );
}
