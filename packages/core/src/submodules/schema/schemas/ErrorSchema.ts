import type { SchemaRef, SchemaTraits } from "@smithy/types";

import { Schema } from "./Schema";
import { StructureSchema } from "./StructureSchema";

/**
 * A schema for a structure shape having the error trait. These represent enumerated operation errors.
 * Because Smithy-TS SDKs use classes for exceptions, whereas plain objects are used for all other data,
 * and have an existing notion of a XYZServiceBaseException, the ErrorSchema differs from a StructureSchema
 * by additionally holding the class reference for the corresponding ServiceException class.
 *
 * @internal
 * @deprecated use StaticSchema
 */
export class ErrorSchema extends StructureSchema {
  public static readonly symbol = Symbol.for("@smithy/err");
  /**
   * @deprecated - field unused.
   */
  public ctor!: any;
  protected readonly symbol = ErrorSchema.symbol;
}

/**
 * Factory for ErrorSchema, to reduce codegen output and register the schema.
 *
 * @internal
 * @deprecated use StaticSchema
 *
 * @param namespace - shapeId namespace.
 * @param name - shapeId name.
 * @param traits - shape level serde traits.
 * @param memberNames - list of member names.
 * @param memberList - list of schemaRef corresponding to each
 * @param ctor - class reference for the existing Error extending class.
 */
export const error = (
  namespace: string,
  name: string,
  traits: SchemaTraits,
  memberNames: string[],
  memberList: SchemaRef[],
  /**
   * @deprecated - field unused.
   */
  ctor?: any
): ErrorSchema =>
  Schema.assign(new ErrorSchema(), {
    name,
    namespace,
    traits,
    memberNames,
    memberList,
    ctor: null,
  });
