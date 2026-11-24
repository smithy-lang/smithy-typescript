/**
 * Thrown when an expected shape, trait, or node is missing or has the wrong type.
 */
export class ExpectationNotMetException extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExpectationNotMetException";
  }
}

/**
 * Thrown when a shape ID string is malformed.
 */
export class ShapeIdSyntaxException extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShapeIdSyntaxException";
  }
}

/**
 * Thrown when a model definition is invalid.
 */
export class SourceException extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SourceException";
  }
}

/**
 * Thrown when a URI or host label pattern is malformed.
 */
export class InvalidPatternException extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidPatternException";
  }
}

/**
 * Thrown when a JSON AST cannot be loaded into a model.
 */
export class ModelSyntaxException extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelSyntaxException";
  }
}
