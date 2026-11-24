import type { StructureShape } from "../shapes/AggregateShapes";
import type { MemberShape } from "../shapes/MemberShape";
import type { OperationShape } from "../shapes/ServiceShapes";
import type { Shape } from "../shapes/Shape";
import type { StreamingTrait } from "../traits/StreamingTrait";

/**
 * Describes the event stream member of an operation input or output.
 *
 * @internal
 */
export class EventStreamInfo {
  private readonly _operation: OperationShape;
  private readonly _streamingTrait: StreamingTrait;
  private readonly _structure: StructureShape;
  private readonly _eventStreamMember: MemberShape;
  private readonly _eventStreamTarget: Shape;
  private readonly _initialMembers: ReadonlyMap<string, MemberShape>;
  private readonly _initialTargets: ReadonlyMap<string, Shape>;
  private readonly _events: ReadonlyMap<string, StructureShape>;

  constructor(
    operation: OperationShape,
    streamingTrait: StreamingTrait,
    structure: StructureShape,
    eventStreamMember: MemberShape,
    eventStreamTarget: Shape,
    initialMembers: ReadonlyMap<string, MemberShape>,
    initialTargets: ReadonlyMap<string, Shape>,
    events: ReadonlyMap<string, StructureShape>
  ) {
    this._operation = operation;
    this._streamingTrait = streamingTrait;
    this._structure = structure;
    this._eventStreamMember = eventStreamMember;
    this._eventStreamTarget = eventStreamTarget;
    this._initialMembers = initialMembers;
    this._initialTargets = initialTargets;
    this._events = events;
  }
}
