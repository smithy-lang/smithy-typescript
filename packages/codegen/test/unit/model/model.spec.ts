import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

import type { Model } from "../../../src/model";
import {
  CaseUtils,
  DocumentationTrait,
  HttpTrait,
  ModelLoader,
  OperationIndex,
  ServiceIndex,
  ShapeId,
  StringUtils,
  TopDownIndex,
  Walker,
} from "../../../src/model";

const AST = JSON.parse(readFileSync(join(__dirname, "../../fixtures/my-local-model-schema/model.json"), "utf8"));

describe("ShapeId", () => {
  test("parses and interns", () => {
    const id = ShapeId.from("ns.a#Name$member");
    expect(id.getNamespace()).toBe("ns.a");
    expect(id.getName()).toBe("Name");
    expect(id.getMember()).toBe("member");
    expect(id.withoutMember()).toBe(ShapeId.from("ns.a#Name"));
    expect(ShapeId.from("ns.a#Name").withMember("member")).toBe(id);
    expect(id.toString()).toBe("ns.a#Name$member");
  });

  test("rejects invalid IDs", () => {
    expect(() => ShapeId.from("NoNamespace")).toThrow();
    expect(() => ShapeId.from("ns#bad name")).toThrow();
  });
});

describe("utilities", () => {
  test("string and case helpers", () => {
    expect(StringUtils.capitalize("abc")).toBe("Abc");
    expect(StringUtils.uncapitalize("GetThing")).toBe("getThing");
    expect(StringUtils.escapeJavaString('a"b\n')).toBe('"a\\"b\\n"');
    expect(CaseUtils.toCamelCase("foo-bar_baz")).toBe("fooBarBaz");
    expect(CaseUtils.toSnakeCase("fooBarBaz")).toBe("foo_bar_baz");
  });
});

describe("fixture model", () => {
  const model: Model = ModelLoader.load(AST);
  const service = model.expectShape(ShapeId.from("org.xyz.v1#XYZService")).asServiceShape()!;

  test("loads three services", () => {
    expect(model.getServiceShapes().map((s) => s.getId().toString())).toEqual([
      "org.xyz.secondary#TertiaryService",
      "org.xyz.v1#UnusedService",
      "org.xyz.v1#XYZService",
    ]);
    expect(model.getOperationShapes().length).toBe(40);
    expect(service.getVersion()).toBe("1.0");
  });

  test("flattens mixin members before local members and drops the mixin trait", () => {
    const defaults = model.expectShape(ShapeId.from("smithy.protocoltests.rpcv2Cbor#Defaults")).asStructureShape()!;
    expect(defaults.getMixins().map(String)).toEqual(["smithy.protocoltests.rpcv2Cbor#DefaultsMixin"]);
    expect(defaults.getAllMembers().size).toBe(23);
    expect(Array.from(defaults.getAllMembers().keys()).slice(0, 3)).toEqual([
      "defaultString",
      "defaultBoolean",
      "defaultList",
    ]);
    const first = defaults.getMember("defaultString")!;
    expect(first.getId().toString()).toBe("smithy.protocoltests.rpcv2Cbor#Defaults$defaultString");
    expect(defaults.hasTrait("mixin")).toBe(false);
    const mixin = model.expectShape(ShapeId.from("smithy.protocoltests.rpcv2Cbor#DefaultsMixin"));
    expect(mixin.hasTrait("mixin")).toBe(true);
  });

  test("traits are available by class and by id", () => {
    const operation = model.expectShape(ShapeId.from("org.xyz.v1#GetNumbers")).asOperationShape()!;
    const http = operation.expectTrait(HttpTrait);
    expect(operation.getTrait(HttpTrait)).toBe(http);
    expect(operation.findTrait("smithy.api#http")).toBe(http);
    expect(http.getUri().toString()).toBe((operation.findTrait("http")!.toNode() as { uri: string }).uri);
    expect(operation.hasTrait(DocumentationTrait)).toBe(operation.hasTrait("documentation"));
  });

  test("TopDownIndex lists the operations of XYZService sorted by ID", () => {
    const names = TopDownIndex.of(model)
      .getContainedOperations(service)
      .map((operation) => operation.getId().getName());
    expect(names).toEqual([
      "HttpLabelCommand",
      "camelCaseOperation",
      "GetNumbers",
      "HostPrefixOperation",
      "PublishEvents",
      "SubscribeToEvents",
      "TradeEventStream",
      "UnionMemberCollisionOperation",
      "ValidatedOperation",
    ]);
  });

  test("indexes are cached per model", () => {
    expect(TopDownIndex.of(model)).toBe(TopDownIndex.of(model));
    expect(OperationIndex.of(model)).toBe(OperationIndex.of(model));
  });

  test("OperationIndex resolves unit inputs", () => {
    const index = OperationIndex.of(model);
    const operation = model.getOperationShapes().find((candidate) => candidate.getInput() === undefined)!;
    expect(index.getInput(operation)).toBeUndefined();
    expect(index.getInputShape(operation)?.getId().toString()).toBe("smithy.api#Unit");
  });

  test("ServiceIndex resolves protocols and auth", () => {
    const index = ServiceIndex.of(model);
    expect(Array.from(index.getProtocols(service).keys()).map(String)).toEqual([
      "smithy.protocols#rpcv2Cbor",
      "smithy.protocols#rpcv2Json",
    ]);
    expect(Array.from(index.getEffectiveAuthSchemes(service).keys()).map(String)).toEqual([
      "smithy.api#httpApiKeyAuth",
    ]);
  });

  test("Walker visits reachable shapes once", () => {
    const operation = model.expectShape(ShapeId.from("org.xyz.v1#GetNumbers"));
    const walked = Walker.walkShapes(model, operation);
    expect(walked[0]).toBe(operation);
    expect(new Set(walked).size).toBe(walked.length);
    expect(walked.length).toBeGreaterThan(3);
  });
});
