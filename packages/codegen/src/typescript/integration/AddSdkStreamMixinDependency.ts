import type { SymbolProvider } from "../../codegen-core";
import {
  BlobShape,
  type MemberShape,
  type Model,
  type OperationShape,
  StreamingTrait,
  TopDownIndex,
} from "../../model";
import { LanguageTarget } from "../LanguageTarget";
import { SmithyCoreSubmodules } from "../SmithyCoreSubmodules";
import { TypeScriptDependency } from "../TypeScriptDependency";
import type { TypeScriptSettings } from "../TypeScriptSettings";
import type { TypeScriptWriter } from "../TypeScriptWriter";
import { TypeScriptIntegration } from "./TypeScriptIntegration";

/**
 * Adds the sdkStreamMixin config for services that return streaming blobs.
 */
export class AddSdkStreamMixinDependency extends TypeScriptIntegration {
  public static hasStreamingBlobDeser(settings: TypeScriptSettings, model: Model, operation: OperationShape): boolean {
    const ioShapeToDeser = model
      .expectShape(settings.generateServerSdk() ? operation.getInputShape() : operation.getOutputShape())
      .asStructureShape()!;
    return ioShapeToDeser.members().some((member: MemberShape) => {
      const shape = model.expectShape(member.getTarget());
      return shape instanceof BlobShape && shape.hasTrait(StreamingTrait);
    });
  }

  public addConfigInterfaceFields(
    settings: TypeScriptSettings,
    model: Model,
    _symbolProvider: SymbolProvider,
    writer: TypeScriptWriter
  ): void {
    if (!this._hasStreamingBlobDeser(settings, model)) {
      return;
    }
    writer.addTypeImport("SdkStreamMixinInjector", "__SdkStreamMixinInjector", TypeScriptDependency.SMITHY_TYPES);
    writer.writeDocs(
      "The internal function that inject utilities to runtime-specific stream to help users consume the data\n@internal"
    );
    writer.write("sdkStreamMixin?: __SdkStreamMixinInjector;\n");
  }

  public getRuntimeConfigWriters(
    settings: TypeScriptSettings,
    model: Model,
    _symbolProvider: SymbolProvider,
    target: LanguageTarget
  ): Map<string, (writer: TypeScriptWriter) => void> {
    if (!this._hasStreamingBlobDeser(settings, model) || target !== LanguageTarget.SHARED) {
      return new Map();
    }
    return new Map([
      [
        "sdkStreamMixin",
        (writer) => {
          writer.addDependency(TypeScriptDependency.SMITHY_CORE);
          writer.addImportSubmodule(
            "sdkStreamMixin",
            null,
            TypeScriptDependency.SMITHY_CORE,
            SmithyCoreSubmodules.SERDE
          );
          writer.write("sdkStreamMixin");
        },
      ],
    ]);
  }

  private _hasStreamingBlobDeser(settings: TypeScriptSettings, model: Model): boolean {
    return TopDownIndex.of(model)
      .getContainedOperations(settings.getService(model))
      .some((operation) => AddSdkStreamMixinDependency.hasStreamingBlobDeser(settings, model, operation));
  }
}
