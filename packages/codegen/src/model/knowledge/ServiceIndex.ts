import type { Model } from "../Model";
import type { Shape } from "../shapes/Shape";
import type { ShapeId, ToShapeId } from "../shapes/ShapeId";
import { TreeMap } from "../utils/TreeMap";
import { NoAuthTrait, OptionalAuthTrait } from "../traits/AnnotationTraits";
import { AuthDefinitionTrait, AuthTrait, ProtocolDefinitionTrait } from "../traits/AuthTraits";
import type { Trait } from "../traits/Trait";

type AuthSchemeMode = "MODELED" | "NO_AUTH_AWARE";

/**
 * Indexes the protocols and authentication schemes of services.
 *
 * @internal
 */
export class ServiceIndex {
  private readonly _model: Model;
  private readonly _protocolTraits = new Set<ShapeId>();
  private readonly _authTraits = new Set<ShapeId>();

  constructor(model: Model) {
    this._model = model;
    for (const shape of model.getShapesWithTrait(ProtocolDefinitionTrait)) {
      this._protocolTraits.add(shape.getId());
    }
    for (const shape of model.getShapesWithTrait(AuthDefinitionTrait)) {
      this._authTraits.add(shape.getId());
    }
  }

  public static of(model: Model): ServiceIndex {
    return model.getKnowledge(ServiceIndex);
  }

  public getProtocols(service: ToShapeId): Map<ShapeId, Trait> {
    return this._getTraitMapInSet(service, this._protocolTraits);
  }

  public getEffectiveAuthSchemes(service: ToShapeId): Map<ShapeId, Trait>;
  public getEffectiveAuthSchemes(service: ToShapeId, authSchemeMode: AuthSchemeMode): Map<ShapeId, Trait>;
  public getEffectiveAuthSchemes(service: ToShapeId, operation: ToShapeId): Map<ShapeId, Trait>;
  public getEffectiveAuthSchemes(
    service: ToShapeId,
    operation: ToShapeId,
    authSchemeMode: AuthSchemeMode
  ): Map<ShapeId, Trait>;
  public getEffectiveAuthSchemes(
    service: ToShapeId,
    operationOrMode?: ToShapeId | AuthSchemeMode,
    authSchemeMode?: AuthSchemeMode
  ): Map<ShapeId, Trait> {
    if (typeof operationOrMode === "string") {
      return this._serviceAuthSchemes(service, operationOrMode);
    }
    if (operationOrMode === undefined) {
      return this._serviceAuthSchemes(service, "MODELED");
    }
    return this._operationAuthSchemes(service, operationOrMode, authSchemeMode ?? "MODELED");
  }

  private _serviceAuthSchemes(service: ToShapeId, mode: AuthSchemeMode): Map<ShapeId, Trait> {
    const shape = this._model.getShape(service.toShapeId())?.asServiceShape();
    let result = new Map<ShapeId, Trait>();
    if (shape !== undefined) {
      const modeled = ServiceIndex._getAuthTraitValues(shape, shape);
      if (modeled !== undefined) {
        result = modeled;
      } else {
        for (const [traitId, trait] of shape.getAllTraits()) {
          if (this._authTraits.has(traitId)) {
            result.set(traitId, trait);
          }
        }
        result = ServiceIndex._sorted(result);
      }
    }
    if (mode === "NO_AUTH_AWARE" && result.size === 0) {
      result = new Map<ShapeId, Trait>([[NoAuthTrait.ID, new NoAuthTrait()]]);
    }
    return result;
  }

  private _operationAuthSchemes(service: ToShapeId, operation: ToShapeId, mode: AuthSchemeMode): Map<ShapeId, Trait> {
    const serviceShape = this._model.getShape(service.toShapeId())?.asServiceShape();
    const operationShape = this._model.getShape(operation.toShapeId())?.asOperationShape();
    let result = new Map<ShapeId, Trait>();
    if (serviceShape !== undefined && operationShape !== undefined) {
      const modeled = ServiceIndex._getAuthTraitValues(serviceShape, operationShape);
      result = modeled !== undefined ? modeled : this._serviceAuthSchemes(service, "MODELED");
    }
    if (mode === "NO_AUTH_AWARE") {
      if (result.size === 0 || (operationShape !== undefined && operationShape.hasTrait(OptionalAuthTrait.ID))) {
        result = new Map<ShapeId, Trait>(result);
        result.set(NoAuthTrait.ID, new NoAuthTrait());
      }
    }
    return result;
  }

  private _getTraitMapInSet(service: ToShapeId, haystack: ReadonlySet<ShapeId>): Map<ShapeId, Trait> {
    const shape = this._model.getShape(service.toShapeId())?.asServiceShape();
    const result = new Map<ShapeId, Trait>();
    if (shape === undefined) {
      return result;
    }
    for (const [traitId, trait] of shape.getAllTraits()) {
      if (haystack.has(traitId)) {
        result.set(traitId, trait);
      }
    }
    return ServiceIndex._sorted(result);
  }

  private static _getAuthTraitValues(service: Shape, subject: Shape): Map<ShapeId, Trait> | undefined {
    const authTrait = subject.getTrait(AuthTrait);
    if (authTrait === undefined) {
      return undefined;
    }
    const result = new Map<ShapeId, Trait>();
    for (const value of authTrait.getValueSet()) {
      const trait = service.findTrait(value);
      if (trait !== undefined) {
        result.set(value, trait);
      }
    }
    return result;
  }

  private static _sorted(map: Map<ShapeId, Trait>): Map<ShapeId, Trait> {
    return new TreeMap<ShapeId, Trait>(null, map);
  }
}
