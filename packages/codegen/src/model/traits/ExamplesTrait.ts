import { Nodes } from "../node/Nodes";
import type { JsonObject } from "../node/Nodes";
import { ShapeId } from "../shapes/ShapeId";
import { Trait } from "./Trait";

class ErrorExample {
  private readonly _shapeId: ShapeId;
  private readonly _content: JsonObject;

  constructor(shapeId: ShapeId, content: JsonObject) {
    this._shapeId = shapeId;
    this._content = content;
  }
}

class Example {
  private readonly _title: string;
  private readonly _documentation: string | undefined;
  private readonly _input: JsonObject;
  private readonly _output: JsonObject | undefined;
  private readonly _error: ErrorExample | undefined;
  private readonly _allowConstraintErrors: boolean;

  constructor(
    title: string,
    documentation: string | undefined,
    input: JsonObject,
    output: JsonObject | undefined,
    error: ErrorExample | undefined,
    allowConstraintErrors: boolean
  ) {
    this._title = title;
    this._documentation = documentation;
    this._input = input;
    this._output = output;
    this._error = error;
    this._allowConstraintErrors = allowConstraintErrors;
  }

  public getTitle(): string {
    return this._title;
  }

  public getDocumentation(): string | undefined {
    return this._documentation;
  }

  public getInput(): JsonObject {
    return this._input;
  }

  public getOutput(): JsonObject | undefined {
    return this._output;
  }
}

/**
 * @internal
 */
export class ExamplesTrait extends Trait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.api#examples");

  private readonly _examples: Example[];

  constructor(value: unknown) {
    super(ExamplesTrait.ID, value);
    this._examples = Nodes.expectArray(value).map((entry) => ExamplesTrait._exampleFromNode(entry));
  }

  public getExamples(): Example[] {
    return this._examples;
  }

  private static _exampleFromNode(node: unknown): Example {
    const object = Nodes.expectObject(node);
    const errorNode = Nodes.getObject(object, "error");
    const error =
      errorNode === undefined
        ? undefined
        : new ErrorExample(
            Nodes.expectShapeId(Nodes.expectMember(errorNode, "shapeId")),
            Nodes.expectObject(Nodes.expectMember(errorNode, "content"))
          );
    return new Example(
      Nodes.getString(object, "title") ?? "",
      Nodes.getString(object, "documentation"),
      Nodes.getObject(object, "input") ?? {},
      Nodes.getObject(object, "output"),
      error,
      Nodes.getBooleanOrDefault(object, "allowConstraintErrors")
    );
  }
}
