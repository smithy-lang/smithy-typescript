import type { Symbol, SymbolProvider } from "../codegen-core";
import { CodegenException } from "../codegen-core";
import {
  CollectionShape,
  ErrorTrait,
  HttpBindingIndex,
  HttpLabelTrait,
  HttpPrefixHeadersTrait,
  HttpRequestTestsTrait,
  HttpResponseTestsTrait,
  IdempotencyTokenTrait,
  OperationIndex,
  StreamingTrait,
  TopDownIndex,
  TreeSet,
} from "../model";
import type {
  Model,
  OperationShape,
  ServiceShape,
  Shape,
  ShapeId,
  StructureShape,
  HttpMessageTestCase,
  HttpRequestTestCase,
  HttpResponseTestCase,
} from "../model";
import { javaNumberToString } from "../model/node/JavaNumbers";
import { JsonParser } from "../model/node/JsonParser";
import type { HttpBinding } from "../model/knowledge/HttpBinding";
import type { GenerationContext, ProtocolGenerator } from "./integration/ProtocolGenerator";
import { ServiceClosure } from "./knowledge/ServiceClosure";
import { PROTOCOL_TEST_STUBS } from "./protocols/ProtocolTestStubs";
import { SmithyCoreSubmodules } from "./SmithyCoreSubmodules";
import { TypeScriptDependency } from "./TypeScriptDependency";
import type { TypeScriptSettings } from "./TypeScriptSettings";
import type { TypeScriptWriter } from "./TypeScriptWriter";
import { JavaHashMap, PropertyAccessor } from "./util";

const TEST_CASE_FILE_TEMPLATE = "test/functional/%s.spec.ts";
const SERDE_BENCHMARK_TAG = "serde-benchmark";
const WARMUP_ITERATIONS = "10_000";
const BENCHMARK_ITERATIONS = "10_000";
const BENCHMARK_TIMEOUT = "60_000";

type TestFilter = (
  service: ServiceShape,
  operation: OperationShape,
  testCase: HttpMessageTestCase,
  settings: TypeScriptSettings
) => boolean;

type NodeVisitorKind = "input" | "output";

/**
 * Generates the functional protocol test file for the service protocol.
 */
export class HttpProtocolTestGenerator {
  private readonly _settings: TypeScriptSettings;
  private readonly _model: Model;
  private readonly _protocol: ShapeId;
  private readonly _service: ServiceShape;
  private readonly _symbolProvider: SymbolProvider;
  private readonly _serviceSymbol: Symbol;
  private readonly _additionalStubs = new TreeSet<string>();
  private readonly _testFilter: TestFilter;
  private readonly _context: GenerationContext;
  private readonly _closure: ServiceClosure;
  private _writer: TypeScriptWriter | undefined;

  public constructor(context: GenerationContext, protocolGenerator: ProtocolGenerator, testFilter: TestFilter) {
    this._settings = context.getSettings();
    this._model = context.getModel();
    this._protocol = protocolGenerator.getProtocol();
    this._service = this._settings.getService(this._model);
    this._symbolProvider = context.getSymbolProvider();
    this._serviceSymbol = this._symbolProvider
      .toSymbol(this._service)
      .toBuilder()
      .putProperty("typeOnly", false)
      .build();
    this._testFilter = testFilter;
    this._context = context;
    this._closure = ServiceClosure.of(this._model, this._service);
  }

  public run(): void {
    const operationIndex = OperationIndex.of(this._model);
    const topDownIndex = TopDownIndex.of(this._model);
    const hasSerdeBenchmarks = [...this._closure.getOperationShapes()].some((operation) => {
      if (operation.getTags().includes("server-only")) {
        return false;
      }
      const trait = operation.getTrait(HttpRequestTestsTrait);
      return (
        trait !== undefined && trait.getTestCases().some((testCase) => testCase.getTags().includes(SERDE_BENCHMARK_TAG))
      );
    });

    if (hasSerdeBenchmarks) {
      const writer = this._initializeWriterIfNeeded();
      writer.write(
        `const WARMUP_ITERATIONS = $L;
const BENCHMARK_ITERATIONS = $L;
const BENCHMARK_TIMEOUT = $L;

/**
 * Test name to benchmark data.
 */
const benchmarks = {} as Record<
  string,
  {
    n: string;
    p50: string;
    p90: string;
    p95: string;
    p99: string;
    mean: string;
    stdDev: string;
  }
>;

function logBenchmarks() {
  console.table(benchmarks);
}

function logBenchmark(name: string, timings: number[]) {
  const n = timings.length;
  const p50 = timings[(n - 1) * 0.50 | 0] | 0;
  const p90 = timings[(n - 1) * 0.90 | 0] | 0;
  const p95 = timings[(n - 1) * 0.95 | 0] | 0;
  const p99 = timings[(n - 1) * 0.99 | 0] | 0;
  const mean = timings.reduce((a, b) => a + b, 0) / timings.length | 0;
  const stdDev = Math.sqrt(timings.reduce((a, b) => a + (b - mean) ** 2, 0) / timings.length) | 0;

  const fmt = (n: number) => String(n.toLocaleString()).padStart(10, ' ');
  benchmarks[name] = {
    n: fmt(n),
    p50: fmt(p50),
    p90: fmt(p90),
    p95: fmt(p95),
    p99: fmt(p99),
    mean: fmt(mean),
    stdDev: fmt(stdDev),
  };
  return {
    name, p95, n, timings
  };
}

function vizBenchmark({ name, p95, n, timings }: { name: string, p95: number, n: number, timings: number[] }) {
  const decile = p95 / 10;
  let d = 1;
  const centIndex = (n / 100) | 0;
  let line = "";

  console.info(name);
  console.info("=".repeat(31), "Distribution Viz", "=".repeat(31));
  for (let i = 0; i < n; i += centIndex) {
    const t = timings[i];
    if (t < decile * d) {
      line += ".";
    } else {
      line += \` <= $\${(decile * d) | 0}\`;
      console.info(line);
      d += 1;
      line = ".";
    }
  }
  console.info(line + \` > $\${(decile * (d - 1)) | 0}\`);
  console.info("=".repeat(80));
}
`,
        WARMUP_ITERATIONS,
        BENCHMARK_ITERATIONS,
        BENCHMARK_TIMEOUT
      );
    }

    for (const operation of topDownIndex.getContainedOperations(this._service)) {
      if (this._settings.generateClient()) {
        this._generateClientOperationTests(operation, operationIndex);
      }
      if (this._settings.generateServerSdk()) {
        throw new Error("Server protocol tests are not ported");
      }
    }

    for (const additionalStub of this._additionalStubs) {
      this._writer!.write(PROTOCOL_TEST_STUBS[additionalStub]);
    }

    if (hasSerdeBenchmarks) {
      const writer = this._writer!;
      writer.addImport("afterAll", null, TypeScriptDependency.VITEST);
      writer.write(`afterAll(() => {
  logBenchmarks();
});
`);
    }
  }

  private _generateClientOperationTests(operation: OperationShape, operationIndex: OperationIndex): void {
    if (operation.getTags().includes("server-only")) {
      return;
    }
    const requestTests = operation.getTrait(HttpRequestTestsTrait);
    if (requestTests !== undefined) {
      for (const testCase of requestTests.getTestCasesFor("client")) {
        this._onlyIfProtocolMatches(testCase, () => {
          if (testCase.getTags().includes(SERDE_BENCHMARK_TAG)) {
            this._generateClientRequestBenchmark(operation, testCase);
          } else {
            this._generateClientRequestTest(operation, testCase);
          }
        });
      }
    }
    const responseTests = operation.getTrait(HttpResponseTestsTrait);
    if (responseTests !== undefined) {
      for (const testCase of responseTests.getTestCasesFor("client")) {
        this._onlyIfProtocolMatches(testCase, () => {
          if (testCase.getTags().includes(SERDE_BENCHMARK_TAG)) {
            this._generateResponseBenchmark(operation, testCase);
          } else {
            this._generateResponseTest(operation, testCase);
          }
        });
      }
    }
    for (const error of operationIndex.getErrors(operation, this._service)) {
      if (error.getTags().includes("server-only")) {
        continue;
      }
      const errorTests = error.getTrait(HttpResponseTestsTrait);
      if (errorTests === undefined) {
        continue;
      }
      for (const testCase of errorTests.getTestCasesFor("client")) {
        this._onlyIfProtocolMatches(testCase, () => this._generateErrorResponseTest(operation, error, testCase));
      }
    }
  }

  private _onlyIfProtocolMatches(testCase: HttpMessageTestCase, runnable: () => void): void {
    if (testCase.getProtocol().equals(this._protocol)) {
      this._initializeWriterIfNeeded();
      runnable();
    }
  }

  private _initializeWriterIfNeeded(): TypeScriptWriter {
    if (this._writer === undefined) {
      this._context.getWriterDelegator()!.useFileWriter(this._createTestCaseFilename(), (writer) => {
        this._writer = writer;
      });
      const writer = this._writer!;
      writer.addDependency(TypeScriptDependency.SMITHY_TYPES);
      writer.addDependency(TypeScriptDependency.SMITHY_CORE);
      writer.write(PROTOCOL_TEST_STUBS["protocol-test-stub.ts"]);
      writer.addImport("test", "it", TypeScriptDependency.VITEST);
      writer.addImport("expect", null, TypeScriptDependency.VITEST);
    }
    return this._writer!;
  }

  private _createTestCaseFilename(): string {
    const baseName = this._protocol.getName().toLowerCase().replace(/-/g, "_").replace(/\./g, "_");
    return TEST_CASE_FILE_TEMPLATE.replace("%s", baseName);
  }

  private _generateClientRequestTest(operation: OperationShape, testCase: HttpRequestTestCase): void {
    const writer = this._writer!;
    const operationSymbol = this._symbolProvider.toSymbol(operation);
    const testName = testCase.getId() + ":Request";
    const documentation = testCase.getDocumentation();
    if (documentation !== undefined) {
      writer.writeDocs(documentation);
    }
    this._openTestBlock(operation, testCase, testName, () => {
      writer.openBlock("const client = new $T({", "});\n", this._serviceSymbol, () => {
        writer.write("...clientParams,");
        const host = testCase.getHost();
        if (host !== undefined) {
          writer.write('endpoint: "https://$L",', host);
        }
        writer.write("requestHandler: new RequestSerializationTestHandler(),");
      });
      this._writeCommandConstruction(operation, operationSymbol, testCase.getParams());
      writer
        .write(
          `try {
  await client.send(command);
  fail("Expected an EXPECTED_REQUEST_SERIALIZATION_ERROR to be thrown");
  return;
} catch (err) {
  if (!(err instanceof EXPECTED_REQUEST_SERIALIZATION_ERROR)) {
    fail(err);
    return;
  }
  const r = err.request;`
        )
        .indent()
        .call(() => this._writeHttpRequestAssertions(testCase))
        .dedent()
        .write("}");
    });
  }

  private _writeCommandConstruction(operation: OperationShape, operationSymbol: Symbol, params: object): void {
    const writer = this._writer!;
    const inputId = operation.getInput();
    if (inputId !== undefined) {
      const inputShape = this._model.expectShape(inputId) as StructureShape;
      writer
        .write("const command = new $T(", operationSymbol)
        .indent()
        .call(() => new NodeVisitor(this._model, writer, inputShape, "input", false).visit(params))
        .dedent()
        .write(");");
    } else {
      writer.write("const command = new $T({});", operationSymbol);
    }
  }

  private _writeHttpRequestAssertions(testCase: HttpRequestTestCase): void {
    const writer = this._writer!;
    writer.write("expect(r.method).toBe($S);", testCase.getMethod());
    writer.write("expect(r.path).toBe($S);", testCase.getUri());
    this._writeHttpHeaderAssertions(testCase);
    this._writeHttpQueryAssertions(testCase);
    this._writeHttpHostAssertion(testCase);
    const body = testCase.getBody();
    if (body !== undefined) {
      this._writeHttpBodyAssertions(body, testCase.getBodyMediaType() ?? "UNKNOWN", true);
    }
  }

  private _writeHttpQueryAssertions(testCase: HttpRequestTestCase): void {
    const writer = this._writer!;
    for (const requiredQueryParam of testCase.getRequireQueryParams()) {
      writer.write(
        `expect(
  r.query[$1S],
  \`Query key $1S should have been defined in $\${JSON.stringify(r.query)}\`
).toBeDefined();`,
        requiredQueryParam
      );
    }
    writer.write("");
    for (const forbidQueryParam of testCase.getForbidQueryParams()) {
      writer.write(
        `expect(
  r.query[$1S],
  \`Query key $1S should have been undefined in $\${JSON.stringify(r.query)}\`
).toBeUndefined();`,
        forbidQueryParam
      );
    }
    writer.write("");
    const explicitQueryValues = testCase.getQueryParams();
    if (explicitQueryValues.length > 0) {
      writer.addDependency(TypeScriptDependency.SMITHY_CORE);
      writer.addImportSubmodule(
        "buildQueryString",
        null,
        TypeScriptDependency.SMITHY_CORE,
        SmithyCoreSubmodules.PROTOCOLS
      );
      writer.write("const queryString = buildQueryString(r.query);");
      for (const explicitQueryValue of explicitQueryValues) {
        writer.write("expect(queryString).toContain($S);", explicitQueryValue);
      }
    }
    writer.write("");
  }

  private _writeHttpHeaderAssertions(testCase: HttpMessageTestCase): void {
    const writer = this._writer!;
    for (const requiredHeader of testCase.getRequireHeaders()) {
      writer.write(
        `expect(
  r.headers[$1S],
  \`Header key $1S should have been defined in $\${JSON.stringify(r.headers)}\`
).toBeDefined();`,
        requiredHeader.toLowerCase()
      );
    }
    writer.write("");
    for (const forbidHeader of testCase.getForbidHeaders()) {
      writer.write(
        `expect(
  r.headers[$1S],
  \`Header key $1S should have been undefined in $\${JSON.stringify(r.headers)}\`
).toBeUndefined();`,
        forbidHeader.toLowerCase()
      );
    }
    writer.write("");
    for (const [header, value] of testCase.getHeaders()) {
      writer.write("expect(r.headers[$S]).toBe($S);", header.toLowerCase(), value);
    }
    writer.write("");
  }

  private _writeHttpHostAssertion(testCase: HttpRequestTestCase): void {
    const resolvedHost = testCase.getResolvedHost();
    if (resolvedHost !== undefined) {
      this._writer!.write('expect(r.headers["host"]).toBe($S);', resolvedHost);
      this._writer!.write("");
    }
  }

  private _writeHttpBodyAssertions(body: string, mediaType: string, isClientTest: boolean): void {
    const writer = this._writer!;
    if (body.length === 0) {
      writer.write("expect(!r.body || r.body === `{}`).toBeTruthy();");
      return;
    }
    writer.write("expect(r.body, `Body was undefined.`).toBeDefined();");
    const comparatorInvoke = this._registerBodyComparatorStub(mediaType);
    if (mediaType !== "application/cbor") {
      if (isClientTest) {
        writer.write("const utf8Encoder = client.config.utf8Encoder;");
      } else {
        writer.addImportSubmodule(
          "toUtf8",
          "__utf8Encoder",
          TypeScriptDependency.SMITHY_CORE,
          SmithyCoreSubmodules.SERDE
        );
        writer.write("const utf8Encoder = __utf8Encoder;");
      }
    }
    writer.write("const bodyString = `$L`;", body.split('"').join('\\"'));
    writer.write("const unequalParts: any = $L;", comparatorInvoke);
    writer.write("expect(unequalParts).toBeUndefined();");
  }

  private _registerBodyComparatorStub(mediaType: string): string {
    const writer = this._writer!;
    switch (mediaType) {
      case "application/x-www-form-urlencoded":
        this._additionalStubs.add("protocol-test-form-urlencoded-stub.ts");
        return "compareEquivalentFormUrlencodedBodies(bodyString, r.body.toString())";
      case "application/json":
        this._additionalStubs.add("protocol-test-json-stub.ts");
        return "compareEquivalentJsonBodies(bodyString, r.body.toString())";
      case "application/xml":
        writer.addDependency(TypeScriptDependency.XML_PARSER);
        writer.addDependency(TypeScriptDependency.HTML_ENTITIES);
        writer.addImport("XMLParser", null, TypeScriptDependency.XML_PARSER);
        writer.addImport("decodeHTML", null, TypeScriptDependency.HTML_ENTITIES);
        this._additionalStubs.add("protocol-test-xml-stub.ts");
        return "compareEquivalentXmlBodies(bodyString, r.body.toString())";
      case "application/octet-stream":
        writer.addTypeImport("Encoder", "__Encoder", TypeScriptDependency.SMITHY_TYPES);
        this._additionalStubs.add("protocol-test-octet-stream-stub.ts");
        return "compareEquivalentOctetStreamBodies(utf8Encoder, bodyString, r.body)";
      case "text/plain":
        this._additionalStubs.add("protocol-test-text-stub.ts");
        return "compareEquivalentTextBodies(bodyString, r.body)";
      case "application/cbor":
        writer.addImportSubmodule("cbor", null, TypeScriptDependency.SMITHY_CORE, SmithyCoreSubmodules.CBOR);
        this._additionalStubs.add("protocol-test-cbor-stub.ts");
        return "compareEquivalentCborBodies(bodyString, r.body)";
      default:
        writer.addTypeImport("Encoder", "__Encoder", TypeScriptDependency.SMITHY_TYPES);
        this._additionalStubs.add("protocol-test-unknown-type-stub.ts");
        return "compareEquivalentUnknownTypeBodies(utf8Encoder, bodyString, r.body)";
    }
  }

  private _generateResponseTest(operation: OperationShape, testCase: HttpResponseTestCase): void {
    const writer = this._writer!;
    const documentation = testCase.getDocumentation();
    if (documentation !== undefined) {
      writer.writeDocs(documentation);
    }
    const testName = testCase.getId() + ":Response";
    this._openTestBlock(operation, testCase, testName, () => {
      this._writeResponseTestSetup(operation, testCase, true);
      writer.write("let r: any;");
      writer.write(
        `try {
  r = await client.send(command);
} catch (err) {
  fail("Expected a valid response to be returned, got " + err);
  return;
}`
      );
      this._writeResponseAssertions(operation, testCase);
    });
  }

  private _generateClientRequestBenchmark(operation: OperationShape, testCase: HttpRequestTestCase): void {
    const writer = this._writer!;
    const operationSymbol = this._symbolProvider.toSymbol(operation);
    const testName = testCase.getId() + ":SerdeBenchmark:Request";
    const documentation = testCase.getDocumentation();
    if (documentation !== undefined) {
      writer.writeDocs(documentation);
    }
    this._openTestBlock(operation, testCase, testName, () => {
      writer.openBlock("const client = new $T({", "});\n", this._serviceSymbol, () => {
        writer.write("...clientParams,");
        const host = testCase.getHost();
        if (host !== undefined) {
          writer.write('endpoint: "https://$L",', host);
        }
      });
      this._writeCommandConstruction(operation, operationSymbol, testCase.getParams());
      writer.write(
        `if (!command.schema) {
  return;
}
const protocol = client.config.protocol;
const [, namespace, _name, traits, input, output] = command.schema as any;
const $$schema = {namespace, name: _name, traits, input, output} as any;
const $$input = command.input as any;
const $$context = client.config as any;

const name = $S;
const timings = [] as number[];
const testStart = performance.now();
const numeric = (a: number, b: number) => a - b;
let i = 0;

while (++i) {
  const preSerialize = performance.now();
  await (protocol.serializeRequest as any)($$schema, $$input, $$context);
  const postSerialize = performance.now();
  if (i >= WARMUP_ITERATIONS) {
    // allow warmup
    timings.push(postSerialize * 1_000_000 - preSerialize * 1_000_000);
  }

  if (timings.length >= BENCHMARK_ITERATIONS) {
    timings.length = BENCHMARK_ITERATIONS;
    break;
  } else if (testStart + 30_000 < preSerialize) {
    break;
  }
}

timings.sort(numeric);

vizBenchmark(logBenchmark(name, timings));
`,
        testName
      );
    });
  }

  private _generateResponseBenchmark(operation: OperationShape, testCase: HttpResponseTestCase): void {
    const writer = this._writer!;
    const operationSymbol = this._symbolProvider.toSymbol(operation);
    const documentation = testCase.getDocumentation();
    if (documentation !== undefined) {
      writer.writeDocs(documentation);
    }
    const testName = testCase.getId() + ":SerdeBenchmark:Response";
    this._openTestBlock(operation, testCase, testName, () => {
      const httpLabelMembers = this._httpLabelMembers(operation);
      writer.openCollapsibleBlock("const params: any = {", "};", httpLabelMembers.length > 0, () => {
        for (const member of httpLabelMembers) {
          writer.write('$L: "placeholder",', PropertyAccessor.inlineKey(member));
        }
      });
      writer.write("const command = new $T(params);\n", operationSymbol);
      const headers = lowercaseHeaders(testCase.getHeaders());
      const body = testCase.getBody();
      writer.openBlock("const client = new $T({", "});\n", this._serviceSymbol, () => {
        writer.write("...clientParams,");
      });
      writer.write(
        `if (!command.schema) {
  return;
}
const [, namespace, _name, traits, input, output] = command.schema as any;
const $$schema = {namespace, name: _name, traits, input, output} as any;
const $$context = client.config as any;
const protocol = client.config.protocol as any;
`
      );
      if (body !== undefined) {
        writer.write("const bodyBuffer = Buffer.from(`$L`);", body);
      }
      writer.write(
        `const name = $S;
const timings = [] as number[];
const numeric = (a: number, b: number) => a - b;
let i = 0;

const benchmarkStart = performance.now();
`,
        testName
      );
      writer.openBlock("while (++i) {", "}", () => {
        writer.openBlock("const $$httpResponse = new HttpResponse({", "});", () => {
          writer.write("statusCode: $L,", testCase.getCode());
          if (headers.size === 0) {
            writer.write("headers: {},");
          } else {
            writer.openBlock("headers: {", "},", () => {
              for (const [key, value] of headers.entries()) {
                writer.write("$S: $S,", key, value);
              }
            });
          }
          if (body !== undefined) {
            writer.write("body: Readable.from(bodyBuffer),");
          } else {
            writer.write("body: undefined,");
          }
        });
        writer.write(
          `const preDeserialize = performance.now();
await (protocol.deserializeResponse as any)($$schema, $$context, $$httpResponse);
const postDeserialize = performance.now();
if (i >= WARMUP_ITERATIONS) {
  timings.push(postDeserialize * 1_000_000 - preDeserialize * 1_000_000);
}

if (timings.length >= BENCHMARK_ITERATIONS) {
  timings.length = BENCHMARK_ITERATIONS;
  break;
} else if (benchmarkStart + 30_000 < performance.now()) {
  break;
}`
        );
      });
      writer.write(
        `
timings.sort(numeric);
timings.length = Math.min(timings.length, BENCHMARK_ITERATIONS);

vizBenchmark(logBenchmark(name, timings));
`
      );
    });
  }

  private _generateErrorResponseTest(
    operation: OperationShape,
    error: StructureShape,
    testCase: HttpResponseTestCase
  ): void {
    const writer = this._writer!;
    const testName = testCase.getId() + ":Error:" + operation.getId().getName();
    const documentation = testCase.getDocumentation();
    if (documentation !== undefined) {
      writer.writeDocs(documentation);
    }
    this._openTestBlock(operation, testCase, testName, () => {
      this._writeResponseTestSetup(operation, testCase, false);
      writer
        .write(
          `try {
  await client.send(command);
} catch (err) {
  if (err.name !== "$1L") {
    console.log(err);
    fail(\`Expected a $1L to be thrown, got $\${err.name} instead\`);
    return;
  }
  const r: any = err;`,
          error.getId().getName()
        )
        .indent()
        .call(() => this._writeResponseAssertions(error, testCase))
        .write("return;")
        .dedent()
        .write("}");
      writer.write('fail("Expected an exception to be thrown from response");');
    });
  }

  private _writeResponseTestSetup(operation: OperationShape, testCase: HttpResponseTestCase, isSuccess: boolean): void {
    const writer = this._writer!;
    const operationSymbol = this._symbolProvider.toSymbol(operation);
    const headers = lowercaseHeaders(testCase.getHeaders());
    const body = testCase.getBody();
    writer.openBlock("const client = new $T({", "});\n", this._serviceSymbol, () => {
      writer.write("...clientParams,");
      writer.openBlock("requestHandler: new ResponseDeserializationTestHandler(", "),", () => {
        writer.write("$L,", isSuccess);
        writer.write("$L,", testCase.getCode());
        if (headers.size === 0) {
          writer.write("undefined,");
        } else {
          writer.openBlock("{", "},", () => {
            for (const [key, value] of headers.entries()) {
              writer.write("$L: $S,", PropertyAccessor.inlineKey(key.toLowerCase()), value);
            }
          });
        }
        if (body !== undefined) {
          writer.write("`$L`,", body);
        }
        writer.unwrite(",\n").write("");
      });
    });
    const httpLabelMembers = this._httpLabelMembers(operation);
    writer.openCollapsibleBlock("const params: any = {", "};", httpLabelMembers.length > 0, () => {
      for (const member of httpLabelMembers) {
        writer.write('$L: "placeholder",', PropertyAccessor.inlineKey(member));
      }
    });
    writer.write("const command = new $T(params);\n", operationSymbol);
  }

  private _httpLabelMembers(operation: OperationShape): string[] {
    const input = this._model.expectShape(operation.getInputShape());
    const names: string[] = [];
    for (const member of input.getAllMembers().values()) {
      if (member.hasTrait(HttpLabelTrait.ID)) {
        names.push(member.getMemberName());
      }
    }
    return names;
  }

  private _writeResponseAssertions(operationOrError: Shape, testCase: HttpResponseTestCase): void {
    this._writer!.write("expect(r.$$metadata.httpStatusCode).toBe($L);", testCase.getCode());
    this._writeResponseParamAssertions(operationOrError, testCase);
  }

  private _writeResponseParamAssertions(operationOrError: Shape, testCase: HttpResponseTestCase): void {
    const writer = this._writer!;
    const params = testCase.getParams();
    if (Object.keys(params).length === 0) {
      return;
    }
    let testOutputShape: StructureShape;
    const asStructure = operationOrError.asStructureShape();
    if (asStructure !== undefined) {
      testOutputShape = asStructure;
    } else {
      const outputId = operationOrError.asOperationShape()!.getOutput();
      if (outputId === undefined) {
        throw new CodegenException("Foo");
      }
      testOutputShape = this._model.expectShape(outputId) as StructureShape;
    }
    writer
      .write("const paramsToValidate: any = [")
      .indent()
      .call(() => new NodeVisitor(this._model, writer, testOutputShape, "output", false).visit(params))
      .dedent()
      .write("][0];");
    let payloadBinding: HttpBinding | undefined;
    if (operationOrError.asOperationShape() !== undefined) {
      const payloadBindings = HttpBindingIndex.of(this._model).getResponseBindings(operationOrError, "PAYLOAD");
      payloadBinding = payloadBindings.length > 0 ? payloadBindings[0] : undefined;
    }
    this._writeParamAssertions(payloadBinding, () => {
      writer.write(
        "const comparableBlob = await client.config.streamCollector(r[$S]);",
        payloadBinding!.getMemberName()
      );
    });
  }

  private _writeParamAssertions(payloadBinding: HttpBinding | undefined, writeComparableBlob: () => void): void {
    const writer = this._writer!;
    let hasStreamingPayloadBlob = false;
    if (payloadBinding !== undefined) {
      const target = this._model.getShape(payloadBinding.getMember().getTarget());
      hasStreamingPayloadBlob = target !== undefined && target.isBlobShape() && target.hasTrait(StreamingTrait.ID);
    }
    if (hasStreamingPayloadBlob) {
      writeComparableBlob();
    }
    writer.openBlock("Object.keys(paramsToValidate).forEach((param) => {", "});", () => {
      writer.write(
        `expect(
  r[param],
  \`The output field $\${param} should have been defined in $\${JSON.stringify(
    r,
    (_, v) => (typeof v === "bigint" ? v.toString() : v),
    2
  )}\`
).toBeDefined();`
      );
      if (hasStreamingPayloadBlob) {
        writer.openBlock("if (param === $S) {", "} else {", payloadBinding!.getMemberName(), () =>
          writer.write("expect(equivalentContents(paramsToValidate[param], comparableBlob)).toBe(true);\n")
        );
        writer.indent();
      }
      writer.write("expect(equivalentContents(paramsToValidate[param], r[param])).toBe(true);");
      if (hasStreamingPayloadBlob) {
        writer.dedent();
        writer.write("}");
      }
    });
  }

  private _openTestBlock(
    operation: OperationShape,
    testCase: HttpMessageTestCase,
    testName: string,
    f: () => void
  ): void {
    const writer = this._writer!;
    const timeout = testCase.getTags().includes(SERDE_BENCHMARK_TAG) ? ", BENCHMARK_TIMEOUT" : "";
    if (this._testFilter(this._service, operation, testCase, this._settings)) {
      writer.openBlock("it.skip($S, async () => {", testName);
    } else {
      writer.openBlock("it($S, async () => {", testName);
    }
    f();
    writer.closeBlock("}$L);\n", timeout);
  }
}

class NodeVisitor {
  private _workingShape: Shape;
  private _appendSemicolon: boolean;

  public constructor(
    private readonly _model: Model,
    private readonly _writer: TypeScriptWriter,
    inputShape: StructureShape,
    private readonly _kind: NodeVisitorKind,
    appendSemicolon: boolean
  ) {
    this._workingShape = inputShape;
    this._appendSemicolon = appendSemicolon;
  }

  public visit(node: unknown, holder?: object, key?: string | number): void {
    if (node === null) {
      this._writer.write("null,");
    } else if (Array.isArray(node)) {
      this._arrayNode(node);
    } else if (typeof node === "boolean") {
      this._writer.write(node ? "true," : "false,");
    } else if (typeof node === "number") {
      const source = holder === undefined || key === undefined ? undefined : JsonParser.getNumberSource(holder, key);
      this._numberNode(javaNumberToString(source ?? String(node)));
    } else if (typeof node === "string") {
      this._stringNode(node);
    } else {
      this._objectNode(node as Record<string, unknown>);
    }
  }

  private _arrayNode(node: unknown[]): void {
    this._writer.openBlock("$L", "],", "[", () => {
      const wrapperShape = this._workingShape;
      for (let i = 0; i < node.length; i++) {
        if (wrapperShape instanceof CollectionShape) {
          this._workingShape = this._model.expectShape(wrapperShape.getMember().getTarget());
        }
        this._writer.call(() => this.visit(node[i], node, i));
      }
      this._workingShape = wrapperShape;
    });
  }

  private _numberNode(text: string): void {
    const shape = this._workingShape;
    if (shape.isTimestampShape()) {
      this._writer.write(this._kind === "input" ? "new Date($L000)," : "new Date($L * 1000),", text);
    } else if (shape.isBigIntegerShape()) {
      this._writer.write("BigInt($S),", text);
    } else if (shape.isBigDecimalShape()) {
      this._writer.addImportSubmodule("nv", null, TypeScriptDependency.SMITHY_CORE, SmithyCoreSubmodules.SERDE);
      this._writer.write("nv($S),", text);
    } else {
      this._writer.write("$L,", text);
    }
  }

  private _stringNode(value: string): void {
    const shape = this._workingShape;
    if (shape.isBlobShape()) {
      this._writer.write("Uint8Array.from($S, (c) => c.charCodeAt(0)),", value);
    } else if (shape.isFloatShape() || shape.isDoubleShape()) {
      if (value === "NaN" || value === "Infinity" || value === "-Infinity") {
        this._writer.write(value + ",");
      } else {
        throw new CodegenException(`Unexpected string value for \`${shape.getId()}\`: "${value}"`);
      }
    } else {
      this._writer.write("$S,", value);
    }
  }

  private _objectNode(node: Record<string, unknown>): void {
    const writer = this._writer;
    if (this._workingShape.isDocumentShape()) {
      writer.writeInline(JSON.stringify(node, null, 4)).writeInline(",");
      return;
    }
    const isInput = this._kind === "input";
    let suffix = "},";
    if (isInput) {
      suffix = "} as any";
      if (this._appendSemicolon) {
        suffix += ";";
        this._appendSemicolon = false;
      } else {
        suffix += ",";
      }
    }
    writer.openBlock("{", suffix, () => {
      const wrapperShape = this._workingShape;
      for (const [key, valueNode] of Object.entries(node)) {
        const memberShape = this._memberFor(wrapperShape, key);
        let name = key;
        if (!isInput && wrapperShape.hasTrait(ErrorTrait) && name === "Message") {
          name = "message";
        }
        writer.writeInline("$L: ", PropertyAccessor.inlineKey(name));
        if (isInput && this._isIdempotencyTokenWithoutValue(memberShape, valueNode)) {
          writer.write('"00000000-0000-4000-8000-000000000000",');
          continue;
        }
        this._workingShape = this._model.expectShape(memberShape.getTarget());
        let renderNode = valueNode;
        if (!isInput && memberShape.hasTrait(HttpPrefixHeadersTrait)) {
          const downcased: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(valueNode as Record<string, unknown>)) {
            downcased[k.toLowerCase()] = v;
          }
          renderNode = downcased;
        }
        writer.call(() => this.visit(renderNode, node, key));
      }
      if (isInput && Object.keys(node).length === 0 && wrapperShape.isStructureShape()) {
        for (const [memberName, member] of wrapperShape.asStructureShape()!.getAllMembers()) {
          if (member.hasTrait(IdempotencyTokenTrait)) {
            writer.write('$L: "00000000-0000-4000-8000-000000000000",', memberName);
          }
        }
      }
      this._workingShape = wrapperShape;
    });
  }

  private _memberFor(wrapperShape: Shape, key: string) {
    const structure = wrapperShape.asStructureShape();
    if (structure !== undefined) {
      return structure.getMember(key)!;
    }
    const union = wrapperShape.asUnionShape();
    if (union !== undefined) {
      return union.getMember(key)!;
    }
    const map = wrapperShape.asMapShape();
    if (map !== undefined) {
      return map.getValue();
    }
    throw new CodegenException(
      `Unknown shape type for object node when generating protocol test ${this._kind}: ${wrapperShape.getType()}`
    );
  }

  private _isIdempotencyTokenWithoutValue(member: { hasTrait(t: unknown): boolean }, valueNode: unknown): boolean {
    if (!member.hasTrait(IdempotencyTokenTrait)) {
      return false;
    }
    return valueNode === "";
  }
}

const lowercaseHeaders = (headers: ReadonlyMap<string, string>): JavaHashMap<string> => {
  const result = new JavaHashMap<string>();
  for (const [key, value] of headers) {
    result.set(key.toLowerCase(), value);
  }
  return result;
};
