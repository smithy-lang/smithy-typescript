import type { ShapeId } from "../../model";

export class ProtocolPriorityConfig {
  private readonly _serviceProtocolPriority: Map<string, ShapeId[]>;
  private readonly _defaultProtocolPriority: ShapeId[] | null;

  public constructor(
    serviceProtocolPriority: Map<string, ShapeId[]> | null,
    defaultProtocolPriority: ShapeId[] | null
  ) {
    this._serviceProtocolPriority = serviceProtocolPriority ?? new Map();
    this._defaultProtocolPriority = defaultProtocolPriority;
  }

  public getProtocolPriority(service: ShapeId): ShapeId[] | null {
    return this._serviceProtocolPriority.get(service.toString()) ?? this._defaultProtocolPriority;
  }
}
