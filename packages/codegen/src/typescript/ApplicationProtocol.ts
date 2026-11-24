import { Symbol, SymbolReference } from "../codegen-core";
import { TypeScriptDependency } from "./TypeScriptDependency";

/**
 * @internal
 */
export class ApplicationProtocol {
  private readonly _name: string;
  private readonly _optionsType: SymbolReference;
  private readonly _requestType: SymbolReference;
  private readonly _responseType: SymbolReference;

  public constructor(
    name: string,
    optionsType: SymbolReference,
    requestType: SymbolReference,
    responseType: SymbolReference
  ) {
    this._name = name;
    this._optionsType = optionsType;
    this._requestType = requestType;
    this._responseType = responseType;
  }

  public static createDefaultHttpApplicationProtocol(): ApplicationProtocol {
    return new ApplicationProtocol(
      "http",
      SymbolReference.builder()
        .symbol(ApplicationProtocol._createHttpSymbol(TypeScriptDependency.SMITHY_TYPES, "HttpHandlerOptions", true))
        .alias("__HttpHandlerOptions")
        .build(),
      SymbolReference.builder()
        .symbol(
          ApplicationProtocol._createHttpSymbol(
            TypeScriptDependency.SMITHY_CORE,
            "HttpRequest",
            true,
            "@smithy/core/protocols"
          )
        )
        .alias("__HttpRequest")
        .build(),
      SymbolReference.builder()
        .symbol(
          ApplicationProtocol._createHttpSymbol(
            TypeScriptDependency.SMITHY_CORE,
            "HttpResponse",
            true,
            "@smithy/core/protocols"
          )
        )
        .alias("__HttpResponse")
        .build()
    );
  }

  public getName(): string {
    return this._name;
  }

  public isHttpProtocol(): boolean {
    return this._name.startsWith("http");
  }

  public getOptionsType(): SymbolReference {
    return this._optionsType;
  }

  public equals(o: unknown): boolean {
    if (this === o) {
      return true;
    }
    if (!(o instanceof ApplicationProtocol)) {
      return false;
    }
    return (
      this._optionsType.equals(o._optionsType) &&
      this._requestType.equals(o._requestType) &&
      this._responseType.equals(o._responseType)
    );
  }

  private static _createHttpSymbol(
    dependency: TypeScriptDependency,
    symbolName: string,
    typeOnly: boolean,
    namespace: string = dependency.packageName
  ): Symbol {
    const builder = Symbol.builder()
      .namespace(namespace, "/")
      .name(symbolName)
      .addDependency(dependency)
      .addDependency(TypeScriptDependency.AWS_SDK_FETCH_HTTP_HANDLER)
      .addDependency(TypeScriptDependency.AWS_SDK_NODE_HTTP_HANDLER);
    if (typeOnly) {
      builder.putProperty("typeOnly", true);
    }
    return builder.build();
  }
}
