import type { EndpointBddTrait } from "../../traits/EndpointBddTrait";
import { Bdd } from "./Bdd";

/**
 * Reverses node order so that the root sits last in the node array.
 */
export class NodeReversal {
  public apply(trait: EndpointBddTrait): EndpointBddTrait {
    const reversed = NodeReversal.reverse(trait.getBdd());
    return reversed === trait.getBdd() ? trait : trait.withBdd(reversed);
  }

  public static reverse(bdd: Bdd): Bdd {
    const nodeCount = bdd.getNodeCount();
    if (nodeCount <= 2) {
      return bdd;
    }
    const oldToNew = new Array<number>(nodeCount).fill(0);
    for (let oldIdx = 1; oldIdx < nodeCount; oldIdx++) {
      oldToNew[oldIdx] = nodeCount - oldIdx;
    }
    const newRoot = NodeReversal._remapReference(bdd.getRootRef(), oldToNew);
    const nodes: number[] = [bdd.getVariable(0), bdd.getHigh(0), bdd.getLow(0)];
    for (let oldIdx = nodeCount - 1; oldIdx >= 1; oldIdx--) {
      nodes.push(
        bdd.getVariable(oldIdx),
        NodeReversal._remapReference(bdd.getHigh(oldIdx), oldToNew),
        NodeReversal._remapReference(bdd.getLow(oldIdx), oldToNew)
      );
    }
    return new Bdd(newRoot, bdd.getConditionCount(), bdd.getResultCount(), nodeCount, nodes);
  }

  private static _remapReference(ref: number, oldToNew: number[]): number {
    if (ref === 0) {
      return 0;
    } else if (ref === 1 || ref === -1) {
      return ref;
    } else if (ref >= Bdd.RESULT_OFFSET) {
      return ref;
    }
    const isComplemented = ref < 0;
    const oldIdx = Math.abs(ref) - 1;
    if (oldIdx >= oldToNew.length) {
      throw new Error("Invalid reference: " + ref);
    }
    const newRef = oldToNew[oldIdx] + 1;
    return isComplemented ? -newRef : newRef;
  }
}
