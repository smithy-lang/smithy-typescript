import type { Model } from "../Model";
import type { StructureShape } from "../shapes/AggregateShapes";
import type { MemberShape } from "../shapes/MemberShape";
import type { OperationShape, ServiceShape } from "../shapes/ServiceShapes";
import type { ShapeId, ToShapeId } from "../shapes/ShapeId";
import { PaginatedTrait } from "../traits/PaginatedTrait";
import { OperationIndex } from "./OperationIndex";
import { PaginationInfo } from "./PaginationInfo";
import { TopDownIndex } from "./TopDownIndex";

/**
 * Indexes the paginated operations of each service.
 *
 * @internal
 */
export class PaginatedIndex {
  private readonly _paginationInfo = new Map<ShapeId, Map<ShapeId, PaginationInfo>>();

  constructor(model: Model) {
    const topDownIndex = TopDownIndex.of(model);
    const operationIndex = OperationIndex.of(model);
    for (const service of model.getServiceShapes()) {
      const serviceTrait = service.getTrait(PaginatedTrait);
      const mappings = new Map<ShapeId, PaginationInfo>();
      for (const operation of topDownIndex.getContainedOperations(service)) {
        const operationTrait = operation.getTrait(PaginatedTrait);
        if (operationTrait !== undefined) {
          const merged = operationTrait.merge(serviceTrait);
          const info = PaginatedIndex._create(model, service, operationIndex, operation, merged);
          if (info !== undefined) {
            mappings.set(info.getOperation().getId(), info);
          }
        }
      }
      this._paginationInfo.set(service.getId(), mappings);
    }
  }

  public static of(model: Model): PaginatedIndex {
    return model.getKnowledge(PaginatedIndex);
  }

  public getPaginationInfo(service: ToShapeId, operation: ToShapeId): PaginationInfo | undefined {
    const mappings = this._paginationInfo.get(service.toShapeId());
    return mappings === undefined ? undefined : mappings.get(operation.toShapeId());
  }

  private static _create(
    model: Model,
    service: ServiceShape,
    operationIndex: OperationIndex,
    operation: OperationShape,
    trait: PaginatedTrait
  ): PaginationInfo | undefined {
    const input: StructureShape = operationIndex.expectInputShape(operation.getId());
    const output: StructureShape = operationIndex.expectOutputShape(operation.getId());
    const inputTokenName = trait.getInputToken();
    const inputToken: MemberShape | undefined =
      inputTokenName === undefined ? undefined : input.getMember(inputTokenName);
    const outputTokenPath = PaginatedIndex._resolve(trait.getOutputToken(), model, output);
    if (inputToken === undefined || outputTokenPath.length === 0) {
      return undefined;
    }
    const pageSizeName = trait.getPageSize();
    const pageSize = pageSizeName === undefined ? undefined : input.getMember(pageSizeName);
    const itemsPath = PaginatedIndex._resolve(trait.getItems(), model, output);
    return new PaginationInfo(
      service,
      operation,
      input,
      output,
      trait,
      inputToken,
      outputTokenPath,
      pageSize,
      itemsPath
    );
  }

  private static _resolve(path: string | undefined, model: Model, output: StructureShape): MemberShape[] {
    return path === undefined ? [] : PaginatedTrait.resolveFullPath(path, model, output);
  }
}
