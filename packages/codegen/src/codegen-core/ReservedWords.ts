import type { MemberShape, Shape } from "./ModelTypes";
import type { Symbol } from "./Symbol";

/**
 * @internal
 */
export interface ReservedWords {
  escape(word: string): string;
  isReserved(word: string): boolean;
}

const IDENTITY: ReservedWords = {
  escape: (word) => word,
  isReserved: () => false,
};

/**
 * Builds a ReservedWords from word lists, escaping reserved words with an underscore prefix.
 *
 * @internal
 */
export class ReservedWordsBuilder {
  private readonly _mappings = new Map<string, string>();

  public build(): ReservedWords {
    const mappings = this._mappings;
    return {
      escape: (word) => mappings.get(word) ?? word,
      isReserved: (word) => mappings.has(word),
    };
  }

  public put(reservedWord: string, conversion: string): this {
    this._mappings.set(reservedWord, conversion);
    return this;
  }

  public addWords(words: Iterable<string>, escaper: (word: string) => string = (word) => "_" + word): this {
    for (const word of words) {
      this.put(word, escaper(word));
    }
    return this;
  }
}

interface EscaperOptions {
  filenameReservedWords?: ReservedWords;
  namespaceReservedWords?: ReservedWords;
  nameReservedWords?: ReservedWords;
  memberReservedWords?: ReservedWords;
  escapePredicate?: (shape: Shape, symbol: Symbol) => boolean;
}

/**
 * Escapes reserved words in the names, namespaces and files of symbols.
 *
 * @internal
 */
export class ReservedWordEscaper {
  private readonly _filename: ReservedWords;
  private readonly _namespace: ReservedWords;
  private readonly _name: ReservedWords;
  private readonly _member: ReservedWords;
  private readonly _escapePredicate: (shape: Shape, symbol: Symbol) => boolean;

  public constructor(options: EscaperOptions) {
    this._filename = options.filenameReservedWords ?? IDENTITY;
    this._namespace = options.namespaceReservedWords ?? IDENTITY;
    this._name = options.nameReservedWords ?? IDENTITY;
    this._member = options.memberReservedWords ?? IDENTITY;
    this._escapePredicate = options.escapePredicate ?? (() => true);
  }

  public escapeSymbol(shape: Shape, symbol: Symbol): Symbol {
    if (!this._escapePredicate(shape, symbol)) {
      return symbol;
    }
    const newName = this._convert(symbol.getName(), this._name);
    const newNamespace = this._convert(symbol.getNamespace(), this._namespace);
    const newDeclarationFile = this._convert(symbol.getDeclarationFile(), this._filename);
    const newDefinitionFile = this._convert(symbol.getDefinitionFile(), this._filename);
    if (
      newName === symbol.getName() &&
      newNamespace === symbol.getNamespace() &&
      newDeclarationFile === symbol.getDeclarationFile() &&
      newDefinitionFile === symbol.getDeclarationFile()
    ) {
      return symbol;
    }
    return symbol
      .toBuilder()
      .name(newName)
      .namespace(newNamespace, symbol.getNamespaceDelimiter())
      .declarationFile(newDeclarationFile)
      .definitionFile(newDefinitionFile)
      .build();
  }

  public escapeMemberName(memberName: string): string {
    return this._convert(memberName, this._member);
  }

  private _convert(word: string, reservedWords: ReservedWords): string {
    return reservedWords.isReserved(word) ? reservedWords.escape(word) : word;
  }
}

export type { MemberShape };
