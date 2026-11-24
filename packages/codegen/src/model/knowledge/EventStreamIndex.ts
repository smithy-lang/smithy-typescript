import type { Model } from "../Model";
import type { StructureShape } from "../shapes/AggregateShapes";
import type { MemberShape } from "../shapes/MemberShape";
import type { OperationShape } from "../shapes/ServiceShapes";
import type { Shape } from "../shapes/Shape";
import type { ShapeId, ToShapeId } from "../shapes/ShapeId";
import { StreamingTrait } from "../traits/StreamingTrait";
import { EventStreamInfo } from "./EventStreamInfo";
import { OperationIndex } from "./OperationIndex";

/**
 * Indexes the event streams of operation inputs and outputs.
 *
 * @internal
 */
export class EventStreamIndex {
  private readonly _inputInfo = new Map<ShapeId, EventStreamInfo>();
  private readonly _outputInfo = new Map<ShapeId, EventStreamInfo>();

  constructor(model: Model) {
    const operationIndex = OperationIndex.of(model);
    for (const operation of model.getOperationShapes()) {
      EventStreamIndex._computeEvents(model, operation, operationIndex.expectInputShape(operation), this._inputInfo);
      EventStreamIndex._computeEvents(model, operation, operationIndex.expectOutputShape(operation), this._outputInfo);
    }
  }

  public static of(model: Model): EventStreamIndex {
    return model.getKnowledge(EventStreamIndex);
  }

  public getInputInfo(operation: ToShapeId): EventStreamInfo | undefined {
    return this._inputInfo.get(operation.toShapeId());
  }

  public getOutputInfo(operation: ToShapeId): EventStreamInfo | undefined {
    return this._outputInfo.get(operation.toShapeId());
  }

  private static _computeEvents(
    model: Model,
    operation: OperationShape,
    shape: StructureShape,
    infoMap: Map<ShapeId, EventStreamInfo>
  ): void {
    for (const member of shape.getAllMembers().values()) {
      const target = model.expectShape(member.getTarget());
      if (target.hasTrait(StreamingTrait.ID) && target.isUnionShape()) {
        const info = EventStreamIndex._createEventStreamInfo(model, operation, shape, member);
        if (info !== undefined) {
          infoMap.set(operation.getId(), info);
        }
      }
    }
  }

  private static _createEventStreamInfo(
    model: Model,
    operation: OperationShape,
    structure: StructureShape,
    member: MemberShape
  ): EventStreamInfo | undefined {
    const eventStreamTarget = model.expectShape(member.getTarget());
    const events = new Map<string, StructureShape>();
    const union = eventStreamTarget.asUnionShape();
    const targetStructure = eventStreamTarget.asStructureShape();
    if (union !== undefined) {
      for (const unionMember of union.getAllMembers().values()) {
        const struct = model.getShape(unionMember.getTarget())?.asStructureShape();
        if (struct !== undefined) {
          events.set(unionMember.getMemberName(), struct);
        }
      }
    } else if (targetStructure !== undefined) {
      events.set(member.getMemberName(), targetStructure);
    } else {
      return undefined;
    }
    const initialMembers = new Map<string, MemberShape>();
    const initialTargets = new Map<string, Shape>();
    for (const structureMember of structure.getAllMembers().values()) {
      if (structureMember.getMemberName() !== member.getMemberName()) {
        const shapeTarget = model.getShape(structureMember.getTarget());
        if (shapeTarget !== undefined) {
          initialMembers.set(structureMember.getMemberName(), structureMember);
          initialTargets.set(structureMember.getMemberName(), shapeTarget);
        }
      }
    }
    return new EventStreamInfo(
      operation,
      eventStreamTarget.expectTrait(StreamingTrait),
      structure,
      member,
      eventStreamTarget,
      initialMembers,
      initialTargets,
      events
    );
  }
}
