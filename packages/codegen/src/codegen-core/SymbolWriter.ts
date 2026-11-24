import { AbstractCodeWriter } from "./AbstractCodeWriter";
import { CodegenException } from "./CodegenException";
import type { ImportContainer } from "./ImportContainer";
import { Symbol } from "./Symbol";
import type { SymbolContainer } from "./SymbolContainer";
import type { SymbolDependency } from "./SymbolDependency";
import type { SymbolDependencyContainer } from "./SymbolDependencyContainer";
import { ContextOption, SymbolReference } from "./SymbolReference";

const RELATIVIZE_SYMBOLS = "__RelativizeSymbols";

/**
 * @internal
 */
export type SymbolWriterFactory<W extends SymbolWriter<W, any>> = (filename: string, namespace: string) => W;

/**
 * A writer bound to an ImportContainer whose `$T` formatter resolves symbols and registers imports.
 *
 * @internal
 */
export abstract class SymbolWriter<W extends SymbolWriter<W, I>, I extends ImportContainer>
  extends AbstractCodeWriter<W>
  implements SymbolDependencyContainer
{
  private readonly _dependencies: SymbolDependency[] = [];
  private readonly _importContainer: I;

  public constructor(importContainer: I) {
    super();
    this._importContainer = importContainer;
    this.putFormatter("T", (type) => this._formatSymbol(type));
  }

  public getImportContainer(): I {
    return this._importContainer;
  }

  public getDependencies(): SymbolDependency[] {
    return this._dependencies;
  }

  public addDependency(dependencies: SymbolDependencyContainer): this {
    this._dependencies.push(...dependencies.getDependencies());
    return this;
  }

  public addUseImports(container: SymbolContainer | SymbolReference): this {
    if (container instanceof SymbolReference) {
      return this.addImport(container.getSymbol(), container.getAlias(), ContextOption.USE);
    }
    for (const symbol of container.getSymbols()) {
      this.addImport(symbol, symbol.getName(), ContextOption.USE);
    }
    return this;
  }

  public addImport(symbol: Symbol, alias: string, ...options: ContextOption[]): this {
    this._dependencies.push(...symbol.getDependencies());
    this._importContainer.importSymbol(symbol, alias);
    this.addImportReferences(symbol, ...options);
    return this;
  }

  public addImportReferences(symbol: Symbol, ...options: ContextOption[]): void {
    for (const reference of symbol.getReferences()) {
      if (options.length === 0) {
        this.addImport(reference.getSymbol(), reference.getAlias(), ...options);
      } else {
        for (const option of options) {
          if (reference.hasOption(option)) {
            this.addImport(reference.getSymbol(), reference.getAlias(), ...options);
            break;
          }
        }
      }
    }
  }

  private _formatSymbol(type: unknown): string {
    if (type instanceof Symbol) {
      this.addUseImports(type);
      const relativizeSymbols = this.getContext(RELATIVIZE_SYMBOLS, String) as string | null;
      return relativizeSymbols !== null ? type.relativize(relativizeSymbols) : type.toString();
    } else if (type instanceof SymbolReference) {
      this.addImport(type.getSymbol(), type.getAlias(), ContextOption.USE);
      return type.getAlias();
    }
    throw new CodegenException(
      "Invalid type provided to $T. Expected a Symbol or SymbolReference, but found `" + String(type) + "`"
    );
  }
}
