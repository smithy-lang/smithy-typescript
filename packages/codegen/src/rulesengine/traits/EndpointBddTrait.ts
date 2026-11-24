import type { Condition, Parameters, Rule } from "../language";
import type { Bdd } from "../logic/bdd/Bdd";
import { BddCompiler } from "../logic/bdd/BddCompiler";
import type { Cfg } from "../logic/cfg/Cfg";

/**
 * A compiled endpoint rule set: ordered conditions, indexed results and the BDD that connects them.
 */
export class EndpointBddTrait {
  public constructor(
    private readonly _version: string,
    private readonly _parameters: Parameters,
    private readonly _conditions: Condition[],
    private readonly _results: Rule[],
    private readonly _bdd: Bdd
  ) {}

  public static from(cfg: Cfg): EndpointBddTrait {
    const compiler = new BddCompiler(cfg);
    const bdd = compiler.compile();
    if (compiler.getOrderedConditions().length !== bdd.getConditionCount()) {
      throw new Error("Mismatch between BDD var count and orderedConditions size");
    }
    const version = cfg.getVersion() === "1.0" ? "1.1" : cfg.getVersion();
    return new EndpointBddTrait(
      version,
      cfg.getParameters(),
      compiler.getOrderedConditions(),
      compiler.getIndexedResults(),
      bdd
    );
  }

  public getVersion(): string {
    return this._version;
  }

  public getConditions(): Condition[] {
    return this._conditions;
  }

  public getResults(): Rule[] {
    return this._results;
  }

  public getBdd(): Bdd {
    return this._bdd;
  }

  public withBdd(bdd: Bdd): EndpointBddTrait {
    return new EndpointBddTrait(this._version, this._parameters, this._conditions, this._results, bdd);
  }

  public withOrdering(conditions: Condition[], results: Rule[], bdd: Bdd): EndpointBddTrait {
    return new EndpointBddTrait(this._version, this._parameters, conditions, results, bdd);
  }
}
