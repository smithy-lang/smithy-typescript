import { ExpectationNotMetException } from "../../exceptions/exceptions";
import { Nodes } from "../../node/Nodes";
import type { JsonObject } from "../../node/Nodes";
import { ShapeId } from "../../shapes/ShapeId";
import { TreeMap } from "../../utils/TreeMap";
import { Trait } from "../Trait";

type AppliesTo = "client" | "server";

/**
 * @internal
 */
export abstract class HttpMessageTestCase {
  private readonly _id: string;
  private readonly _documentation: string | undefined;
  private readonly _protocol: ShapeId;
  private readonly _authScheme: ShapeId | undefined;
  private readonly _body: string | undefined;
  private readonly _bodyMediaType: string | undefined;
  private readonly _params: JsonObject;
  private readonly _vendorParamsShape: ShapeId | undefined;
  private readonly _vendorParams: JsonObject;
  private readonly _headers: Map<string, string>;
  private readonly _forbidHeaders: string[];
  private readonly _requireHeaders: string[];
  private readonly _tags: string[];
  private readonly _appliesTo: AppliesTo | undefined;

  protected constructor(object: JsonObject) {
    this._id = Nodes.expectString(Nodes.expectMember(object, "id"));
    this._protocol = Nodes.expectShapeId(Nodes.expectMember(object, "protocol"));
    this._documentation = Nodes.getString(object, "documentation");
    const authScheme = Nodes.getString(object, "authScheme");
    this._authScheme = authScheme === undefined ? undefined : ShapeId.from(authScheme);
    this._body = Nodes.getString(object, "body");
    this._bodyMediaType = Nodes.getString(object, "bodyMediaType");
    this._params = Nodes.getObject(object, "params") ?? {};
    const vendorParamsShape = Nodes.getString(object, "vendorParamsShape");
    this._vendorParamsShape = vendorParamsShape === undefined ? undefined : ShapeId.from(vendorParamsShape);
    this._vendorParams = Nodes.getObject(object, "vendorParams") ?? {};
    const headers = Nodes.getObject(object, "headers");
    this._headers = new TreeMap(null, headers === undefined ? undefined : Nodes.expectStringMap(headers));
    this._forbidHeaders = Nodes.getStringArray(object, "forbidHeaders") ?? [];
    this._requireHeaders = Nodes.getStringArray(object, "requireHeaders") ?? [];
    this._tags = Nodes.getStringArray(object, "tags") ?? [];
    this._appliesTo = HttpMessageTestCase._appliesToFrom(Nodes.getString(object, "appliesTo"));
  }

  public getId(): string {
    return this._id;
  }

  public getDocumentation(): string | undefined {
    return this._documentation;
  }

  public getProtocol(): ShapeId {
    return this._protocol;
  }

  public getBody(): string | undefined {
    return this._body;
  }

  public getBodyMediaType(): string | undefined {
    return this._bodyMediaType;
  }

  public getParams(): JsonObject {
    return this._params;
  }

  public getHeaders(): ReadonlyMap<string, string> {
    return this._headers;
  }

  public getForbidHeaders(): string[] {
    return this._forbidHeaders;
  }

  public getRequireHeaders(): string[] {
    return this._requireHeaders;
  }

  public getTags(): string[] {
    return this._tags;
  }

  public getAppliesTo(): AppliesTo | undefined {
    return this._appliesTo;
  }

  private static _appliesToFrom(value: string | undefined): AppliesTo | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value !== "client" && value !== "server") {
      throw new ExpectationNotMetException("Expected string value of one of client, server, but found " + value);
    }
    return value;
  }
}

/**
 * @internal
 */
export class HttpRequestTestCase extends HttpMessageTestCase {
  private readonly _method: string;
  private readonly _uri: string;
  private readonly _host: string | undefined;
  private readonly _resolvedHost: string | undefined;
  private readonly _queryParams: string[];
  private readonly _forbidQueryParams: string[];
  private readonly _requireQueryParams: string[];

  constructor(object: JsonObject) {
    super(object);
    this._method = Nodes.expectString(Nodes.expectMember(object, "method"));
    this._uri = Nodes.expectString(Nodes.expectMember(object, "uri"));
    this._host = Nodes.getString(object, "host");
    this._resolvedHost = Nodes.getString(object, "resolvedHost");
    this._queryParams = Nodes.getStringArray(object, "queryParams") ?? [];
    this._forbidQueryParams = Nodes.getStringArray(object, "forbidQueryParams") ?? [];
    this._requireQueryParams = Nodes.getStringArray(object, "requireQueryParams") ?? [];
  }

  public static fromNode(node: unknown): HttpRequestTestCase {
    return new HttpRequestTestCase(Nodes.expectObject(node));
  }

  public getMethod(): string {
    return this._method;
  }

  public getUri(): string {
    return this._uri;
  }

  public getHost(): string | undefined {
    return this._host;
  }

  public getResolvedHost(): string | undefined {
    return this._resolvedHost;
  }

  public getQueryParams(): string[] {
    return this._queryParams;
  }

  public getForbidQueryParams(): string[] {
    return this._forbidQueryParams;
  }

  public getRequireQueryParams(): string[] {
    return this._requireQueryParams;
  }
}

/**
 * @internal
 */
export class HttpResponseTestCase extends HttpMessageTestCase {
  private readonly _code: number;

  constructor(object: JsonObject) {
    super(object);
    this._code = Math.trunc(Nodes.expectNumber(Nodes.expectMember(object, "code")));
  }

  public static fromNode(node: unknown): HttpResponseTestCase {
    return new HttpResponseTestCase(Nodes.expectObject(node));
  }

  public getCode(): number {
    return this._code;
  }
}

class HttpMalformedRequestDefinition {
  private readonly _body: string | undefined;
  private readonly _bodyMediaType: string | undefined;
  private readonly _headers: Map<string, string>;
  private readonly _host: string | undefined;
  private readonly _method: string;
  private readonly _queryParams: string[];
  private readonly _uri: string | undefined;

  constructor(
    body: string | undefined,
    bodyMediaType: string | undefined,
    headers: Map<string, string>,
    host: string | undefined,
    method: string,
    queryParams: string[],
    uri: string | undefined
  ) {
    this._body = body;
    this._bodyMediaType = bodyMediaType;
    this._headers = headers;
    this._host = host;
    this._method = method;
    this._queryParams = queryParams;
    this._uri = uri;
  }

  public static fromNode(node: unknown): HttpMalformedRequestDefinition {
    const object = Nodes.expectObject(node);
    const headers = Nodes.getObject(object, "headers");
    return new HttpMalformedRequestDefinition(
      Nodes.getString(object, "body"),
      Nodes.getString(object, "bodyMediaType"),
      headers === undefined ? new Map<string, string>() : Nodes.expectStringMap(headers),
      Nodes.getString(object, "host"),
      Nodes.expectString(Nodes.expectMember(object, "method")),
      Nodes.getStringArray(object, "queryParams") ?? [],
      Nodes.getString(object, "uri")
    );
  }

  public withInterpolation(format: (text: string) => string): HttpMalformedRequestDefinition {
    const headers = new Map<string, string>();
    for (const [key, value] of this._headers) {
      headers.set(format(key), format(value));
    }
    return new HttpMalformedRequestDefinition(
      this._body === undefined ? undefined : format(this._body),
      this._bodyMediaType,
      headers,
      this._host,
      this._method,
      this._queryParams.map(format),
      this._uri === undefined ? undefined : format(this._uri)
    );
  }
}

class HttpMalformedResponseBodyDefinition {
  private readonly _contents: string | undefined;
  private readonly _mediaType: string;
  private readonly _messageRegex: string | undefined;

  constructor(contents: string | undefined, mediaType: string, messageRegex: string | undefined) {
    this._contents = contents;
    this._mediaType = mediaType;
    this._messageRegex = messageRegex;
  }

  public static fromNode(node: unknown): HttpMalformedResponseBodyDefinition {
    const object = Nodes.expectObject(node);
    const assertion = Nodes.expectObject(Nodes.expectMember(object, "assertion"));
    return new HttpMalformedResponseBodyDefinition(
      Nodes.getString(assertion, "contents"),
      Nodes.expectString(Nodes.expectMember(object, "mediaType")),
      Nodes.getString(assertion, "messageRegex")
    );
  }

  public withInterpolation(format: (text: string) => string): HttpMalformedResponseBodyDefinition {
    return new HttpMalformedResponseBodyDefinition(
      this._contents === undefined ? undefined : format(this._contents),
      format(this._mediaType),
      this._messageRegex === undefined ? undefined : format(this._messageRegex)
    );
  }
}

class HttpMalformedResponseDefinition {
  private readonly _body: HttpMalformedResponseBodyDefinition | undefined;
  private readonly _code: number;
  private readonly _headers: Map<string, string>;

  constructor(body: HttpMalformedResponseBodyDefinition | undefined, code: number, headers: Map<string, string>) {
    this._body = body;
    this._code = code;
    this._headers = headers;
  }

  public static fromNode(node: unknown): HttpMalformedResponseDefinition {
    const object = Nodes.expectObject(node);
    const body = Nodes.getObject(object, "body");
    const headers = Nodes.getObject(object, "headers");
    return new HttpMalformedResponseDefinition(
      body === undefined ? undefined : HttpMalformedResponseBodyDefinition.fromNode(body),
      Math.trunc(Nodes.getNumber(object, "code") ?? 0),
      headers === undefined ? new Map<string, string>() : Nodes.expectStringMap(headers)
    );
  }

  public withInterpolation(format: (text: string) => string): HttpMalformedResponseDefinition {
    const headers = new Map<string, string>();
    for (const [key, value] of this._headers) {
      headers.set(format(key), format(value));
    }
    return new HttpMalformedResponseDefinition(
      this._body === undefined ? undefined : this._body.withInterpolation(format),
      this._code,
      headers
    );
  }
}

class HttpMalformedRequestTestCase {
  private readonly _documentation: string | undefined;
  private readonly _id: string;
  private readonly _protocol: ShapeId;
  private readonly _request: HttpMalformedRequestDefinition;
  private readonly _response: HttpMalformedResponseDefinition;
  private readonly _tags: string[];

  constructor(
    documentation: string | undefined,
    id: string,
    protocol: ShapeId,
    request: HttpMalformedRequestDefinition,
    response: HttpMalformedResponseDefinition,
    tags: string[]
  ) {
    this._documentation = documentation;
    this._id = id;
    this._protocol = protocol;
    this._request = request;
    this._response = response;
    this._tags = tags;
  }

  public getDocumentation(): string | undefined {
    return this._documentation;
  }

  public getId(): string {
    return this._id;
  }
}

/**
 * @internal
 */
export class HttpRequestTestsTrait extends Trait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.test#httpRequestTests");

  private readonly _testCases: HttpRequestTestCase[];

  constructor(value: unknown) {
    super(HttpRequestTestsTrait.ID, value);
    this._testCases = Nodes.expectArray(value).map((entry) => HttpRequestTestCase.fromNode(entry));
  }

  public getTestCases(): HttpRequestTestCase[] {
    return this._testCases;
  }

  public getTestCasesFor(appliesTo: AppliesTo): HttpRequestTestCase[] {
    return this._testCases.filter((test) => {
      const value = test.getAppliesTo();
      return value === undefined || value === appliesTo;
    });
  }
}

/**
 * @internal
 */
export class HttpResponseTestsTrait extends Trait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.test#httpResponseTests");

  private readonly _testCases: HttpResponseTestCase[];

  constructor(value: unknown) {
    super(HttpResponseTestsTrait.ID, value);
    this._testCases = Nodes.expectArray(value).map((entry) => HttpResponseTestCase.fromNode(entry));
  }

  public getTestCasesFor(appliesTo: AppliesTo): HttpResponseTestCase[] {
    return this._testCases.filter((test) => {
      const value = test.getAppliesTo();
      return value === undefined || value === appliesTo;
    });
  }
}

export class HttpMalformedRequestTestsTrait extends Trait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.test#httpMalformedRequestTests");

  private readonly _testCases: HttpMalformedRequestTestCase[];

  constructor(value: unknown) {
    super(HttpMalformedRequestTestsTrait.ID, value);
    const cases: HttpMalformedRequestTestCase[] = [];
    for (const entry of Nodes.expectArray(value)) {
      HttpMalformedRequestTestsTrait._expand(Nodes.expectObject(entry), cases);
    }
    this._testCases = cases;
  }

  private static _expand(object: JsonObject, output: HttpMalformedRequestTestCase[]): void {
    const documentation = Nodes.getString(object, "documentation");
    const id = Nodes.expectString(Nodes.expectMember(object, "id"));
    const protocol = Nodes.expectShapeId(Nodes.expectMember(object, "protocol"));
    const request = HttpMalformedRequestDefinition.fromNode(Nodes.expectMember(object, "request"));
    const response = HttpMalformedResponseDefinition.fromNode(Nodes.expectMember(object, "response"));
    const tags = Nodes.getStringArray(object, "tags") ?? [];
    const parametersNode = Nodes.getObject(object, "testParameters");
    const parameters = new Map<string, string[]>();
    if (parametersNode !== undefined) {
      for (const key of Object.keys(parametersNode)) {
        parameters.set(key, Nodes.expectStringArray(parametersNode[key]));
      }
    }
    if (parameters.size === 0) {
      output.push(new HttpMalformedRequestTestCase(documentation, id, protocol, request, response, tags));
      return;
    }
    const count = (parameters.values().next().value as string[]).length;
    for (let i = 0; i < count; i++) {
      const context = new Map<string, string>();
      for (const [key, values] of parameters) {
        context.set(key, values[i]);
      }
      const format = (text: string): string => HttpMalformedRequestTestsTrait._interpolate(text, context);
      output.push(
        new HttpMalformedRequestTestCase(
          documentation === undefined ? undefined : format(documentation),
          id + "_case" + i,
          protocol,
          request.withInterpolation(format),
          response.withInterpolation(format),
          tags.map(format)
        )
      );
    }
  }

  /**
   * Substitutes `$name:L` and `${name:L}` placeholders and unescapes `$$`.
   */
  private static _interpolate(text: string, context: ReadonlyMap<string, string>): string {
    return text.replace(
      /\$\$|\$\{([A-Za-z_][A-Za-z0-9_.#$-]*)(?::[A-Za-z])?\}|\$([A-Za-z_][A-Za-z0-9_.#-]*)(?::[A-Za-z])?/g,
      (match, braced, bare) => {
        if (match === "$$") {
          return "$";
        }
        const key = (braced ?? bare) as string;
        const value = context.get(key);
        if (value === undefined) {
          throw new ExpectationNotMetException("Missing test parameter `" + key + "`");
        }
        return value;
      }
    );
  }
}
