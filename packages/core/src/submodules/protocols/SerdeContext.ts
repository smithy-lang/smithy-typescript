import type { ConfigurableSerdeContext, SerdeFunctions } from "@smithy/types";

/**
 * @internal
 */
export abstract class SerdeContext implements ConfigurableSerdeContext {
  protected serdeContext?: SerdeFunctions;

  public setSerdeContext(serdeContext: SerdeFunctions): void {
    this.serdeContext = serdeContext;
  }
}
