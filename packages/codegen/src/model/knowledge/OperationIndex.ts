import { ExpectationNotMetException } from "../exceptions/exceptions";
import type { Model } from "../Model";
import type { OperationShape } from "../shapes/ServiceShapes";
import type { Shape } from "../shapes/Shape";
import type { ShapeId, ToShapeId } from "../shapes/ShapeId";
import type { StructureShape } from "../shapes/AggregateShapes";
import { UnitTypeTrait } from "../traits/UnitTypeTrait";

/**
 * Indexes the input, output, and error structures of operations.
 *
 * @internal
 */
export class OperationIndex {
  private readonly _inputs = new Map<ShapeId, StructureShape>();
  private readonly _outputs = new Map<ShapeId, StructureShape>();
  private readonly _errors = new Map<ShapeId, StructureShape[]>();
  private readonly _boundInputOperations = new Map<ShapeId, OperationShape[]>();
  private readonly _boundOutputOperations = new Map<ShapeId, OperationShape[]>();
  private readonly _boundErrorShapes = new Map<ShapeId, Shape[]>();

  constructor(model: Model) {
    for (const operation of model.getOperationShapes()) {
      const input = OperationIndex._getStructure(model, operation.getInputShape());
      if (input !== undefined) {
        this._inputs.set(operation.getId(), input);
        OperationIndex._addBinding(this._boundInputOperations, input.getId(), operation);
      }
      const output = OperationIndex._getStructure(model, operation.getOutputShape());
      if (output !== undefined) {
        this._outputs.set(operation.getId(), output);
        OperationIndex._addBinding(this._boundOutputOperations, output.getId(), operation);
      }
      this._addErrorsFromShape(model, operation.getId(), operation.getErrorsSet());
    }
    for (const service of model.getServiceShapes()) {
      this._addErrorsFromShape(model, service.getId(), service.getErrorsSet());
    }
  }

  public static of(model: Model): OperationIndex {
    return model.getKnowledge(OperationIndex);
  }

  /**
   * Returns the input structure, or undefined when the input is `smithy.api#Unit`.
   */
  public getInput(operation: ToShapeId): StructureShape | undefined {
    const input = this.getInputShape(operation);
    return input === undefined || input.getId() === UnitTypeTrait.UNIT ? undefined : input;
  }

  public getInputShape(operation: ToShapeId): StructureShape | undefined {
    return this._inputs.get(operation.toShapeId());
  }

  public expectInputShape(operation: ToShapeId): StructureShape {
    const input = this.getInputShape(operation);
    if (input === undefined) {
      throw new ExpectationNotMetException(
        "Cannot get the input of `" + operation.toShapeId() + "` because it is not an operation shape in the model."
      );
    }
    return input;
  }

  public getOutput(operation: ToShapeId): StructureShape | undefined {
    const output = this.getOutputShape(operation);
    return output === undefined || output.getId() === UnitTypeTrait.UNIT ? undefined : output;
  }

  public getOutputShape(operation: ToShapeId): StructureShape | undefined {
    return this._outputs.get(operation.toShapeId());
  }

  public expectOutputShape(operation: ToShapeId): StructureShape {
    const output = this.getOutputShape(operation);
    if (output === undefined) {
      throw new ExpectationNotMetException(
        "Cannot get the output of `" + operation.toShapeId() + "` because it is not an operation shape in the model."
      );
    }
    return output;
  }

  /**
   * Returns the errors of an operation or service. With two arguments, the service errors come first.
   */
  public getErrors(operationOrService: ToShapeId, operation?: ToShapeId): StructureShape[] {
    if (operation === undefined) {
      return this._errors.get(operationOrService.toShapeId()) ?? [];
    }
    const result = new Set<StructureShape>(this.getErrors(operationOrService));
    this.getErrors(operation).forEach((error) => result.add(error));
    return Array.from(result);
  }

  private _addErrorsFromShape(model: Model, source: ShapeId, errorShapeIds: readonly ShapeId[]): void {
    const errorShapes: StructureShape[] = [];
    const sourceShape = model.expectShape(source);
    for (const target of errorShapeIds) {
      const structure = OperationIndex._getStructure(model, target);
      if (structure !== undefined) {
        errorShapes.push(structure);
      }
      OperationIndex._addBinding(this._boundErrorShapes, target, sourceShape);
    }
    this._errors.set(source, errorShapes);
  }

  private static _addBinding<T>(map: Map<ShapeId, T[]>, key: ShapeId, value: T): void {
    const existing = map.get(key);
    if (existing === undefined) {
      map.set(key, [value]);
    } else if (existing.indexOf(value) === -1) {
      existing.push(value);
    }
  }

  private static _getStructure(model: Model, id: ToShapeId): StructureShape | undefined {
    return model.getShape(id)?.asStructureShape();
  }
}
