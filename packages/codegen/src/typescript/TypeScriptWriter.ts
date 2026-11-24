import {
  CodegenException,
  ContextOption,
  StringUtils,
  Symbol,
  SymbolReference,
  SymbolWriter,
  type SymbolWriterFactory,
} from "../codegen-core";
import { type Dependency, isDependency } from "./Dependency";
import { ImportDeclarations, LINE_WIDTH } from "./ImportDeclarations";
import type { PackageContainer } from "./PackageContainer";
import { ImportFrom } from "./validation/ImportFrom";

interface DeprecationInfo {
  getMessage(): string | undefined;
  getSince(): string | undefined;
}

/**
 * The documentation-relevant view of a shape, supplied by the caller from its trait lookups.
 *
 * @internal
 */
export interface DocumentedShape {
  getDocumentation(): string | undefined;
  getDeprecation(): DeprecationInfo | undefined;
  isInternal(): boolean;
}

type ImportSource = PackageContainer | string;

/**
 * Specialized code writer for managing TypeScript imports and dependencies.
 *
 * @internal
 */
export class TypeScriptWriter extends SymbolWriter<TypeScriptWriter, ImportDeclarations> {
  public static readonly CODEGEN_INDICATOR = "// smithy-typescript generated code\n";
  public static readonly LINE_WIDTH = LINE_WIDTH;

  private readonly _moduleName: string;
  private readonly _withAttribution: boolean;

  public constructor(moduleName: string, withAttribution = true) {
    super(new ImportDeclarations(moduleName));
    this._moduleName = moduleName;
    this._withAttribution = withAttribution;

    this.setIndentText("  ");
    this.trimTrailingSpaces(true);
    this.trimBlankLines();
    this.putFormatter("T", (type) => this._formatTypeScriptSymbol(type));
  }

  public static buildDeprecationAnnotation(deprecation: DeprecationInfo): string {
    let annotation = "@deprecated";
    const message = deprecation.getMessage() ?? null;
    const since = deprecation.getSince() ?? null;

    if (message !== null && since !== null) {
      annotation += ` (since ${since}) ` + message;
    } else if (message !== null) {
      annotation += " " + message;
    } else if (since !== null) {
      annotation += ` since ${since}`;
    } else {
      annotation += " deprecated";
    }

    return TypeScriptWriter.punctuate(annotation);
  }

  public static punctuate(s: string): string {
    const state = s.trim();
    if (/^(.*?)\w$/.test(state)) {
      return state + ".";
    }
    return s;
  }

  public getModuleName(): string {
    return this._moduleName;
  }

  public addIgnoredDefaultImport(name: string, from: string, reason: string): this {
    this.getImportContainer().addIgnoredDefaultImport(name, from, reason);
    return this;
  }

  public addImport(name: string, as: string | null | undefined, from: ImportSource): this;
  public addImport(symbol: Symbol, alias: string, ...options: ContextOption[]): this;
  public addImport(first: string | Symbol, second: string | null | undefined, ...rest: unknown[]): this {
    if (first instanceof Symbol) {
      return super.addImport(first, second as string, ...(rest as ContextOption[]));
    }
    const from = rest[0] as ImportSource;
    if (typeof from !== "string") {
      if (isDependency(from)) {
        this.addDependency(from);
      }
      return this._addStringImport(first, second, from.getPackageName(), false);
    }
    return this._addStringImport(first, second, from, false);
  }

  public addTypeImport(name: string, as: string | null | undefined, from: ImportSource): this {
    if (typeof from !== "string") {
      if (isDependency(from)) {
        this.addDependency(from as Dependency);
      }
      return this._addStringImport(name, as, from.getPackageName(), true);
    }
    return this._addStringImport(name, as, from, true);
  }

  public addImportSubmodule(
    name: string,
    as: string | null | undefined,
    from: PackageContainer,
    submodule: string
  ): this {
    if (isDependency(from)) {
      this.addDependency(from);
    }
    return this._addStringImport(name, as, from.getPackageName() + submodule, false);
  }

  public addTypeImportSubmodule(
    name: string,
    as: string | null | undefined,
    from: PackageContainer,
    submodule: string
  ): this {
    if (isDependency(from)) {
      this.addDependency(from);
    }
    return this._addStringImport(name, as, from.getPackageName() + submodule, true);
  }

  public addRelativeImport(name: string, as: string | null | undefined, from: string): this {
    return this._addStringImport(name, as, from.replace(/\\/g, "/"), false);
  }

  public addRelativeTypeImport(name: string, as: string | null | undefined, from: string): this {
    return this._addStringImport(name, as, from.replace(/\\/g, "/"), true);
  }

  public writeDocs(docs: string | (() => void)): this {
    if (typeof docs === "string") {
      const escaped = docs.replace(/\$/g, "$$$$").replace(/\*\//g, "*\\/");
      return this.writeDocs(() => this.write(escaped));
    }
    this.pushState("docs");
    this.write("/**");
    this.setNewlinePrefix(" * ");
    docs();
    this.setNewlinePrefix("");
    this.write(" */");
    this.popState();
    return this;
  }

  public openCollapsibleBlock(
    open: string,
    close: string,
    condition: boolean,
    ...argsAndRunnable: [...unknown[], () => void]
  ): this {
    const args = argsAndRunnable.slice(0, argsAndRunnable.length - 1);
    const runnable = argsAndRunnable[argsAndRunnable.length - 1] as () => void;
    if (condition) {
      this.openBlock(open, close, ...args, runnable);
    } else {
      this.write(open + close, ...args);
    }
    return this;
  }

  public writeShapeDocs(shape: DocumentedShape, preprocessor?: (docs: string) => string): boolean {
    if (preprocessor === undefined) {
      const didWrite = this.writeShapeDocs(shape, (docs) => docs);
      if (!didWrite) {
        this.writeDocs("@public");
      }
      return didWrite;
    }

    const documentation = shape.getDocumentation();
    const deprecation = shape.getDeprecation();
    if (documentation !== undefined || deprecation !== undefined) {
      let docs = this._buildDocs(documentation, deprecation);
      docs = preprocessor(docs);
      docs = addReleaseTag(shape, docs);
      this.writeDocs(docs);
      return true;
    }
    return false;
  }

  public writeMemberDocs(member: DocumentedShape): boolean {
    const documentation = member.getDocumentation();
    const deprecation = member.getDeprecation();
    if (documentation !== undefined || deprecation !== undefined) {
      const docs = addReleaseTag(member, this._buildDocs(documentation, deprecation));
      this.writeDocs(docs);
      return true;
    }
    return false;
  }

  public toString(): string {
    const contents = super.toString();
    const importString = this.getImportContainer().toString();
    const strippedContents = StringUtils.stripStart(contents, null);
    const strippedImportString = StringUtils.strip(importString, null);
    const attribution = this._withAttribution ? TypeScriptWriter.CODEGEN_INDICATOR : "";

    if (strippedImportString.length > 0 && strippedContents.startsWith("import ")) {
      return attribution + strippedImportString + "\n" + strippedContents;
    }

    return attribution + importString + contents;
  }

  private _buildDocs(documentation: string | undefined, deprecation: DeprecationInfo | undefined): string {
    let docs = documentation !== undefined ? documentation : "";
    docs = docs.replace(/\{/g, "\\{").replace(/\}/g, "\\}");

    if (deprecation !== undefined) {
      const deprecationAnnotation = TypeScriptWriter.buildDeprecationAnnotation(deprecation);
      if (documentation !== undefined) {
        docs = TypeScriptWriter.punctuate(docs) + "\n\n" + deprecationAnnotation;
      } else {
        docs = deprecationAnnotation;
      }
    }
    return docs;
  }

  private _addStringImport(name: string, as: string | null | undefined, from: string, typeOnly: boolean): this {
    this._checkImport(new ImportFrom(from), from);
    if (typeOnly) {
      this.getImportContainer().addTypeImport(name, as, from);
    } else {
      this.getImportContainer().addImport(name, as, from);
    }
    return this;
  }

  private _checkImport(importFrom: ImportFrom, from: string): void {
    if (importFrom.isDeclarablePackageImport()) {
      const packageName = importFrom.getPackageName();
      if (!this.getDependencies().some((d) => d.getPackageName() === packageName)) {
        throw new CodegenException(
          `The import ${from} does not correspond to a registered dependency.\n` +
            "TypeScriptWriter::addDependency() is required before ::addImport().\n"
        );
      }
    }
  }

  private _formatTypeScriptSymbol(type: unknown): string {
    if (type instanceof Symbol) {
      this.addUseImports(type);
      return type.getName();
    } else if (type instanceof SymbolReference) {
      this.addImport(type.getSymbol(), type.getAlias(), ContextOption.USE);
      return type.getAlias();
    }
    throw new CodegenException(
      "Invalid type provided to $T. Expected a Symbol or SymbolReference, but found `" + String(type) + "`"
    );
  }
}

/**
 * @internal
 */
export const TypeScriptWriterFactory: SymbolWriterFactory<TypeScriptWriter> = (filename: string) => {
  const withAttribution = filename.endsWith(".ts");
  const moduleName = withAttribution ? filename.slice(0, filename.length - 3) : filename;
  return new TypeScriptWriter(moduleName, withAttribution);
};

function addReleaseTag(shape: DocumentedShape, docs: string): string {
  return docs + (shape.isInternal() ? "\n@internal" : "\n@public");
}
