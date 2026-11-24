import type { EndpointRuleSet, Expression, Rule } from "../../language";
import {
  Condition,
  Endpoint,
  EndpointRule,
  ErrorRule,
  FunctionNode,
  LibraryFunction,
  Literal,
  RecordLiteral,
  Reference,
  StringLiteral,
  Template,
  TreeRule,
  TupleLiteral,
} from "../../language";

/**
 * Rewrites a rule set tree. Subclasses override the hooks they care about.
 */
export class TreeMapper {
  public static newReferenceReplacingMapper(replacements: ReadonlyMap<string, Expression>): TreeMapper {
    if (replacements.size === 0) {
      return new TreeMapper();
    }
    return new ReferenceReplacingMapper(replacements);
  }

  public endpointRuleSet(ruleSet: EndpointRuleSet): EndpointRuleSet {
    const transformed: Rule[] = [];
    for (const rule of ruleSet.getRules()) {
      const mapped = this.rule(rule);
      if (mapped !== undefined) {
        transformed.push(mapped);
      }
    }
    return ruleSet.withRules(transformed);
  }

  public rule(rule: Rule): Rule | undefined {
    if (rule instanceof TreeRule) {
      return this.treeRule(rule);
    } else if (rule instanceof EndpointRule) {
      return this.endpointRule(rule);
    } else if (rule instanceof ErrorRule) {
      return this.errorRule(rule);
    }
    return rule;
  }

  public treeRule(treeRule: TreeRule): Rule {
    return new TreeRule(
      this.conditions(treeRule, treeRule.getConditions()),
      this.rules(treeRule, treeRule.getRules()),
      treeRule.getDocumentation()
    );
  }

  public rules(_treeRule: TreeRule, rules: Rule[]): Rule[] {
    const updated: Rule[] = [];
    for (const rule of rules) {
      const mapped = this.rule(rule);
      if (mapped !== undefined) {
        updated.push(mapped);
      }
    }
    return updated;
  }

  public conditions(rule: Rule, conditions: Condition[]): Condition[] {
    const updated: Condition[] = [];
    for (const condition of conditions) {
      const mapped = this.condition(rule, condition);
      if (mapped !== undefined) {
        updated.push(mapped);
      }
    }
    return updated;
  }

  public condition(rule: Rule, condition: Condition): Condition | undefined {
    return new Condition(
      this.libraryFunction(condition.getFunction()),
      this.result(rule, condition, condition.getResult())
    );
  }

  public result(_rule: Rule, _condition: Condition, result: string | undefined): string | undefined {
    return result;
  }

  public endpointRule(endpointRule: EndpointRule): Rule {
    return new EndpointRule(
      this.conditions(endpointRule, endpointRule.getConditions()),
      this.endpoint(endpointRule.getEndpoint()),
      endpointRule.getDocumentation()
    );
  }

  public errorRule(errorRule: ErrorRule): Rule {
    return new ErrorRule(
      this.conditions(errorRule, errorRule.getConditions()),
      this.error(errorRule, errorRule.getError()),
      errorRule.getDocumentation()
    );
  }

  public error(_errorRule: ErrorRule, error: Expression): Expression {
    return this.expression(error);
  }

  public libraryFunction(fn: LibraryFunction): LibraryFunction {
    let changed = false;
    const rewrittenArgs: Expression[] = [];
    const args = fn.getArguments();
    for (let i = 0; i < args.length; i++) {
      const rewritten = this.argument(fn, i, args[i]);
      rewrittenArgs.push(rewritten);
      if (rewritten !== args[i]) {
        changed = true;
      }
    }
    if (!changed) {
      return fn;
    }
    return fn.getFunctionDefinition().createFunction(new FunctionNode(fn.getName(), rewrittenArgs));
  }

  public argument(_fn: LibraryFunction, _position: number, argument: Expression): Expression {
    return this.expression(argument);
  }

  public expression(expression: Expression): Expression {
    if (expression instanceof Literal) {
      return this.literal(expression);
    } else if (expression instanceof Reference) {
      return this.reference(expression);
    } else if (expression instanceof LibraryFunction) {
      return this.libraryFunction(expression);
    }
    return expression;
  }

  public reference(reference: Reference): Expression {
    return reference;
  }

  public literal(literal: Literal): Literal {
    if (literal instanceof StringLiteral) {
      return this.stringLiteral(literal);
    } else if (literal instanceof TupleLiteral) {
      return this.tupleLiteral(literal);
    } else if (literal instanceof RecordLiteral) {
      return this.recordLiteral(literal);
    }
    return literal;
  }

  public tupleLiteral(tuple: TupleLiteral): Literal {
    const rewrittenMembers: Literal[] = [];
    let changed = false;
    for (const member of tuple.members()) {
      const rewritten = this.expression(member) as Literal;
      rewrittenMembers.push(rewritten);
      if (rewritten !== member) {
        changed = true;
      }
    }
    return changed ? new TupleLiteral(rewrittenMembers) : tuple;
  }

  public recordLiteral(record: RecordLiteral): Literal {
    const rewrittenMembers = new Map<string, Literal>();
    let changed = false;
    for (const [key, original] of record.members()) {
      const rewritten = this.expression(original) as Literal;
      rewrittenMembers.set(key, rewritten);
      if (rewritten !== original) {
        changed = true;
      }
    }
    return changed ? new RecordLiteral(rewrittenMembers) : record;
  }

  public stringLiteral(str: StringLiteral): Literal {
    const template = str.value();
    if (template.isStatic()) {
      return str;
    }
    let templateBuilder = "";
    let changed = false;
    for (const part of template.getParts()) {
      if (part.kind === "dynamic") {
        const original = part.expression;
        const rewritten = this.expression(original);
        if (rewritten !== original) {
          changed = true;
        }
        templateBuilder += "{" + rewritten.toString() + "}";
      } else {
        templateBuilder += part.value;
      }
    }
    return changed ? new StringLiteral(new Template(templateBuilder)) : str;
  }

  public endpoint(endpoint: Endpoint): Endpoint {
    const rewrittenUrl = this.expression(endpoint.getUrl());
    const rewrittenHeaders = this._rewriteHeaders(endpoint.getHeaders());
    const rewrittenProperties = this._rewriteProperties(endpoint.getProperties());
    if (
      rewrittenUrl !== endpoint.getUrl() ||
      rewrittenHeaders !== endpoint.getHeaders() ||
      rewrittenProperties !== endpoint.getProperties()
    ) {
      return new Endpoint(rewrittenUrl, rewrittenProperties, rewrittenHeaders);
    }
    return endpoint;
  }

  private _rewriteHeaders(headers: ReadonlyMap<string, Expression[]>): ReadonlyMap<string, Expression[]> {
    if (headers.size === 0) {
      return headers;
    }
    const rewritten = new Map<string, Expression[]>();
    let changed = false;
    for (const [name, originalValues] of headers) {
      const values = originalValues.map((original) => {
        const rewrittenExpression = this.expression(original);
        if (rewrittenExpression !== original) {
          changed = true;
        }
        return rewrittenExpression;
      });
      rewritten.set(name, values);
    }
    return changed ? rewritten : headers;
  }

  private _rewriteProperties(properties: ReadonlyMap<string, Literal>): ReadonlyMap<string, Literal> {
    if (properties.size === 0) {
      return properties;
    }
    const rewritten = new Map<string, Literal>();
    let changed = false;
    for (const [name, original] of properties) {
      const rewrittenExpression = this.expression(original);
      if (rewrittenExpression !== original) {
        if (!(rewrittenExpression instanceof Literal)) {
          throw new Error("Property value must be a literal");
        }
        changed = true;
      }
      rewritten.set(name, rewrittenExpression as Literal);
    }
    return changed ? rewritten : properties;
  }
}

class ReferenceReplacingMapper extends TreeMapper {
  public constructor(private readonly _replacements: ReadonlyMap<string, Expression>) {
    super();
  }

  public expression(expression: Expression): Expression {
    if (expression instanceof Reference) {
      const replacement = this._replacements.get(expression.getName());
      return replacement !== undefined ? replacement : expression;
    }
    for (const reference of expression.getReferences()) {
      if (this._replacements.has(reference)) {
        return super.expression(expression);
      }
    }
    return expression;
  }

  public reference(reference: Reference): Expression {
    const replacement = this._replacements.get(reference.getName());
    if (replacement instanceof Reference) {
      return replacement;
    }
    return reference;
  }
}
