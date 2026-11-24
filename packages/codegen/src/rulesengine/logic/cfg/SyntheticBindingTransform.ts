import { Condition, type EndpointRuleSet, IsSet, LibraryFunction, type Rule, Type } from "../../language";
import { TreeMapper } from "./TreeMapper";

/**
 * Binds the result of every non-boolean function to a synthetic variable.
 */
export class SyntheticBindingTransform extends TreeMapper {
  private _syntheticCounter = 0;

  public static transform(ruleSet: EndpointRuleSet): EndpointRuleSet {
    return new SyntheticBindingTransform().endpointRuleSet(ruleSet);
  }

  public condition(_rule: Rule, condition: Condition): Condition {
    if (condition.getResult() !== undefined) {
      return condition;
    }
    const fn = condition.getFunction();
    if (fn instanceof IsSet) {
      const inner = fn.getArguments()[0];
      if (inner instanceof LibraryFunction) {
        return new Condition(inner, this._createSyntheticName(fn));
      }
      return condition;
    }
    if (fn.getFunctionDefinition().getReturnType() !== Type.booleanType()) {
      return condition.withResult(this._createSyntheticName(fn));
    }
    return condition;
  }

  private _createSyntheticName(fn: LibraryFunction): string {
    return "_synthetic_" + fn.getName() + "_" + this._syntheticCounter++;
  }
}
