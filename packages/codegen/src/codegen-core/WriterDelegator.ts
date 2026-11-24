import { posix } from "node:path";
import { TreeMap } from "../model/utils/TreeMap";

import type { CodeInterceptor } from "./CodeInterceptor";
import type { FileManifest } from "./FileManifest";
import type { ImportContainer } from "./ImportContainer";
import type { Shape } from "./ModelTypes";
import type { Symbol } from "./Symbol";
import type { SymbolDependency } from "./SymbolDependency";
import type { SymbolDependencyContainer } from "./SymbolDependencyContainer";
import type { SymbolProvider } from "./SymbolProvider";
import { ContextOption } from "./SymbolReference";
import type { SymbolWriter, SymbolWriterFactory } from "./SymbolWriter";

/**
 * Creates and tracks one writer per file.
 *
 * @internal
 */
export class WriterDelegator<W extends SymbolWriter<W, ImportContainer>> implements SymbolDependencyContainer {
  private readonly _fileManifest: FileManifest;
  private readonly _symbolProvider: SymbolProvider;
  private readonly _writers = new TreeMap<string, W>();
  private readonly _factory: SymbolWriterFactory<W>;
  private _interceptors: CodeInterceptor<any, W>[] = [];
  private _automaticSeparator = "\n";

  public constructor(fileManifest: FileManifest, symbolProvider: SymbolProvider, factory: SymbolWriterFactory<W>) {
    this._fileManifest = fileManifest;
    this._symbolProvider = symbolProvider;
    this._factory = factory;
  }

  public setInterceptors(interceptors: CodeInterceptor<any, W>[]): void {
    this._interceptors = interceptors.slice();
  }

  public getDependencies(): SymbolDependency[] {
    const resolved: SymbolDependency[] = [];
    for (const writer of this._writers.values()) {
      resolved.push(...writer.getDependencies());
    }
    return resolved;
  }

  public flushWriters(): void {
    for (const [filename, writer] of this.getWriters()) {
      this._fileManifest.writeFile(filename, writer.toString());
    }
    this._writers.clear();
  }

  public getWriters(): Map<string, W> {
    return new Map(this._writers);
  }

  public useFileWriter(filename: string, writerConsumer: (writer: W) => void): void;
  public useFileWriter(filename: string, namespace: string, writerConsumer: (writer: W) => void): void;
  public useFileWriter(
    filename: string,
    namespaceOrConsumer: string | ((writer: W) => void),
    maybeConsumer?: (writer: W) => void
  ): void {
    const namespace = typeof namespaceOrConsumer === "string" ? namespaceOrConsumer : "";
    const consumer = (typeof namespaceOrConsumer === "string" ? maybeConsumer : namespaceOrConsumer) as (
      writer: W
    ) => void;
    consumer(this._checkoutWriter(filename, namespace));
  }

  public useSymbolWriter(symbol: Symbol, writerConsumer: (writer: W) => void): void {
    const writer = this._checkoutWriter(symbol.getDefinitionFile(), symbol.getNamespace());
    writer.addImportReferences(symbol, ContextOption.DECLARE);
    symbol.getDependencies().forEach((d) => writer.addDependency(d));
    writer.pushState();
    writerConsumer(writer);
    writer.popState();
  }

  public useShapeWriter(shape: Shape, writerConsumer: (writer: W) => void): void {
    this.useSymbolWriter(this._symbolProvider.toSymbol(shape), writerConsumer);
  }

  private _checkoutWriter(filename: string, namespace: string): W {
    const formattedFilename = posix.normalize(filename.replace(/\\/g, "/"));
    let writer = this._writers.get(formattedFilename);
    const needsNewline = writer !== undefined;
    if (writer === undefined) {
      writer = this._factory(formattedFilename, namespace);
      for (const interceptor of this._interceptors) {
        writer.onSection(interceptor);
      }
      this._writers.set(formattedFilename, writer);
    }
    if (needsNewline) {
      writer.writeInline(this._automaticSeparator);
    }
    return writer;
  }
}
