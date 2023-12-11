import { HttpRequest } from "@smithy/protocol-http";
import { resolvedPath } from "@smithy/smithy-client";
import type { SerdeContext } from "@smithy/types";

/**
 * @internal
 * used in code-generated serde.
 */
export function requestBuilder(input: any, context: SerdeContext): RequestBuilder {
  return new RequestBuilder(input, context);
}

/**
 * @internal
 */
export class RequestBuilder {
  private query: Record<string, string> = {};
  private method = "";
  private headers: Record<string, string> = {};
  private path = "";
  private body: any = null;
  private hostname = "";

  private resolvePathStack: Array<(path: string) => void> = [];

  public constructor(private input: any, private context: SerdeContext) {}

  public async build() {
    const { hostname, protocol = "https", port, path: basePath } = await this.context.endpoint();
    this.path = basePath;
    for (const resolvePath of this.resolvePathStack) {
      resolvePath(this.path);
    }
    return new HttpRequest({
      protocol,
      hostname: this.hostname || hostname,
      port,
      method: this.method,
      path: this.path,
      query: this.query,
      body: this.body,
      headers: this.headers,
    });
  }

  /**
   * Brevity setter for "hostname".
   */
  public hn(hostname: string) {
    this.hostname = hostname;
    return this;
  }

  /**
   * Brevity initial builder for "basepath".
   */
  public bp(uriLabel: string) {
    this.resolvePathStack.push((basePath: string) => {
      this.path = `${basePath?.endsWith("/") ? basePath.slice(0, -1) : basePath || ""}` + uriLabel;
    });
    return this;
  }

  /**
   * Brevity incremental builder for "path".
   */
  public p(memberName: string, labelValueProvider: () => string | undefined, uriLabel: string, isGreedyLabel: boolean) {
    this.resolvePathStack.push((path: string) => {
      this.path = resolvedPath(path, this.input, memberName, labelValueProvider, uriLabel, isGreedyLabel);
    });
    return this;
  }

  /**
   * Brevity setter for "headers".
   */
  public h(headers: Record<string, string>) {
    this.headers = headers;
    return this;
  }

  /**
   * Brevity setter for "query".
   */
  public q(query: Record<string, string>) {
    this.query = query;
    return this;
  }

  /**
   * Brevity setter for "body".
   */
  public b(body: any) {
    this.body = body;
    return this;
  }

  /**
   * Brevity setter for "method".
   */
  public m(method: string) {
    this.method = method;
    return this;
  }
}
