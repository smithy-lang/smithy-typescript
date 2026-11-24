import type { Symbol } from "../codegen-core";
import type { IntEnumShape } from "../model";
import { TypeScriptUtils } from "./TypeScriptUtils";
import type { TypeScriptWriter } from "./TypeScriptWriter";

/**
 * Generates the enum for an intEnum shape.
 */
export class IntEnumGenerator {
  private readonly _symbol: Symbol;
  private readonly _shape: IntEnumShape;
  private readonly _writer: TypeScriptWriter;

  public constructor(shape: IntEnumShape, symbol: Symbol, writer: TypeScriptWriter) {
    this._shape = shape;
    this._symbol = symbol;
    this._writer = writer;
  }

  public run(): void {
    this._writer.openBlock("export enum $L {", "}", this._symbol.getName(), () => {
      [...this._shape.getEnumValues().entries()]
        .sort(([, a], [, b]) => a - b)
        .forEach(([name, value]) => this._writer.write("$L = $L,", TypeScriptUtils.sanitizePropertyName(name), value));
    });
  }
}
