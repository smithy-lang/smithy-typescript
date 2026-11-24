import { EndpointBddTrait as EndpointBddModelTrait, EndpointRuleSetTrait, type Model } from "../../model";
import {
  Condition,
  EndpointRuleSet,
  type JsonNode,
  type JsonObjectNode,
  NoMatchRule,
  Parameters,
  Rule,
} from "../../rulesengine/language";
import { Bdd } from "../../rulesengine/logic/bdd/Bdd";
import { CostOptimization } from "../../rulesengine/logic/bdd/CostOptimization";
import { NodeReversal } from "../../rulesengine/logic/bdd/NodeReversal";
import { SiftingOptimization } from "../../rulesengine/logic/bdd/SiftingOptimization";
import { Cfg } from "../../rulesengine/logic/cfg/Cfg";
import { EndpointBddTrait } from "../../rulesengine/traits/EndpointBddTrait";
import type { TypeScriptSettings } from "../TypeScriptSettings";

/**
 * Produces the endpoint BDD for a service, either decoded from its trait or compiled from its rule set.
 */
export class ConvertBdd {
  public static forService(model: Model, settings: TypeScriptSettings): EndpointBddTrait {
    const service = settings.getService(model);
    const existing = service.getTrait(EndpointBddModelTrait);
    if (existing !== undefined) {
      return ConvertBdd._decode(existing.toNode() as JsonObjectNode);
    }
    return ConvertBdd.convert(model, settings);
  }

  public static convert(model: Model, settings: TypeScriptSettings): EndpointBddTrait {
    const service = settings.getService(model);
    const ruleSetTrait = service.getTrait(EndpointRuleSetTrait);
    if (ruleSetTrait === undefined) {
      throw new Error("Expected the service to have an endpointRuleSet trait");
    }
    const ruleSet = EndpointRuleSet.fromNode(ruleSetTrait.getRuleSet() as JsonNode);
    const cfg = Cfg.from(ruleSet);
    let trait = EndpointBddTrait.from(cfg);
    trait = new SiftingOptimization({ cfg }).apply(trait);
    trait = new CostOptimization({ cfg }).apply(trait);
    return new NodeReversal().apply(trait);
  }

  private static _decode(node: JsonObjectNode): EndpointBddTrait {
    const conditions = (node.conditions as JsonNode[]).map((condition) => Condition.fromNode(condition));
    const results: Rule[] = [NoMatchRule.INSTANCE];
    for (const result of node.results as JsonNode[]) {
      results.push(Rule.fromNode(result));
    }
    const nodeCount = node.nodeCount as number;
    const bytes = Buffer.from(node.nodes as string, "base64");
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const nodes: number[] = [];
    for (let i = 0; i < nodeCount * 3; i++) {
      nodes.push(view.getInt32(i * 4));
    }
    const bdd = new Bdd(node.root as number, conditions.length, results.length, nodeCount, nodes);
    return new EndpointBddTrait(
      node.version as string,
      new Parameters(node.parameters as JsonObjectNode),
      conditions,
      results,
      bdd
    );
  }
}
