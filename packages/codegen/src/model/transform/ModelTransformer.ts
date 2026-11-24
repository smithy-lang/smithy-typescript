import { Model } from "../Model";
import type { OperationShape, ServiceShape } from "../shapes/ServiceShapes";
import { OperationShape as OperationShapeClass, ServiceShape as ServiceShapeClass } from "../shapes/ServiceShapes";
import type { Trait } from "../traits/Trait";
import type { Shape } from "../shapes/Shape";
import type { ShapeId } from "../shapes/ShapeId";
import { TopDownIndex } from "../knowledge/TopDownIndex";
import { MixinTrait } from "../traits/MixinTrait";

/**
 * Model rewrites that Smithy applies before code generation.
 *
 * @internal
 */
export class ModelTransformer {
  public static create(): ModelTransformer {
    return new ModelTransformer();
  }

  public flattenAndRemoveMixins(model: Model): Model {
    const kept: Shape[] = [];
    let changed = false;
    for (const shape of model.toSet()) {
      if (shape.isMemberShape()) {
        continue;
      }
      if (shape.hasTrait(MixinTrait)) {
        changed = true;
        continue;
      }
      if (shape.getMixins().length > 0) {
        shape.clearMixins();
        changed = true;
      }
      kept.push(shape);
    }
    return changed ? new Model(kept, model.getMetadata()) : model;
  }

  public copyServiceErrorsToOperations(model: Model, service: ServiceShape): Model {
    if (service.getErrorsSet().length === 0) {
      return model;
    }
    const replacements = new Map<string, Shape>();
    for (const operation of TopDownIndex.of(model).getContainedOperations(service)) {
      const errors = new Map<string, ShapeId>();
      operation.getErrorsSet().forEach((id) => errors.set(id.toString(), id));
      service.getErrorsSet().forEach((id) => errors.set(id.toString(), id));
      replacements.set(operation.getId().toString(), ModelTransformer._withErrors(operation, [...errors.values()]));
    }
    return this.replaceShapes(model, replacements);
  }

  public addServiceTrait(model: Model, service: ServiceShape, trait: Trait): Model {
    const replacement = new ServiceShapeClass({
      id: service.getId(),
      traits: [...service.getAllTraits().values(), trait],
      operations: service.getIntroducedOperations(),
      resources: service.getIntroducedResources(),
      version: service.getIntroducedVersion(),
      rename: service.getIntroducedRename(),
      errors: service.getIntroducedErrorsSet(),
    });
    return this.replaceShapes(model, new Map([[service.getId().toString(), replacement]]));
  }

  public replaceShapes(model: Model, replacements: Map<string, Shape>): Model {
    const shapes: Shape[] = [];
    for (const shape of model.toSet()) {
      if (shape.isMemberShape()) {
        continue;
      }
      shapes.push(replacements.get(shape.getId().toString()) ?? shape);
    }
    return new Model(shapes, model.getMetadata());
  }

  private static _withErrors(operation: OperationShape, errors: ShapeId[]): OperationShape {
    return new OperationShapeClass({
      id: operation.getId(),
      traits: [...operation.getAllTraits().values()],
      input: operation.getInputShape(),
      output: operation.getOutputShape(),
      errors,
    });
  }
}
