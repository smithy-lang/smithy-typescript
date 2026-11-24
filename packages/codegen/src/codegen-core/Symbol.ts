import type { SymbolContainer } from "./SymbolContainer";
import { SymbolDependency } from "./SymbolDependency";
import type { SymbolDependencyContainer } from "./SymbolDependencyContainer";
import { SymbolReference } from "./SymbolReference";
import { mapsEqual, TypedPropertiesBag, TypedPropertiesBagBuilder, valuesEqual } from "./TypedPropertiesBag";

/**
 * A named, namespaced entity in generated code.
 *
 * @internal
 */
export class Symbol extends TypedPropertiesBag implements SymbolContainer, SymbolDependencyContainer {
  private readonly _namespace: string;
  private readonly _namespaceDelimiter: string;
  private readonly _name: string;
  private readonly _definitionFile: string;
  private readonly _declarationFile: string;
  private readonly _references: SymbolReference[];
  private readonly _dependencies: SymbolDependency[];

  public constructor(builder: SymbolBuilder) {
    super(builder);
    this._namespace = builder.getNamespace();
    this._namespaceDelimiter = builder.getNamespaceDelimiter();
    this._name = builder.getName() as string;
    this._declarationFile = builder.getDeclarationFile();
    this._definitionFile = builder.getDefinitionFile().length > 0 ? builder.getDefinitionFile() : this._declarationFile;
    this._references = builder.getReferences().slice();
    this._dependencies = builder.getDependencies().slice();
  }

  public static builder(): SymbolBuilder {
    return new SymbolBuilder();
  }

  public getNamespace(): string {
    return this._namespace;
  }

  public getNamespaceDelimiter(): string {
    return this._namespaceDelimiter;
  }

  public getName(): string {
    return this._name;
  }

  public getDeclarationFile(): string {
    return this._declarationFile;
  }

  public getDefinitionFile(): string {
    return this._definitionFile;
  }

  public relativize(namespace: string): string {
    return this._namespace === namespace ? this._name : this.toString();
  }

  public getReferences(): SymbolReference[] {
    return this._references;
  }

  public getDependencies(): SymbolDependency[] {
    return this._dependencies;
  }

  public getSymbols(): Symbol[] {
    return [this];
  }

  public toBuilder(): SymbolBuilder {
    return new SymbolBuilder()
      .namespace(this._namespace, this._namespaceDelimiter)
      .name(this._name)
      .setProperties(this.getProperties())
      .definitionFile(this._definitionFile)
      .declarationFile(this._declarationFile)
      .references(this._references)
      .dependencies(this._dependencies);
  }

  public toString(): string {
    return this._namespace.length === 0 ? this._name : this._namespace + this._namespaceDelimiter + this._name;
  }

  public equals(o: unknown): boolean {
    if (this === o) {
      return true;
    }
    return (
      o instanceof Symbol &&
      super.equals(o) &&
      this._namespace === o._namespace &&
      this._namespaceDelimiter === o._namespaceDelimiter &&
      this._name === o._name &&
      mapsEqual(this.getProperties(), o.getProperties()) &&
      this._declarationFile === o._declarationFile &&
      this._definitionFile === o._definitionFile &&
      valuesEqual(this._references, o._references) &&
      valuesEqual(this._dependencies, o._dependencies)
    );
  }
}

/**
 * @internal
 */
export class SymbolBuilder extends TypedPropertiesBagBuilder<SymbolBuilder> {
  private _name: string | undefined;
  private _namespace = "";
  private _namespaceDelimiter = "";
  private _definitionFile = "";
  private _declarationFile = "";
  private _references: SymbolReference[] = [];
  private _dependencies: SymbolDependency[] = [];

  public build(): Symbol {
    return new Symbol(this);
  }

  public name(name: string): this {
    this._name = name;
    return this;
  }

  public namespace(namespace: string | null | undefined, namespaceDelimiter: string | null | undefined): this {
    this._namespace = namespace ?? "";
    this._namespaceDelimiter = namespaceDelimiter ?? "";
    return this;
  }

  public definitionFile(definitionFile: string): this {
    this._definitionFile = definitionFile;
    return this;
  }

  public declarationFile(declarationFile: string): this {
    this._declarationFile = declarationFile;
    return this;
  }

  public references(references: SymbolReference[]): this {
    this._references = [];
    references.forEach((r) => this.addReference(r));
    return this;
  }

  public addReference(reference: Symbol | SymbolReference): this {
    this._references.push(reference instanceof SymbolReference ? reference : new SymbolReference(reference));
    return this;
  }

  public dependencies(dependencies: SymbolDependency[] | SymbolDependencyContainer): this {
    this._dependencies = [];
    if (Array.isArray(dependencies)) {
      dependencies.forEach((d) => this.addDependency(d));
      return this;
    }
    return this.addDependency(dependencies);
  }

  public addDependency(dependency: SymbolDependencyContainer): this;
  public addDependency(packageName: string, version: string): this;
  public addDependency(dependencyType: string | null, packageName: string, version: string): this;
  public addDependency(first: SymbolDependencyContainer | string | null, second?: string, third?: string): this {
    if (typeof first === "object" && first !== null) {
      this._dependencies.push(...first.getDependencies());
      return this;
    }
    const hasType = third !== undefined;
    return this.addDependency(
      SymbolDependency.builder()
        .dependencyType(hasType ? first : null)
        .packageName((hasType ? second : first) as string)
        .version((hasType ? third : second) as string)
        .build()
    );
  }

  public getName(): string | undefined {
    return this._name;
  }

  public getNamespace(): string {
    return this._namespace;
  }

  public getNamespaceDelimiter(): string {
    return this._namespaceDelimiter;
  }

  public getDefinitionFile(): string {
    return this._definitionFile;
  }

  public getDeclarationFile(): string {
    return this._declarationFile;
  }

  public getReferences(): SymbolReference[] {
    return this._references;
  }

  public getDependencies(): SymbolDependency[] {
    return this._dependencies;
  }
}
