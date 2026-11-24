import { TreeMap } from "../model/utils/TreeMap";
import { CodegenException } from "./CodegenException";
import type { SymbolDependencyContainer } from "./SymbolDependencyContainer";
import { TypedPropertiesBag, TypedPropertiesBagBuilder } from "./TypedPropertiesBag";

/**
 * A dependency required by a symbol, such as an npm package.
 *
 * @internal
 */
export class SymbolDependency extends TypedPropertiesBag implements SymbolDependencyContainer {
  private readonly _dependencyType: string;
  private readonly _packageName: string;
  private readonly _version: string;

  private constructor(builder: SymbolDependencyBuilder) {
    super(builder);
    this._dependencyType = builder.getDependencyType() ?? "";
    if (builder.getPackageName() === undefined) {
      throw new Error("packageName is required");
    }
    if (builder.getVersion() === undefined) {
      throw new Error("version is required");
    }
    this._packageName = builder.getPackageName() as string;
    this._version = builder.getVersion() as string;
  }

  public static builder(): SymbolDependencyBuilder {
    return new SymbolDependencyBuilder((b) => new SymbolDependency(b));
  }

  public static gatherDependencies(
    dependencies: Iterable<SymbolDependency>,
    versionMergeFunction?: (a: SymbolDependency, b: SymbolDependency) => SymbolDependency
  ): Map<string, Map<string, SymbolDependency>> {
    const merge =
      versionMergeFunction ??
      ((a: SymbolDependency, b: SymbolDependency): SymbolDependency => {
        throw new CodegenException(
          `Found a conflicting \`${a.getDependencyType()}\` dependency for \`${a.getPackageName()}\`: ` +
            `\`${a.getVersion()}\` conflicts with \`${b.getVersion()}\``
        );
      });

    const sorted = Array.from(dependencies).sort((a, b) => a.compareTo(b));
    const byType = new TreeMap<string, Map<string, SymbolDependency>>();
    for (const dependency of sorted) {
      let packages = byType.get(dependency.getDependencyType());
      if (packages === undefined) {
        packages = new TreeMap();
        byType.set(dependency.getDependencyType(), packages);
      }
      const existing = packages.get(dependency.getPackageName());
      if (existing === undefined) {
        packages.set(dependency.getPackageName(), dependency);
      } else if (existing.getVersion() === dependency.getVersion()) {
        packages.set(dependency.getPackageName(), dependency);
      } else {
        packages.set(dependency.getPackageName(), merge(existing, dependency));
      }
    }

    return byType;
  }

  public getDependencyType(): string {
    return this._dependencyType;
  }

  public getPackageName(): string {
    return this._packageName;
  }

  public getVersion(): string {
    return this._version;
  }

  public getDependencies(): SymbolDependency[] {
    return [this];
  }

  public toString(): string {
    return (
      "SymbolDependency{" +
      `dependencyType='${this._dependencyType}', packageName='${this._packageName}', version='${this._version}'}`
    );
  }

  public equals(o: unknown): boolean {
    if (this === o) {
      return true;
    }
    return (
      o instanceof SymbolDependency &&
      super.equals(o) &&
      this._dependencyType === o._dependencyType &&
      this._packageName === o._packageName &&
      this._version === o._version
    );
  }

  public compareTo(other: SymbolDependency): number {
    return (
      compareStrings(this._dependencyType, other._dependencyType) ||
      compareStrings(this._packageName, other._packageName) ||
      compareStrings(this._version, other._version)
    );
  }
}

class SymbolDependencyBuilder extends TypedPropertiesBagBuilder<SymbolDependencyBuilder> {
  private _dependencyType: string | undefined = "";
  private _packageName: string | undefined;
  private _version: string | undefined;
  private readonly _factory: (b: SymbolDependencyBuilder) => SymbolDependency;

  public constructor(factory: (b: SymbolDependencyBuilder) => SymbolDependency) {
    super();
    this._factory = factory;
  }

  public build(): SymbolDependency {
    return this._factory(this);
  }

  public dependencyType(dependencyType: string | null | undefined): this {
    this._dependencyType = dependencyType ?? undefined;
    return this;
  }

  public packageName(packageName: string): this {
    this._packageName = packageName;
    return this;
  }

  public version(version: string): this {
    this._version = version;
    return this;
  }

  public getDependencyType(): string | undefined {
    return this._dependencyType;
  }

  public getPackageName(): string | undefined {
    return this._packageName;
  }

  public getVersion(): string | undefined {
    return this._version;
  }
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
