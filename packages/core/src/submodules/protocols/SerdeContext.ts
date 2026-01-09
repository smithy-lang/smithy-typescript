import type { ConfigurableSerdeContext, SerdeFunctions } from "@smithy/types";

/**
 * This in practice should be the client config object.
 * @internal
 */
type SerdeContextType = SerdeFunctions & {
  disableHostPrefix?: boolean;
};

/**
 * @internal
 */
export abstract class SerdeContext implements ConfigurableSerdeContext {
  protected serdeContext?: SerdeContextType;

  public setSerdeContext(serdeContext: SerdeContextType): void {
    this.serdeContext = serdeContext;
  }
}
