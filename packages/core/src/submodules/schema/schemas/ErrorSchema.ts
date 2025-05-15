import type { SchemaRef, SchemaTraits } from "@smithy/types";

import { TypeRegistry } from "../TypeRegistry";
import { StructureSchema } from "./StructureSchema";

/**
 * A schema for a structure shape having the error trait. These represent enumerated operation errors.
 * Because Smithy-TS SDKs use classes for exceptions, whereas plain objects are used for all other data,
 * and have an existing notion of a XYZServiceBaseException, the ErrorSchema differs from a StructureSchema
 * by additionally holding the class reference for the corresponding ServiceException class.
 *
 * @public
 */
export class ErrorSchema extends StructureSchema {
  public constructor(
    public name: string,
    public traits: SchemaTraits,
    public memberNames: string[],
    public memberList: SchemaRef[],
    /**
     * Constructor for a modeled service exception class that extends Error.
     */
    public ctor: any
  ) {
    super(name, traits, memberNames, memberList);
  }
}

/**
 * Factory for ErrorSchema, to reduce codegen output and register the schema.
 *
 * @internal
 *
 * @param namespace - shapeId namespace.
 * @param name - shapeId name.
 * @param traits - shape level serde traits.
 * @param memberNames - list of member names.
 * @param memberList - list of schemaRef corresponding to each
 * @param ctor - class reference for the existing Error extending class.
 */
export function error(
  namespace: string,
  name: string,
  traits: SchemaTraits = {},
  memberNames: string[],
  memberList: SchemaRef[],
  ctor: any
): ErrorSchema {
  const schema = new ErrorSchema(namespace + "#" + name, traits, memberNames, memberList, ctor);
  TypeRegistry.for(namespace).register(name, schema);
  return schema;
}
