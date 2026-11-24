import type { MemberShape, Shape } from "./ModelTypes";
import type { Symbol } from "./Symbol";

/**
 * Maps shapes to symbols.
 *
 * @internal
 */
export interface SymbolProvider {
  toSymbol(shape: Shape): Symbol;
  toMemberName?(shape: MemberShape): string;
}

/**
 * @internal
 */
export const SymbolProviderUtils = {
  toMemberName(provider: SymbolProvider, shape: MemberShape): string {
    return provider.toMemberName ? provider.toMemberName(shape) : shape.getMemberName();
  },

  cache(delegate: SymbolProvider): SymbolProvider {
    const cache = new Map<Shape, Symbol>();
    return {
      toSymbol(shape: Shape): Symbol {
        let symbol = cache.get(shape);
        if (symbol === undefined) {
          symbol = delegate.toSymbol(shape);
          cache.set(shape, symbol);
        }
        return symbol;
      },
      toMemberName: (shape: MemberShape) => SymbolProviderUtils.toMemberName(delegate, shape),
    };
  },
};
