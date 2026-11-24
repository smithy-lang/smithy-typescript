import { ReservedWordsBuilder, type ReservedWords } from "../../codegen-core";
import type { MemberShape, Model, OperationShape, ServiceShape, Shape } from "../../model";
import {
  EnumTrait,
  ErrorTrait,
  IdempotencyTokenTrait,
  PaginatedTrait,
  ShapeId,
  TopDownIndex,
  WaitableTrait,
} from "../../model";
import { TreeSet } from "../../model";
import { SchemaReferenceIndex } from "../schema/SchemaReferenceIndex";
import type { StringStore } from "../util";
import { RESERVED_WORDS } from "../TypeScriptReservedWords";

const UNIT = ShapeId.from("smithy.api#Unit");

let reservedWords: ReservedWords | undefined;

const getReservedWords = (): ReservedWords => {
  if (reservedWords === undefined) {
    reservedWords = new ReservedWordsBuilder().addWords(RESERVED_WORDS).build();
  }
  return reservedWords;
};

/**
 * Shapes reachable from a service, grouped by the kind of code generated for them.
 *
 * @internal
 */
export class ServiceClosure {
  private readonly _model: Model;
  private readonly _service: ServiceShape | undefined;
  private readonly _elision: SchemaReferenceIndex;
  private readonly _operations = new TreeSet<OperationShape>();
  private readonly _paginatedOperations = new TreeSet<OperationShape>();
  private readonly _waitableOperations = new TreeSet<OperationShape>();
  private readonly _structuralInterfaces = new TreeSet<Shape>();
  private readonly _errors = new TreeSet<Shape>();
  private readonly _enums = new TreeSet<Shape>();
  private readonly _structureShapes = new TreeSet<Shape>();
  private readonly _collectionShapes = new TreeSet<Shape>();
  private readonly _mapShapes = new TreeSet<Shape>();
  private readonly _unionShapes = new TreeSet<Shape>();
  private readonly _simpleShapes = new TreeSet<Shape>();
  private readonly _existsAsSchema = new TreeSet<Shape>();
  private readonly _requiresNamingDeconfliction = new Set<Shape>();
  private readonly _scanned = new Set<string>();

  public constructor(model: Model, service?: ServiceShape, shapes?: Shape[]) {
    this._model = model;
    this._service = service;
    this._elision = SchemaReferenceIndex.of(model);
    if (service !== undefined) {
      const containedOperations = TopDownIndex.of(model).getContainedOperations(service);
      containedOperations.forEach((operation) => this._operations.add(operation));
      this._scan([...containedOperations]);
      this._scan([service]);
    } else {
      this._scan(shapes ?? []);
    }
    this._scanned.clear();
    this._deconflictSchemaVarNames();
  }

  public static of(model: Model, service: ServiceShape): ServiceClosure {
    return model.getKnowledge(ServiceClosure, (m) => new ServiceClosure(m, service, undefined));
  }

  public static ofShapes(model: Model, shapes: Shape[]): ServiceClosure {
    return new ServiceClosure(model, undefined, shapes);
  }

  public static isMemberRequiredInClient(member: MemberShape): boolean {
    const clientGeneratesValue = member.hasTrait(IdempotencyTokenTrait);
    return member.isRequired() && !clientGeneratesValue;
  }

  public getStructuralNonErrorShapes(): TreeSet<Shape> {
    return this._structuralInterfaces;
  }

  public getErrorShapes(): TreeSet<Shape> {
    return this._errors;
  }

  public getEnums(): TreeSet<Shape> {
    return this._enums;
  }

  public getWaiterNames(): TreeSet<string> {
    const waiters = new TreeSet<string>();
    for (const operation of this.getWaitableOperationShapes()) {
      const trait = operation.getTrait(WaitableTrait);
      if (trait !== undefined) {
        for (const waiterName of trait.getWaiters().keys()) {
          waiters.add("waitFor" + waiterName);
          waiters.add("waitUntil" + waiterName);
        }
      }
    }
    return waiters;
  }

  public getPaginatorNames(): TreeSet<string> {
    const paginators = new TreeSet<string>();
    for (const operation of this.getPaginatedOperationShapes()) {
      if (operation.hasTrait(PaginatedTrait)) {
        paginators.add("paginate" + operation.getId().getName());
      }
    }
    return paginators;
  }

  public getSimpleShapes(): TreeSet<Shape> {
    return this._simpleShapes;
  }

  public getStructureShapes(): TreeSet<Shape> {
    return this._structureShapes;
  }

  public getUnionShapes(): TreeSet<Shape> {
    return this._unionShapes;
  }

  public getMapShapes(): TreeSet<Shape> {
    return this._mapShapes;
  }

  public getCollectionShapes(): TreeSet<Shape> {
    return this._collectionShapes;
  }

  public getOperationShapes(): TreeSet<OperationShape> {
    return this._operations;
  }

  public getPaginatedOperationShapes(): TreeSet<OperationShape> {
    return this._paginatedOperations;
  }

  public getWaitableOperationShapes(): TreeSet<OperationShape> {
    return this._waitableOperations;
  }

  public getShapeSchemaVariableName(shape: Shape, store?: StringStore): string {
    if (shape.getId().equals(UNIT)) {
      return "__Unit";
    }
    let symbolName = getReservedWords().escape(shape.getId().getName());
    if (this._requiresNamingDeconfliction.has(shape)) {
      if (store === undefined) {
        throw new Error(
          `getShapeSchemaVariableName must be called with a StringStore because the shape ${shape.getId().getName()}requires naming deconfliction.`
        );
      }
      symbolName += "_" + store.var(shape.getId().getNamespace(), "n");
    }
    const suffix = shape.isStructureShape() || shape.isUnionShape() || shape.isOperationShape() ? "$" : "";
    return symbolName + suffix;
  }

  private _deconflictSchemaVarNames(): void {
    const observedShapeNames = new Set<string>();
    for (const shape of this._existsAsSchema) {
      if (observedShapeNames.has(shape.getId().getName())) {
        this._requiresNamingDeconfliction.add(shape);
      } else {
        observedShapeNames.add(shape.getId().getName());
      }
    }
  }

  private _scan(shapes: Shape[]): void {
    const model = this._model;
    for (let shape of shapes) {
      const key = shape.getId().toString();
      if (this._scanned.has(key)) {
        continue;
      }
      this._scanned.add(key);
      const asMember = shape.asMemberShape();
      if (asMember !== undefined) {
        shape = model.expectShape(asMember.getTarget());
      }
      switch (shape.getType()) {
        case "list":
        case "set": {
          const collection = (shape.asListShape() ?? shape.asSetShape())!;
          this._collectionShapes.add(collection);
          this._existsAsSchema.add(collection);
          this._scan([collection.getMember()]);
          break;
        }
        case "map": {
          const map = shape.asMapShape()!;
          this._mapShapes.add(map);
          this._existsAsSchema.add(map);
          this._scan([map.getKey()]);
          this._scan([map.getValue()]);
          break;
        }
        case "structure":
        case "union": {
          if (shape.isStructureShape()) {
            this._structureShapes.add(shape);
          } else if (shape.isUnionShape()) {
            this._unionShapes.add(shape);
          }
          this._existsAsSchema.add(shape);
          if (shape.hasTrait(ErrorTrait)) {
            this._errors.add(shape);
          } else if (!shape.getId().equals(UNIT)) {
            this._structuralInterfaces.add(shape);
          }
          for (const member of shape.getAllMembers().values()) {
            this._scan([member]);
          }
          break;
        }
        case "operation": {
          const operation = shape.asOperationShape()!;
          if (operation.hasTrait(WaitableTrait)) {
            this._waitableOperations.add(operation);
          }
          if (operation.hasTrait(PaginatedTrait)) {
            this._paginatedOperations.add(operation);
          }
          this._scan([model.expectShape(operation.getInput() !== undefined ? operation.getInputShape() : UNIT)]);
          this._scan([model.expectShape(operation.getOutput() !== undefined ? operation.getOutputShape() : UNIT)]);
          const errors = this._service !== undefined ? operation.getErrors(this._service) : operation.getErrors();
          errors.forEach((error) => this._scan([model.expectShape(error)]));
          this._operations.add(operation);
          this._existsAsSchema.add(operation);
          break;
        }
        case "service": {
          for (const errorShapeId of shape.asServiceShape()!.getErrorsSet()) {
            this._scan([model.expectShape(errorShapeId)]);
          }
          break;
        }
        case "byte":
        case "intEnum":
        case "short":
        case "integer":
        case "long":
        case "float":
        case "double":
        case "bigInteger":
        case "bigDecimal":
        case "boolean":
        case "string":
        case "timestamp":
        case "document":
        case "enum":
        case "blob": {
          if (shape.isEnumShape() || shape.isIntEnumShape() || shape.hasTrait(EnumTrait)) {
            this._enums.add(shape);
          }
          if (this._elision.traits.hasSchemaTraits(shape)) {
            this._existsAsSchema.add(shape);
          }
          this._simpleShapes.add(shape);
          break;
        }
        default:
          break;
      }
    }
  }
}
