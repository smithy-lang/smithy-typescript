import type { Model } from "../Model";
import type { StructureShape } from "../shapes/AggregateShapes";
import type { MemberShape } from "../shapes/MemberShape";
import type { OperationShape } from "../shapes/ServiceShapes";
import type { ShapeId, ToShapeId } from "../shapes/ShapeId";
import {
  HttpLabelTrait,
  HttpPayloadTrait,
  HttpQueryParamsTrait,
  HttpResponseCodeTrait,
} from "../traits/AnnotationTraits";
import { ErrorTrait } from "../traits/ErrorTrait";
import { HttpTrait } from "../traits/HttpTrait";
import { HttpHeaderTrait, HttpPrefixHeadersTrait, HttpQueryTrait } from "../traits/StringTraits";
import { HttpBinding } from "./HttpBinding";
import type { HttpBindingLocation } from "./HttpBinding";
import { OperationIndex } from "./OperationIndex";

/**
 * Indexes how operation inputs, outputs, and errors bind to HTTP messages.
 *
 * @internal
 */
export class HttpBindingIndex {
  private readonly _model: Model;
  private readonly _requestBindings = new Map<ShapeId, HttpBinding[]>();
  private readonly _responseBindings = new Map<ShapeId, HttpBinding[]>();

  constructor(model: Model) {
    this._model = model;
    const operationIndex = OperationIndex.of(model);
    for (const operation of model.getOperationShapesWithTrait(HttpTrait)) {
      this._requestBindings.set(operation.getId(), HttpBindingIndex._computeRequestBindings(operationIndex, operation));
      this._responseBindings.set(
        operation.getId(),
        HttpBindingIndex._computeResponseBindings(operationIndex, operation)
      );
    }
    for (const structure of model.getStructureShapesWithTrait(ErrorTrait)) {
      this._responseBindings.set(structure.getId(), HttpBindingIndex._createStructureBindings(structure, false));
    }
  }

  public static of(model: Model): HttpBindingIndex {
    return model.getKnowledge(HttpBindingIndex);
  }

  /**
   * Returns the response bindings of an operation or error keyed by member name, or only those at the given location.
   */
  public getResponseBindings(shapeOrId: ToShapeId): Map<string, HttpBinding>;
  public getResponseBindings(shapeOrId: ToShapeId, bindingLocation: HttpBindingLocation): HttpBinding[];
  public getResponseBindings(
    shapeOrId: ToShapeId,
    bindingLocation?: HttpBindingLocation
  ): Map<string, HttpBinding> | HttpBinding[] {
    return HttpBindingIndex._select(this._responseBindings, shapeOrId, bindingLocation);
  }

  private static _select(
    source: ReadonlyMap<ShapeId, HttpBinding[]>,
    shapeOrId: ToShapeId,
    location: HttpBindingLocation | undefined
  ): Map<string, HttpBinding> | HttpBinding[] {
    const bindings = source.get(shapeOrId.toShapeId()) ?? [];
    if (location !== undefined) {
      return bindings.filter((binding) => binding.getLocation() === location);
    }
    const result = new Map<string, HttpBinding>();
    for (const binding of bindings) {
      result.set(binding.getMemberName(), binding);
    }
    return result;
  }

  private static _computeRequestBindings(operationIndex: OperationIndex, operation: OperationShape): HttpBinding[] {
    return HttpBindingIndex._createStructureBindings(operationIndex.expectInputShape(operation.getId()), true);
  }

  private static _computeResponseBindings(operationIndex: OperationIndex, operation: OperationShape): HttpBinding[] {
    return HttpBindingIndex._createStructureBindings(operationIndex.expectOutputShape(operation.getId()), false);
  }

  private static _createStructureBindings(structure: StructureShape, isRequest: boolean): HttpBinding[] {
    const bindings: HttpBinding[] = [];
    const unbound: MemberShape[] = [];
    let foundPayload = false;
    for (const member of structure.getAllMembers().values()) {
      if (member.hasTrait(HttpHeaderTrait.ID)) {
        const trait = member.expectTrait(HttpHeaderTrait);
        bindings.push(new HttpBinding(member, "HEADER", trait.getValue(), trait));
      } else if (member.hasTrait(HttpPrefixHeadersTrait.ID)) {
        const trait = member.expectTrait(HttpPrefixHeadersTrait);
        bindings.push(new HttpBinding(member, "PREFIX_HEADERS", trait.getValue(), trait));
      } else if (isRequest && member.hasTrait(HttpQueryTrait.ID)) {
        const trait = member.expectTrait(HttpQueryTrait);
        bindings.push(new HttpBinding(member, "QUERY", trait.getValue(), trait));
      } else if (isRequest && member.hasTrait(HttpQueryParamsTrait.ID)) {
        const trait = member.expectTrait(HttpQueryParamsTrait);
        bindings.push(new HttpBinding(member, "QUERY_PARAMS", member.getMemberName(), trait));
      } else if (member.hasTrait(HttpPayloadTrait.ID)) {
        foundPayload = true;
        const trait = member.expectTrait(HttpPayloadTrait);
        bindings.push(new HttpBinding(member, "PAYLOAD", member.getMemberName(), trait));
      } else if (isRequest && member.hasTrait(HttpLabelTrait.ID)) {
        const trait = member.expectTrait(HttpLabelTrait);
        bindings.push(new HttpBinding(member, "LABEL", member.getMemberName(), trait));
      } else if (!isRequest && member.hasTrait(HttpResponseCodeTrait.ID)) {
        const trait = member.expectTrait(HttpResponseCodeTrait);
        bindings.push(new HttpBinding(member, "RESPONSE_CODE", member.getMemberName(), trait));
      } else {
        unbound.push(member);
      }
    }
    const unboundLocation: HttpBindingLocation = foundPayload ? "UNBOUND" : "DOCUMENT";
    for (const member of unbound) {
      bindings.push(new HttpBinding(member, unboundLocation, member.getMemberName(), undefined));
    }
    return bindings;
  }
}
