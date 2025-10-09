/*
A static schema is a non-function-call object that has no side effects.
Schemas are generated as static objects to improve tree-shaking behavior in downstream applications.
 */

import type { SchemaRef, SchemaTraits } from "../schema/schema";

/**
 * @alpha
 */
export namespace StaticSchemaId {
  export type Simple = 0;
  export type List = 1;
  export type Map = 2;
  export type Struct = 3;
  export type Error = -3;
  export type Operation = 9;
}

/**
 * @alpha
 */
export type StaticSchema =
  | StaticSimpleSchema
  | StaticListSchema
  | StaticMapSchema
  | StaticStructureSchema
  | StaticErrorSchema
  | StaticOperationSchema;

/**
 * @alpha
 */
export type ShapeName = string;

/**
 * @alpha
 */
export type ShapeNamespace = string;

/**
 * @alpha
 */
export type StaticSimpleSchema = [StaticSchemaId.Simple, ShapeNamespace, ShapeName, SchemaRef, SchemaTraits];

/**
 * @alpha
 */
export type StaticListSchema = [StaticSchemaId.List, ShapeNamespace, ShapeName, SchemaTraits, SchemaRef];

/**
 * @alpha
 */
export type StaticMapSchema = [StaticSchemaId.Map, ShapeNamespace, ShapeName, SchemaTraits, SchemaRef, SchemaRef];

/**
 * @alpha
 */
export type StaticStructureSchema = [
  StaticSchemaId.Struct,
  ShapeNamespace,
  ShapeName,
  SchemaTraits,
  string[], // member name list
  SchemaRef[], // member schema list
];

/**
 * @alpha
 */
export type StaticErrorSchema = [
  StaticSchemaId.Error,
  ShapeNamespace,
  ShapeName,
  SchemaTraits,
  string[], // member name list
  SchemaRef[], // member schema list
];

/**
 * @alpha
 */
export type StaticOperationSchema = [
  StaticSchemaId.Operation,
  ShapeNamespace,
  ShapeName,
  SchemaTraits,
  SchemaRef, // input schema
  SchemaRef, // output schema
];
