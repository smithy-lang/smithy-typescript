import type { Symbol } from "../codegen-core";
import type { EnumDefinition, StringShape } from "../model";
import { EnumTrait } from "../model";
import { TypeScriptUtils } from "./TypeScriptUtils";
import { TypeScriptWriter } from "./TypeScriptWriter";

/**
 * Generates the constant object and type for a string enum.
 */
export class EnumGenerator {
  private readonly _symbol: Symbol;
  private readonly _writer: TypeScriptWriter;
  private readonly _enumTrait: EnumTrait;

  public constructor(shape: StringShape, symbol: Symbol, writer: TypeScriptWriter) {
    this._symbol = symbol;
    this._writer = writer;
    this._enumTrait = shape.expectTrait(EnumTrait);
  }

  public run(): void {
    if (!this._enumTrait.hasNames()) {
      this._generateUnnamedEnum();
    } else {
      this._generateNamedEnum();
    }
  }

  private _generateUnnamedEnum(): void {
    const variants = TypeScriptUtils.getEnumVariants(this._enumTrait.getEnumDefinitionValues());
    this._writer.writeDocs("@public").write("export type $L = $L", this._symbol.getName(), variants);
  }

  private _generateNamedEnum(): void {
    const writer = this._writer;
    const name = this._symbol.getName();
    writer.writeDocs("@public\n@enum").openBlock("export const $L = {", "} as const;", name, () => {
      [...this._enumTrait.getValues()]
        .sort((a, b) => compare(a.getName()!, b.getName()!))
        .forEach((value) => this._writeNamedEnumConstant(value));
    });
    const inline = `export type ${name} = (typeof ${name})[keyof typeof ${name}];`;
    const breakline = inline.replace("= ", "=\n  ");
    writer.writeDocs("@public").write(inline.length <= TypeScriptWriter.LINE_WIDTH ? inline : breakline);
  }

  private _writeNamedEnumConstant(body: EnumDefinition): void {
    const documentation = body.getDocumentation();
    if (documentation !== undefined) {
      this._writer.writeDocs(documentation);
    }
    this._writer.write("$L: $S,", TypeScriptUtils.sanitizePropertyName(body.getName()!), body.getValue());
  }
}

const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
