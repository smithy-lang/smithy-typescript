import type { Condition, Rule } from "../../language";
import type { Cfg } from "../cfg/Cfg";
import type { Bdd } from "./Bdd";
import type { BddBuilder } from "./BddBuilder";
import { BddCompiler } from "./BddCompiler";
import { FixedOrdering } from "./OrderingStrategy";

interface BddCompilationResult {
  bdd: Bdd;
  results: Rule[];
}

/**
 * Shared helpers for the BDD optimization passes.
 */
export class BddCompilerSupport {
  public static compile(cfg: Cfg, ordering: Condition[], builder: BddBuilder): BddCompilationResult {
    builder.reset();
    const compiler = new BddCompiler(cfg, new FixedOrdering(ordering), builder);
    const bdd = compiler.compile();
    return { bdd, results: compiler.getIndexedResults() };
  }

  public static nodeCount(bdd: Bdd): number {
    return bdd.getNodeCount() - 1;
  }

  public static move(order: Condition[], from: number, to: number): void {
    if (from === to) {
      return;
    }
    const moving = order[from];
    if (from < to) {
      order.copyWithin(from, from + 1, to + 1);
    } else {
      order.copyWithin(to + 1, to, from);
    }
    order[to] = moving;
  }
}
