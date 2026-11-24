import { type FileManifest, type SymbolDependency, type SymbolProvider, WriterDelegator } from "../codegen-core";
import { TypeScriptDependency } from "./TypeScriptDependency";
import type { TypeScriptWriter } from "./TypeScriptWriter";
import { TypeScriptWriterFactory } from "./TypeScriptWriter";

/**
 * Delegates to writers per file and always includes the unconditional dependencies.
 *
 * @internal
 */
export class TypeScriptDelegator extends WriterDelegator<TypeScriptWriter> {
  public constructor(fileManifest: FileManifest, symbolProvider: SymbolProvider) {
    super(fileManifest, symbolProvider, TypeScriptWriterFactory);
  }

  public getDependencies(): SymbolDependency[] {
    const resolved = TypeScriptDependency.getUnconditionalDependencies();
    resolved.push(...super.getDependencies());
    return resolved;
  }
}
