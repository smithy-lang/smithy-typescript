import { CodegenException, type ImportContainer, type Symbol } from "../codegen-core";
import { compareCodeUnits, TreeMap, TreeSet } from "../model";

export const LINE_WIDTH = 120;

/**
 * Aggregates the imports of a file and renders them.
 */
export class ImportDeclarations implements ImportContainer {
  private readonly _moduleNameString: string;
  private readonly _relativize: string;
  private readonly _defaultImports = new TreeMap<string, DefaultImport>();
  private readonly _namedImports = new TreeMap<string, Map<string, string>>();
  private readonly _namedTypeImports = new TreeMap<string, Map<string, string>>();

  public constructor(relativize: string) {
    relativize = relativize.replace(/\\/g, "/");
    if (!relativize.startsWith("./")) {
      relativize = "./" + relativize;
    }
    this._moduleNameString = relativize;
    const lastSlash = relativize.lastIndexOf("/");
    this._relativize = lastSlash === -1 ? "" : relativize.slice(0, lastSlash);
  }

  public addIgnoredDefaultImport(name: string, module: string, reason: string): this {
    return this._addDefaultImport(name, module, reason);
  }

  public addImport(name: string, alias: string | null | undefined, module: string): this {
    this._addNamed(this._namedImports, name, alias, module);
    return this;
  }

  public addTypeImport(name: string, alias: string | null | undefined, module: string): this {
    this._addNamed(this._namedTypeImports, name, alias, module);
    return this;
  }

  public importSymbol(symbol: Symbol, alias: string = symbol.getName()): void {
    if (symbol.getNamespace().length > 0 && symbol.getNamespace() !== this._moduleNameString) {
      if (symbol.getProperty<boolean>("typeOnly") === true) {
        this.addTypeImport(symbol.getName(), alias, symbol.getNamespace());
      } else {
        this.addImport(symbol.getName(), alias, symbol.getNamespace());
      }
    }
  }

  public toString(): string {
    let result = "";

    if (this._defaultImports.size > 0) {
      for (const [module, entry] of this._defaultImports) {
        const ignore = entry.ignoreReason !== null;
        if (ignore) {
          result += "// @ts-ignore: " + entry.ignoreReason + "\n";
        }
        result += `import ${entry.name} from "${module}";`;
        if (ignore) {
          result += " // eslint-disable-line";
        }
        result += "\n";
      }
      result += "\n";
    }

    return result + createImports(this._namedImports, this._namedTypeImports);
  }

  private _addDefaultImport(name: string, module: string, ignoreReason: string | null): this {
    module = getRelativizedModule(this._relativize, module);
    if (module.length > 0 && module !== this._relativize) {
      this._defaultImports.set(module, { name, ignoreReason });
    }
    return this;
  }

  private _addNamed(
    target: Map<string, Map<string, string>>,
    name: string,
    alias: string | null | undefined,
    module: string
  ): void {
    if (alias === null || alias === undefined || alias.length === 0) {
      alias = name;
    }
    module = getRelativizedModule(this._relativize, module);
    if (module.length > 0 && module !== this._relativize) {
      let aliases = target.get(module);
      if (aliases === undefined) {
        aliases = new TreeMap();
        target.set(module, aliases);
      }
      aliases.set(alias, name);
    }
  }
}

interface DefaultImport {
  name: string;
  ignoreReason: string | null;
}

const TYPE_OR_ALIAS = /(^type )| as (.*?)$/g;

/**
 * External package first, relative last, otherwise by case-insensitive alphabetical ordering.
 */
function compareModules(a: string, b: string): number {
  const aRelative = a.startsWith(".");
  const bRelative = b.startsWith(".");
  if (aRelative && !bRelative) {
    return 1;
  }
  if (!aRelative && bRelative) {
    return -1;
  }
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();
  if (aLower === bLower) {
    return compareCodeUnits(a, b);
  }
  return compareCodeUnits(aLower, bLower);
}

/**
 * Type imports first, otherwise by symbol name, case-insensitively, ignoring alias.
 */
function compareImports(a: string, b: string): number {
  const aType = a.startsWith("type ");
  const bType = b.startsWith("type ");
  if (aType && !bType) {
    return -1;
  }
  if (!aType && bType) {
    return 1;
  }
  const normalA = a.replace(TYPE_OR_ALIAS, "").toLowerCase();
  const normalB = b.replace(TYPE_OR_ALIAS, "").toLowerCase();
  if (normalA === normalB) {
    return compareCodeUnits(a, b);
  }
  return compareCodeUnits(normalA, normalB);
}

function createImports(
  namedImports: Map<string, Map<string, string>>,
  namedTypeImports: Map<string, Map<string, string>>
): string {
  const mergedModuleKeys = new TreeSet([...namedImports.keys(), ...namedTypeImports.keys()], compareModules);

  let separatorIndex = 0;
  for (const key of mergedModuleKeys) {
    if (!key.startsWith(".")) {
      separatorIndex++;
    }
  }
  const needsSeparator = separatorIndex > 0 && separatorIndex < mergedModuleKeys.size;

  let buffer = "";
  let i = 0;
  for (const module of mergedModuleKeys) {
    if (i++ === separatorIndex && needsSeparator) {
      buffer += "\n";
    }
    const moduleImports = namedImports.get(module);
    const typeImports = namedTypeImports.get(module);

    const mergedSymbolKeys = new TreeSet([...(moduleImports?.keys() ?? []), ...(typeImports?.keys() ?? [])]);

    const importSet = new TreeSet<string>(null, compareImports);
    for (const alias of mergedSymbolKeys) {
      const runtimeSymbol = moduleImports?.get(alias);
      const typeSymbol = typeImports?.get(alias);

      if (runtimeSymbol === "*" || typeSymbol === "*") {
        throw new CodegenException(
          `Star imports are not supported, attempted for ${module}. Use default import instead.`
        );
      }

      if (runtimeSymbol !== undefined) {
        importSet.add(alias !== runtimeSymbol ? `${runtimeSymbol} as ${alias}` : runtimeSymbol);
      } else if (typeSymbol !== undefined) {
        importSet.add(alias !== typeSymbol ? `type ${typeSymbol} as ${alias}` : "type " + typeSymbol);
      }
    }
    const imports = [...importSet];

    if (imports.length > 0) {
      const allImportsAreTypes = imports.every((s) => s.startsWith("type "));
      const tail = '";\n';

      let inlineHead = "import { ";
      let inlineSymbols = imports.join(", ");
      if (allImportsAreTypes) {
        inlineHead = inlineHead.replace("import ", "import type ");
        inlineSymbols = inlineSymbols.replace(/type /g, "");
      }
      const inline = inlineHead + inlineSymbols + ' } from "' + module + tail;

      if (inline.trim().length <= LINE_WIDTH) {
        buffer += inline;
      } else {
        let head = "import {\n  ";
        let symbols = imports.join(",\n  ");
        if (allImportsAreTypes) {
          head = head.replace("import ", "import type ");
          symbols = symbols.replace(/type /g, "");
        }
        buffer += head + symbols + ',\n} from "' + module + tail;
      }
    }
  }

  if (namedImports.size > 0 || namedTypeImports.size > 0) {
    buffer += "\n";
  }
  return buffer;
}

/**
 * Names of a path with `.` segments removed and inner `..` segments resolved.
 */
function pathNames(path: string): string[] {
  const names: string[] = [];
  for (const segment of path.split("/")) {
    if (segment.length === 0 || segment === ".") {
      continue;
    }
    if (segment === ".." && names.length > 0 && names[names.length - 1] !== "..") {
      names.pop();
    } else {
      names.push(segment);
    }
  }
  return names;
}

function javaRelativize(from: string, to: string): string {
  const fromNames = pathNames(from);
  const toNames = pathNames(to);
  let common = 0;
  while (common < fromNames.length && common < toNames.length && fromNames[common] === toNames[common]) {
    common++;
  }
  const result: string[] = [];
  for (let i = common; i < fromNames.length; i++) {
    result.push("..");
  }
  for (let i = common; i < toNames.length; i++) {
    result.push(toNames[i]);
  }
  return result.join("/");
}

function getRelativizedModule(relativize: string, module: string): string {
  if (module.startsWith(".")) {
    module = javaRelativize(relativize, module);
    if (!module.startsWith(".")) {
      module = "./" + module;
    }
  }
  return module;
}
