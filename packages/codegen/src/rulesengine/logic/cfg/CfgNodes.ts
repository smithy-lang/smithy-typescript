import { type Condition, NoMatchRule, type Rule } from "../../language";

export abstract class CfgNode {}

/**
 * A condition together with whether the CFG tests its negation.
 */
export class ConditionReference {
  public constructor(
    private readonly _condition: Condition,
    private readonly _negated: boolean
  ) {}

  public isNegated(): boolean {
    return this._negated;
  }

  public negate(): ConditionReference {
    return new ConditionReference(this._condition, !this._negated);
  }

  public getCondition(): Condition {
    return this._condition;
  }

  public key(): string {
    return (this._negated ? "!" : "") + this._condition.key();
  }
}

export class ConditionNode extends CfgNode {
  public constructor(
    private readonly _condition: ConditionReference,
    private readonly _trueBranch: CfgNode,
    private readonly _falseBranch: CfgNode
  ) {
    super();
  }

  public getCondition(): ConditionReference {
    return this._condition;
  }

  public getTrueBranch(): CfgNode {
    return this._trueBranch;
  }

  public getFalseBranch(): CfgNode {
    return this._falseBranch;
  }
}

export class ResultNode extends CfgNode {
  private static readonly _TERMINAL = new ResultNode(NoMatchRule.INSTANCE);

  public constructor(private readonly _result: Rule) {
    super();
  }

  public static terminal(): ResultNode {
    return ResultNode._TERMINAL;
  }

  public getResult(): Rule {
    return this._result;
  }
}
