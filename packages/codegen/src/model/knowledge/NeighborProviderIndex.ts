import type { Model } from "../Model";
import type { NeighborProvider } from "../neighbor/NeighborProvider";
import { NeighborProviders } from "../neighbor/NeighborProvider";

/**
 * Caches the neighbor providers of a model.
 *
 * @internal
 */
export class NeighborProviderIndex {
  private readonly _model: Model;
  private readonly _provider: NeighborProvider;

  constructor(model: Model) {
    this._model = model;
    this._provider = NeighborProviders.precomputed(model);
  }

  public static of(model: Model): NeighborProviderIndex {
    return model.getKnowledge(NeighborProviderIndex);
  }

  public getProvider(): NeighborProvider {
    return this._provider;
  }
}
