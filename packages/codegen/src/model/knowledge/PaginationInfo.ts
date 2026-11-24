import type { StructureShape } from "../shapes/AggregateShapes";
import type { MemberShape } from "../shapes/MemberShape";
import type { OperationShape, ServiceShape } from "../shapes/ServiceShapes";
import { PaginatedTrait } from "../traits/PaginatedTrait";

/**
 * The resolved pagination members of a paginated operation.
 *
 * @internal
 */
export class PaginationInfo {
  private readonly _service: ServiceShape;
  private readonly _operation: OperationShape;
  private readonly _input: StructureShape;
  private readonly _output: StructureShape;
  private readonly _paginatedTrait: PaginatedTrait;
  private readonly _inputToken: MemberShape;
  private readonly _outputToken: readonly MemberShape[];
  private readonly _pageSize: MemberShape | undefined;
  private readonly _items: readonly MemberShape[];

  constructor(
    service: ServiceShape,
    operation: OperationShape,
    input: StructureShape,
    output: StructureShape,
    paginatedTrait: PaginatedTrait,
    inputToken: MemberShape,
    outputToken: readonly MemberShape[],
    pageSize: MemberShape | undefined,
    items: readonly MemberShape[]
  ) {
    this._service = service;
    this._operation = operation;
    this._input = input;
    this._output = output;
    this._paginatedTrait = paginatedTrait;
    this._inputToken = inputToken;
    this._outputToken = outputToken;
    this._pageSize = pageSize;
    this._items = items;
  }

  public getOperation(): OperationShape {
    return this._operation;
  }

  public getPaginatedTrait(): PaginatedTrait {
    return this._paginatedTrait.merge(this._service.getTrait(PaginatedTrait));
  }

  public getPageSizeMember(): MemberShape | undefined {
    return this._pageSize;
  }
}
