import type { Symbol } from "./Symbol";
import type { SymbolContainer } from "./SymbolContainer";
import type { SymbolDependency } from "./SymbolDependency";
import type { SymbolDependencyContainer } from "./SymbolDependencyContainer";
import { mapsEqual, TypedPropertiesBag, TypedPropertiesBagBuilder } from "./TypedPropertiesBag";

/**
 * @internal
 */
export type ContextOption = "DECLARE" | "USE";

/**
 * @internal
 */
export const ContextOption = {
  DECLARE: "DECLARE" as ContextOption,
  USE: "USE" as ContextOption,
};

type SymbolReferenceOption = ContextOption | string | object;

/**
 * A reference from one symbol to another with an optional alias.
 *
 * @internal
 */
export class SymbolReference extends TypedPropertiesBag implements SymbolContainer, SymbolDependencyContainer {
  private readonly _symbol: Symbol;
  private readonly _options: Set<SymbolReferenceOption>;
  private readonly _alias: string;

  public constructor(symbol: Symbol, ...options: SymbolReferenceOption[]);
  public constructor(symbol: Symbol, properties: Map<string, unknown>, ...options: SymbolReferenceOption[]);
  public constructor(builder: SymbolReferenceBuilder);
  public constructor(first: Symbol | SymbolReferenceBuilder, ...rest: unknown[]) {
    const builder = SymbolReference._resolveBuilder(first, rest);
    super(builder);
    if (builder.getSymbol() === undefined) {
      throw new Error("symbol is required");
    }
    this._symbol = builder.getSymbol() as Symbol;
    this._alias = builder.getAlias() ?? this._symbol.getName();
    const options = builder.getOptions();
    this._options = options.size === 0 ? new Set([ContextOption.USE, ContextOption.DECLARE]) : new Set(options);
  }

  public static builder(): SymbolReferenceBuilder {
    return new SymbolReferenceBuilder();
  }

  public getSymbol(): Symbol {
    return this._symbol;
  }

  public getAlias(): string {
    return this._alias;
  }

  public hasOption(option: SymbolReferenceOption): boolean {
    return this._options.has(option);
  }

  public getSymbols(): Symbol[] {
    return [this._symbol];
  }

  public getDependencies(): SymbolDependency[] {
    return this._symbol.getDependencies();
  }

  public equals(o: unknown): boolean {
    if (this === o) {
      return true;
    }
    return (
      o instanceof SymbolReference &&
      super.equals(o) &&
      this._symbol.equals(o._symbol) &&
      mapsEqual(this.getProperties(), o.getProperties()) &&
      this._options.size === o._options.size &&
      Array.from(this._options).every((v) => o._options.has(v)) &&
      this._alias === o._alias
    );
  }

  public toString(): string {
    return `SymbolReference{symbol=${this._symbol}, alias='${this._alias}', options=[${Array.from(this._options).join(", ")}]}`;
  }

  private static _resolveBuilder(first: Symbol | SymbolReferenceBuilder, rest: unknown[]): SymbolReferenceBuilder {
    if (first instanceof SymbolReferenceBuilder) {
      return first;
    }
    const builder = new SymbolReferenceBuilder().symbol(first);
    if (rest[0] instanceof Map) {
      builder.setProperties(rest[0] as Map<string, unknown>);
      builder.options(...(rest.slice(1) as SymbolReferenceOption[]));
    } else {
      builder.options(...(rest as SymbolReferenceOption[]));
    }
    return builder;
  }
}

class SymbolReferenceBuilder extends TypedPropertiesBagBuilder<SymbolReferenceBuilder> {
  private _symbol: Symbol | undefined;
  private _options = new Set<SymbolReferenceOption>();
  private _alias: string | undefined;

  public build(): SymbolReference {
    return new SymbolReference(this);
  }

  public symbol(symbol: Symbol): this {
    this._symbol = symbol;
    return this;
  }

  public options(...options: SymbolReferenceOption[]): this {
    this._options = new Set(options);
    return this;
  }

  public alias(alias: string | null | undefined): this {
    this._alias = alias ?? undefined;
    return this;
  }

  public getSymbol(): Symbol | undefined {
    return this._symbol;
  }

  public getOptions(): Set<SymbolReferenceOption> {
    return this._options;
  }

  public getAlias(): string | undefined {
    return this._alias;
  }
}
