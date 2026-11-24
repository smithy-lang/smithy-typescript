/**
 * A JSON value as produced by the Smithy JSON AST.
 *
 * @internal
 */
export type JsonNode = null | boolean | number | string | JsonNode[] | { [key: string]: JsonNode };

/**
 * @internal
 */
export type JsonObjectNode = { [key: string]: JsonNode };

/**
 * Port of the rules engine type system, limited to what the CFG transforms inspect.
 *
 * @internal
 */
export abstract class Type {
  public static booleanType(): Type {
    return BOOLEAN_TYPE;
  }

  public getZeroValue(): Literal | undefined {
    return undefined;
  }
}

/**
 * @internal
 */
export class OptionalType extends Type {
  public constructor(private readonly _inner: Type) {
    super();
  }

  public inner(): Type {
    return this._inner;
  }

  public getZeroValue(): Literal | undefined {
    return this._inner.getZeroValue();
  }
}

/**
 * @internal
 */
export class RecordType extends Type {}

interface FunctionDefinition {
  getId(): string;
  getCost(): number;
  getReturnType(): Type;
  createFunction(functionNode: FunctionNode): LibraryFunction;
}

/**
 * Splits like java.lang.String#split with a regex, which drops trailing empty strings.
 */
const javaSplit = (value: string, separator: RegExp): string[] => {
  const parts = value.split(separator);
  if (parts.length === 1) {
    return parts;
  }
  while (parts.length > 0 && parts[parts.length - 1] === "") {
    parts.pop();
  }
  return parts;
};

/**
 * @internal
 */
export abstract class Expression {
  private _references: ReadonlySet<string> | undefined;
  private _key: string | undefined;

  public static of(value: boolean | number | string): Literal {
    if (typeof value === "boolean") {
      return new BooleanLiteral(value);
    }
    if (typeof value === "number") {
      return new IntegerLiteral(value);
    }
    return new StringLiteral(new Template(value));
  }

  public static fromNode(node: JsonNode): Expression {
    if (typeof node === "object" && node !== null && !Array.isArray(node)) {
      const hasRef = "ref" in node;
      const hasFn = "fn" in node;
      if ((hasRef ? 1 : 0) + (hasFn ? 1 : 0) !== 1) {
        throw new Error("expected exactly one of `ref` or `fn` to be set, found " + JSON.stringify(node));
      }
      if (hasRef) {
        const ref = node.ref;
        if (typeof ref !== "string") {
          throw new Error("ref must be a string");
        }
        return new Reference(ref);
      }
      return FunctionNode.fromNode(node).createFunction();
    }
    return Literal.fromNode(node);
  }

  public static parseShortform(shortForm: string): Expression {
    if (shortForm.includes("#")) {
      const index = shortForm.indexOf("#");
      return GetAttr.ofExpressions(new Reference(shortForm.substring(0, index)), shortForm.substring(index + 1));
    }
    return new Reference(shortForm);
  }

  public getReferences(): ReadonlySet<string> {
    return (this._references ??= this._calculateReferences());
  }

  public abstract toNode(): JsonNode;

  public abstract toString(): string;

  public equals(other: unknown): boolean {
    return other instanceof Expression && other.constructor === this.constructor && other.key() === this.key();
  }

  public key(): string {
    return (this._key ??= JSON.stringify(this.toNode()));
  }

  protected _calculateReferences(): Set<string> {
    return new Set();
  }
}

/**
 * @internal
 */
export class Reference extends Expression {
  public constructor(private readonly _name: string) {
    super();
  }

  public getName(): string {
    return this._name;
  }

  public toNode(): JsonNode {
    return { ref: this._name };
  }

  public toString(): string {
    return this._name;
  }

  protected _calculateReferences(): Set<string> {
    return new Set([this._name]);
  }
}

type TemplatePart = { kind: "literal"; value: string } | { kind: "dynamic"; raw: string; expression: Expression };

/**
 * @internal
 */
export class Template {
  private readonly _value: string;
  private readonly _parts: TemplatePart[];

  public constructor(value: string) {
    this._value = value;
    this._parts = Template._parse(value);
  }

  public getParts(): TemplatePart[] {
    return this._parts;
  }

  public isStatic(): boolean {
    return this._parts.every((part) => part.kind === "literal");
  }

  public toNode(): string {
    let result = "";
    for (const part of this._parts) {
      result += part.kind === "literal" ? part.value : "{" + part.raw + "}";
    }
    return result;
  }

  public toString(): string {
    return `"${this._value}"`;
  }

  private static _parse(template: string): TemplatePart[] {
    const out: TemplatePart[] = [];
    let templateStart = -1;
    let depth = 0;
    let templateEnd = 0;
    for (let i = 0; i < template.length; i++) {
      if (template.startsWith("{{", i)) {
        i++;
        continue;
      }
      if (template.startsWith("}}", i)) {
        i++;
        continue;
      }
      if (template.charAt(i) === "{") {
        if (depth === 0) {
          if (templateEnd !== i) {
            out.push(Template._unescape(template.substring(templateEnd, i)));
          }
          templateStart = i + 1;
        }
        depth++;
      }
      if (template.charAt(i) === "}") {
        depth--;
        if (depth < 0) {
          throw new Error("unmatched `}` in template");
        }
        if (depth === 0) {
          const raw = template.substring(templateStart, i);
          out.push({ kind: "dynamic", raw, expression: Expression.parseShortform(raw) });
          templateStart = -1;
        }
        templateEnd = i + 1;
      }
    }
    if (depth !== 0) {
      throw new Error("unmatched `{` in template");
    }
    if (templateEnd < template.length) {
      out.push(Template._unescape(template.substring(templateEnd)));
    }
    return out;
  }

  private static _unescape(value: string): TemplatePart {
    const unescaped = value.split("{{").join("{").split("}}").join("}");
    if (unescaped.length === 0) {
      throw new Error("value cannot blank");
    }
    return { kind: "literal", value: unescaped };
  }
}

/**
 * @internal
 */
export abstract class Literal extends Expression {
  public static fromNode(node: JsonNode): Literal {
    if (node === null) {
      throw new Error("null node not supported");
    }
    if (Array.isArray(node)) {
      return new TupleLiteral(node.map((element) => Literal.fromNode(element)));
    }
    if (typeof node === "boolean") {
      return new BooleanLiteral(node);
    }
    if (typeof node === "number") {
      return new IntegerLiteral(node);
    }
    if (typeof node === "string") {
      return new StringLiteral(new Template(node));
    }
    const members = new Map<string, Literal>();
    for (const [key, value] of Object.entries(node)) {
      members.set(key, Literal.fromNode(value));
    }
    return new RecordLiteral(members);
  }

  public asBooleanLiteral(): boolean | undefined {
    return undefined;
  }
}

class BooleanLiteral extends Literal {
  public constructor(private readonly _value: boolean) {
    super();
  }

  public asBooleanLiteral(): boolean {
    return this._value;
  }

  public toNode(): JsonNode {
    return this._value;
  }

  public toString(): string {
    return String(this._value);
  }
}

class IntegerLiteral extends Literal {
  public constructor(private readonly _value: number) {
    super();
    if (!Number.isInteger(_value) || _value < 0) {
      throw new Error("Only integer values greater than or equal to 0 are supported.");
    }
  }

  public toNode(): JsonNode {
    return this._value;
  }

  public toString(): string {
    return String(this._value);
  }
}

/**
 * @internal
 */
export class StringLiteral extends Literal {
  public constructor(private readonly _template: Template) {
    super();
  }

  public value(): Template {
    return this._template;
  }

  public toNode(): JsonNode {
    return this._template.toNode();
  }

  public toString(): string {
    return this._template.toString();
  }

  protected _calculateReferences(): Set<string> {
    const references = new Set<string>();
    if (this._template.isStatic()) {
      return references;
    }
    for (const part of this._template.getParts()) {
      if (part.kind === "dynamic") {
        for (const reference of part.expression.getReferences()) {
          references.add(reference);
        }
      }
    }
    return references;
  }
}

/**
 * @internal
 */
export class TupleLiteral extends Literal {
  public constructor(private readonly _members: Literal[]) {
    super();
  }

  public members(): Literal[] {
    return this._members;
  }

  public toNode(): JsonNode {
    return this._members.map((member) => member.toNode());
  }

  public toString(): string {
    return "[" + this._members.map((member) => member.toString()).join(", ") + "]";
  }

  protected _calculateReferences(): Set<string> {
    const references = new Set<string>();
    for (const member of this._members) {
      for (const reference of member.getReferences()) {
        references.add(reference);
      }
    }
    return references;
  }
}

/**
 * @internal
 */
export class RecordLiteral extends Literal {
  private readonly _members: ReadonlyMap<string, Literal>;

  public constructor(members: ReadonlyMap<string, Literal>) {
    super();
    this._members = new Map(members);
  }

  public members(): ReadonlyMap<string, Literal> {
    return this._members;
  }

  public toNode(): JsonNode {
    const result: JsonObjectNode = {};
    for (const [key, value] of this._members) {
      result[key] = value.toNode();
    }
    return result;
  }

  public toString(): string {
    const entries: string[] = [];
    for (const [key, value] of this._members) {
      entries.push(`${key}=${value.toString()}`);
    }
    return "{" + entries.join(", ") + "}";
  }

  protected _calculateReferences(): Set<string> {
    const references = new Set<string>();
    for (const value of this._members.values()) {
      for (const reference of value.getReferences()) {
        references.add(reference);
      }
    }
    return references;
  }
}

/**
 * @internal
 */
export class FunctionNode {
  public constructor(
    private readonly _name: string,
    private readonly _arguments: Expression[]
  ) {}

  public static fromNode(node: JsonObjectNode): FunctionNode {
    const argv = node.argv;
    const name = node.fn;
    if (!Array.isArray(argv)) {
      throw new Error("Expected `argv` to be an array");
    }
    if (typeof name !== "string") {
      throw new Error("Expected `fn` to be a string");
    }
    return new FunctionNode(
      name,
      argv.map((arg) => Expression.fromNode(arg))
    );
  }

  public createFunction(): LibraryFunction {
    const definition = FUNCTION_DEFINITIONS.get(this._name);
    if (definition === undefined) {
      throw new Error(`\`${this._name}\` is not a valid function`);
    }
    return definition.createFunction(this);
  }

  public getName(): string {
    return this._name;
  }

  public getArguments(): Expression[] {
    return this._arguments;
  }

  public toNode(): JsonNode {
    return { fn: this._name, argv: this._arguments.map((argument) => argument.toNode()) };
  }
}

/**
 * @internal
 */
export abstract class LibraryFunction extends Expression {
  protected constructor(
    protected readonly _definition: FunctionDefinition,
    protected readonly _functionNode: FunctionNode
  ) {
    super();
  }

  public getName(): string {
    return this._functionNode.getName();
  }

  public getFunctionDefinition(): FunctionDefinition {
    return this._definition;
  }

  public getArguments(): Expression[] {
    return this._functionNode.getArguments();
  }

  public canonicalize(): LibraryFunction {
    return this;
  }

  public toNode(): JsonNode {
    return this._functionNode.toNode();
  }

  public toString(): string {
    return (
      this.getName() +
      "(" +
      this.getArguments()
        .map((argument) => argument.toString())
        .join(", ") +
      ")"
    );
  }

  protected _calculateReferences(): Set<string> {
    const references = new Set<string>();
    for (const argument of this.getArguments()) {
      for (const reference of argument.getReferences()) {
        references.add(reference);
      }
    }
    return references;
  }

  protected static _shouldSwapArgs(arg0: Expression, arg1: Expression): boolean {
    const arg0IsLiteral = isStaticLiteral(arg0);
    const arg1IsLiteral = isStaticLiteral(arg1);
    if (arg0IsLiteral !== arg1IsLiteral) {
      return arg0IsLiteral;
    }
    return javaCompare(arg0.toString(), arg1.toString()) > 0;
  }

  protected static _stripSingleVariableTemplate(expression: Expression): Expression {
    if (!(expression instanceof StringLiteral)) {
      return expression;
    }
    const parts = expression.value().getParts();
    if (parts.length === 1 && parts[0].kind === "dynamic") {
      return parts[0].expression;
    }
    return expression;
  }
}

const isStaticLiteral = (expression: Expression): boolean => {
  if (expression instanceof StringLiteral) {
    return expression.value().isStatic();
  }
  return expression instanceof Literal;
};

/**
 * Compares strings by UTF-16 code units like java.lang.String#compareTo.
 *
 * @internal
 */
export const javaCompare = (a: string, b: string): number => {
  const length = Math.min(a.length, b.length);
  for (let i = 0; i < length; i++) {
    const difference = a.charCodeAt(i) - b.charCodeAt(i);
    if (difference !== 0) {
      return difference;
    }
  }
  return a.length - b.length;
};

class SimpleDefinition implements FunctionDefinition {
  public constructor(
    private readonly _id: string,
    private readonly _cost: number,
    private readonly _returnType: () => Type,
    private readonly _create: (functionNode: FunctionNode) => LibraryFunction
  ) {}

  public getId(): string {
    return this._id;
  }

  public getCost(): number {
    return this._cost;
  }

  public getReturnType(): Type {
    return this._returnType();
  }

  public createFunction(functionNode: FunctionNode): LibraryFunction {
    return this._create(functionNode);
  }
}

/**
 * @internal
 */
export class IsSet extends LibraryFunction {
  public static readonly ID = "isSet";

  public constructor(functionNode: FunctionNode) {
    super(IS_SET_DEFINITION, functionNode);
  }

  public static getDefinition(): FunctionDefinition {
    return IS_SET_DEFINITION;
  }
}

/**
 * @internal
 */
export class Not extends LibraryFunction {
  public static readonly ID = "not";

  public constructor(functionNode: FunctionNode) {
    super(NOT_DEFINITION, functionNode);
  }
}

/**
 * @internal
 */
export class BooleanEquals extends LibraryFunction {
  public static readonly ID = "booleanEquals";

  public constructor(functionNode: FunctionNode) {
    super(BOOLEAN_EQUALS_DEFINITION, functionNode);
  }

  public static ofExpressions(arg1: Expression, arg2: Expression | boolean): BooleanEquals {
    const second = typeof arg2 === "boolean" ? Expression.of(arg2) : arg2;
    return new BooleanEquals(new FunctionNode(BooleanEquals.ID, [arg1, second]));
  }

  public canonicalize(): BooleanEquals {
    const args = this.getArguments();
    if (LibraryFunction._shouldSwapArgs(args[0], args[1])) {
      return BooleanEquals.ofExpressions(args[1], args[0]);
    }
    return this;
  }
}

class StringEquals extends LibraryFunction {
  public static readonly ID = "stringEquals";

  public constructor(functionNode: FunctionNode) {
    super(STRING_EQUALS_DEFINITION, functionNode);
  }

  public static ofExpressions(arg1: Expression, arg2: Expression): StringEquals {
    return new StringEquals(new FunctionNode(StringEquals.ID, [arg1, arg2]));
  }

  public canonicalize(): StringEquals {
    const args = this.getArguments();
    const arg0 = LibraryFunction._stripSingleVariableTemplate(args[0]);
    const arg1 = LibraryFunction._stripSingleVariableTemplate(args[1]);
    if (LibraryFunction._shouldSwapArgs(arg0, arg1)) {
      return StringEquals.ofExpressions(arg1, arg0);
    }
    if (arg0 !== args[0] || arg1 !== args[1]) {
      return StringEquals.ofExpressions(arg0, arg1);
    }
    return this;
  }
}

class GetAttr extends LibraryFunction {
  public static readonly ID = "getAttr";

  private readonly _target: Expression;
  private readonly _unparsedPath: string;

  public constructor(functionNode: FunctionNode) {
    super(GET_ATTR_DEFINITION, functionNode);
    this._target = functionNode.getArguments()[0];
    const pathNode = functionNode.getArguments()[1].toNode();
    if (typeof pathNode !== "string") {
      throw new Error("Expected a string path for getAttr");
    }
    this._unparsedPath = pathNode;
    GetAttr._validatePath(pathNode);
  }

  public static ofExpressions(target: Expression, path: string): GetAttr {
    return new GetAttr(new FunctionNode(GetAttr.ID, [target, Expression.of(path)]));
  }

  public toString(): string {
    return this._target.toString() + "#" + this._unparsedPath;
  }

  private static _validatePath(path: string): void {
    const components = javaSplit(path, /\./);
    if (components.length === 0) {
      throw new Error("Invalid argument to GetAttr: path may not be empty");
    }
    for (const component of components) {
      if (!component.includes("[")) {
        continue;
      }
      const slice = component.substring(component.indexOf("["));
      if (!slice.endsWith("]")) {
        throw new Error(`Invalid path component: ${component}. Must end with \`]\``);
      }
      if (!/^[+-]?\d+$/.test(slice.substring(1, slice.length - 1))) {
        throw new Error(`${slice} could not be parsed as a number`);
      }
    }
  }
}

/**
 * @internal
 */
export class Coalesce extends LibraryFunction {
  public static readonly ID = "coalesce";

  public constructor(functionNode: FunctionNode) {
    super(COALESCE_DEFINITION, functionNode);
  }

  public static ofExpressions(...args: Expression[]): Coalesce {
    return new Coalesce(new FunctionNode(Coalesce.ID, args));
  }
}

class Ite extends LibraryFunction {
  public static readonly ID = "ite";

  public constructor(functionNode: FunctionNode) {
    super(ITE_DEFINITION, functionNode);
  }
}

class ParseUrl extends LibraryFunction {
  public static readonly ID = "parseURL";

  public constructor(functionNode: FunctionNode) {
    super(PARSE_URL_DEFINITION, functionNode);
  }
}

class IsValidHostLabel extends LibraryFunction {
  public static readonly ID = "isValidHostLabel";

  public constructor(functionNode: FunctionNode) {
    super(IS_VALID_HOST_LABEL_DEFINITION, functionNode);
  }
}

class Substring extends LibraryFunction {
  public static readonly ID = "substring";

  public constructor(functionNode: FunctionNode) {
    super(SUBSTRING_DEFINITION, functionNode);
  }
}

class UriEncode extends LibraryFunction {
  public static readonly ID = "uriEncode";

  public constructor(functionNode: FunctionNode) {
    super(URI_ENCODE_DEFINITION, functionNode);
  }
}

class Split extends LibraryFunction {
  public static readonly ID = "split";

  public constructor(functionNode: FunctionNode) {
    super(SPLIT_DEFINITION, functionNode);
  }
}

/**
 * @internal
 */
export class Condition {
  private _key: string | undefined;
  private _string: string | undefined;

  public constructor(
    private readonly _function: LibraryFunction,
    private readonly _result?: string
  ) {}

  public static fromNode(node: JsonNode): Condition {
    if (typeof node !== "object" || node === null || Array.isArray(node)) {
      throw new Error("condition must be an object node");
    }
    const fn = FunctionNode.fromNode(node).createFunction();
    const assign = node.assign;
    if (assign === undefined) {
      return new Condition(fn);
    }
    if (typeof assign !== "string") {
      throw new Error("assign must be a string");
    }
    return new Condition(fn, assign);
  }

  public getResult(): string | undefined {
    return this._result;
  }

  public getFunction(): LibraryFunction {
    return this._function;
  }

  public withFunction(fn: LibraryFunction): Condition {
    return new Condition(fn, this._result);
  }

  public withResult(result: string | undefined): Condition {
    return new Condition(this._function, result);
  }

  public canonicalize(): Condition {
    const canonicalFn = this._function.canonicalize();
    if (canonicalFn === this._function) {
      return this;
    }
    return this.withFunction(canonicalFn);
  }

  public toNode(): JsonNode {
    const node = this._function.toNode() as JsonObjectNode;
    const result: JsonObjectNode = { ...node };
    if (this._result !== undefined) {
      result.assign = this._result;
    }
    return result;
  }

  public key(): string {
    return (this._key ??= JSON.stringify(this.toNode()));
  }

  public equals(other: unknown): boolean {
    return other instanceof Condition && other.key() === this.key();
  }

  public toString(): string {
    return (this._string ??=
      this._result !== undefined ? this._result + " = " + this._function.toString() : this._function.toString());
  }
}

/**
 * @internal
 */
export class Endpoint {
  public constructor(
    private readonly _url: Expression,
    private readonly _properties: ReadonlyMap<string, Literal>,
    private readonly _headers: ReadonlyMap<string, Expression[]>
  ) {}

  public static fromNode(node: JsonNode): Endpoint {
    if (typeof node !== "object" || node === null || Array.isArray(node)) {
      throw new Error("endpoint must be an object node");
    }
    if (node.url === undefined) {
      throw new Error("URL must be included in endpoint");
    }
    const url = Expression.fromNode(node.url);
    const properties = new Map<string, Literal>();
    const rawProperties = node.properties;
    if (rawProperties !== undefined) {
      for (const [key, value] of Object.entries(rawProperties as JsonObjectNode)) {
        properties.set(key, Literal.fromNode(value));
      }
    }
    const headers = new Map<string, Expression[]>();
    const rawHeaders = node.headers;
    if (rawHeaders !== undefined) {
      for (const [key, value] of Object.entries(rawHeaders as JsonObjectNode)) {
        if (!Array.isArray(value)) {
          throw new Error("header values should be an array");
        }
        headers.set(
          key,
          value.map((header) => Expression.fromNode(header))
        );
      }
    }
    return new Endpoint(url, properties, headers);
  }

  public getUrl(): Expression {
    return this._url;
  }

  public getHeaders(): ReadonlyMap<string, Expression[]> {
    return this._headers;
  }

  public getProperties(): ReadonlyMap<string, Literal> {
    return this._properties;
  }

  public toNode(): JsonNode {
    const properties: JsonObjectNode = {};
    for (const [key, value] of this._properties) {
      properties[key] = value.toNode();
    }
    const headers: JsonObjectNode = {};
    for (const [key, values] of this._headers) {
      headers[key] = values.map((value) => value.toNode());
    }
    return { url: this._url.toNode(), properties, headers };
  }

  public toString(): string {
    let result = "url: " + this._url.toString();
    if (this._headers.size > 0) {
      result += "\nheaders:";
      for (const [key, values] of this._headers) {
        result += "\n" + indent(`${key}: [${values.map((value) => value.toString()).join(", ")}]`, 2);
      }
    }
    if (this._properties.size > 0) {
      result += "\nproperties:";
      for (const [key, value] of this._properties) {
        result += "\n" + indent(`${key}: ${value.toString()}`, 2);
      }
    }
    return result;
  }
}

const indent = (value: string, spaces: number): string => {
  const prefix = " ".repeat(spaces);
  return value
    .split("\n")
    .map((line) => prefix + line)
    .join("\n");
};

/**
 * @internal
 */
export abstract class Rule {
  private _key: string | undefined;

  protected constructor(
    protected readonly _conditions: Condition[],
    protected readonly _documentation: string | undefined
  ) {}

  public static fromNode(node: JsonNode): Rule {
    if (typeof node !== "object" || node === null || Array.isArray(node)) {
      throw new Error("rule must be an object node");
    }
    const documentation = typeof node.documentation === "string" ? node.documentation : undefined;
    const conditions = Array.isArray(node.conditions)
      ? node.conditions.map((condition) => Condition.fromNode(condition))
      : [];
    switch (node.type) {
      case "endpoint":
        return new EndpointRule(conditions, Endpoint.fromNode(node.endpoint), documentation);
      case "error":
        return new ErrorRule(conditions, Expression.fromNode(node.error), documentation);
      case "tree":
        return new TreeRule(
          conditions,
          (node.rules as JsonNode[]).map((rule) => Rule.fromNode(rule)),
          documentation
        );
      default:
        throw new Error("Unexpected rule type: " + String(node.type));
    }
  }

  public getConditions(): Condition[] {
    return this._conditions;
  }

  public getDocumentation(): string | undefined {
    return this._documentation;
  }

  public abstract withConditions(conditions: Condition[]): Rule;

  public toNode(): JsonNode {
    const result: JsonObjectNode = {};
    if (this._documentation !== undefined) {
      result.documentation = this._documentation;
    }
    result.conditions = this._conditions.map((condition) => condition.toNode());
    this._writeValueNode(result);
    return result;
  }

  public key(): string {
    return (this._key ??= JSON.stringify(this.toNode()));
  }

  public equals(other: unknown): boolean {
    return other instanceof Rule && other.constructor === this.constructor && other.key() === this.key();
  }

  protected abstract _writeValueNode(target: JsonObjectNode): void;
}

/**
 * @internal
 */
export class EndpointRule extends Rule {
  public constructor(
    conditions: Condition[],
    private readonly _endpoint: Endpoint,
    documentation?: string
  ) {
    super(conditions, documentation);
  }

  public getEndpoint(): Endpoint {
    return this._endpoint;
  }

  public withConditions(conditions: Condition[]): Rule {
    return new EndpointRule(conditions, this._endpoint, this._documentation);
  }

  protected _writeValueNode(target: JsonObjectNode): void {
    target.endpoint = this._endpoint.toNode();
    target.type = "endpoint";
  }
}

/**
 * @internal
 */
export class ErrorRule extends Rule {
  public constructor(
    conditions: Condition[],
    private readonly _error: Expression,
    documentation?: string
  ) {
    super(conditions, documentation);
  }

  public getError(): Expression {
    return this._error;
  }

  public withConditions(conditions: Condition[]): Rule {
    return new ErrorRule(conditions, this._error, this._documentation);
  }

  protected _writeValueNode(target: JsonObjectNode): void {
    target.error = this._error.toNode();
    target.type = "error";
  }
}

/**
 * @internal
 */
export class TreeRule extends Rule {
  public constructor(
    conditions: Condition[],
    private readonly _rules: Rule[],
    documentation?: string
  ) {
    super(conditions, documentation);
  }

  public getRules(): Rule[] {
    return this._rules;
  }

  public withConditions(conditions: Condition[]): Rule {
    return new TreeRule(conditions, this._rules, this._documentation);
  }

  protected _writeValueNode(target: JsonObjectNode): void {
    target.rules = this._rules.map((rule) => rule.toNode());
    target.type = "tree";
  }
}

/**
 * @internal
 */
export class NoMatchRule extends Rule {
  public static readonly INSTANCE = new NoMatchRule();

  private constructor() {
    super([], undefined);
  }

  public withConditions(conditions: Condition[]): Rule {
    if (conditions.length === 0) {
      return this;
    }
    throw new Error("Unknown rule type: NoMatchRule");
  }

  public toNode(): JsonNode {
    return "NO_MATCH";
  }

  protected _writeValueNode(): void {}
}

/**
 * The parameters declaration is kept as raw JSON, since only the names are inspected.
 *
 * @internal
 */
export class Parameters {
  public constructor(private readonly _raw: JsonObjectNode) {}

  public names(): string[] {
    return Object.keys(this._raw);
  }

  public toNode(): JsonNode {
    return this._raw;
  }
}

/**
 * @internal
 */
export class EndpointRuleSet {
  public constructor(
    private readonly _parameters: Parameters,
    private readonly _rules: Rule[],
    private readonly _version: string
  ) {}

  public static fromNode(node: JsonNode): EndpointRuleSet {
    if (typeof node !== "object" || node === null || Array.isArray(node)) {
      throw new Error("The root of a ruleset must be an object");
    }
    if (typeof node.version !== "string") {
      throw new Error("Expected `version` to be a string");
    }
    return new EndpointRuleSet(
      new Parameters(node.parameters as JsonObjectNode),
      (node.rules as JsonNode[]).map((rule) => Rule.fromNode(rule)),
      node.version
    );
  }

  public getParameters(): Parameters {
    return this._parameters;
  }

  public getRules(): Rule[] {
    return this._rules;
  }

  public getVersion(): string {
    return this._version;
  }

  public withRules(rules: Rule[]): EndpointRuleSet {
    return new EndpointRuleSet(this._parameters, rules, this._version);
  }

  public toNode(): JsonNode {
    return {
      version: this._version,
      parameters: this._parameters.toNode(),
      rules: this._rules.map((rule) => rule.toNode()),
    };
  }
}

const BOOLEAN_TYPE: Type = new (class BooleanType extends Type {
  public getZeroValue(): Literal {
    return new BooleanLiteral(false);
  }
})();

const STRING_TYPE: Type = new (class StringType extends Type {
  public getZeroValue(): Literal {
    return new StringLiteral(new Template(""));
  }
})();

const ANY_TYPE: Type = new (class AnyType extends Type {})();

class ArrayType extends Type {
  public getZeroValue(): Literal {
    return new TupleLiteral([]);
  }
}

const IS_SET_DEFINITION = new SimpleDefinition(
  IsSet.ID,
  8,
  () => BOOLEAN_TYPE,
  (node) => new IsSet(node)
);
const NOT_DEFINITION = new SimpleDefinition(
  Not.ID,
  5,
  () => BOOLEAN_TYPE,
  (node) => new Not(node)
);
const BOOLEAN_EQUALS_DEFINITION = new SimpleDefinition(
  BooleanEquals.ID,
  9,
  () => BOOLEAN_TYPE,
  (node) => new BooleanEquals(node)
);
const STRING_EQUALS_DEFINITION = new SimpleDefinition(
  StringEquals.ID,
  30,
  () => BOOLEAN_TYPE,
  (node) => new StringEquals(node)
);
const GET_ATTR_DEFINITION = new SimpleDefinition(
  GetAttr.ID,
  25,
  () => ANY_TYPE,
  (node) => new GetAttr(node)
);
const COALESCE_DEFINITION = new SimpleDefinition(
  Coalesce.ID,
  10,
  () => ANY_TYPE,
  (node) => new Coalesce(node)
);
const ITE_DEFINITION = new SimpleDefinition(
  Ite.ID,
  10,
  () => ANY_TYPE,
  (node) => new Ite(node)
);
const PARSE_URL_RETURN_TYPE = new OptionalType(new RecordType());
const PARSE_URL_DEFINITION = new SimpleDefinition(
  ParseUrl.ID,
  200,
  () => PARSE_URL_RETURN_TYPE,
  (node) => new ParseUrl(node)
);
const IS_VALID_HOST_LABEL_DEFINITION = new SimpleDefinition(
  IsValidHostLabel.ID,
  80,
  () => BOOLEAN_TYPE,
  (node) => new IsValidHostLabel(node)
);
const SUBSTRING_RETURN_TYPE = new OptionalType(STRING_TYPE);
const SUBSTRING_DEFINITION = new SimpleDefinition(
  Substring.ID,
  50,
  () => SUBSTRING_RETURN_TYPE,
  (node) => new Substring(node)
);
const URI_ENCODE_DEFINITION = new SimpleDefinition(
  UriEncode.ID,
  100,
  () => STRING_TYPE,
  (node) => new UriEncode(node)
);
const ARRAY_TYPE = new ArrayType();
const SPLIT_DEFINITION = new SimpleDefinition(
  Split.ID,
  60,
  () => ARRAY_TYPE,
  (node) => new Split(node)
);

const FUNCTION_DEFINITIONS = new Map<string, FunctionDefinition>([
  [IsSet.ID, IS_SET_DEFINITION],
  [Not.ID, NOT_DEFINITION],
  [BooleanEquals.ID, BOOLEAN_EQUALS_DEFINITION],
  [StringEquals.ID, STRING_EQUALS_DEFINITION],
  [GetAttr.ID, GET_ATTR_DEFINITION],
  [Coalesce.ID, COALESCE_DEFINITION],
  [Ite.ID, ITE_DEFINITION],
  [ParseUrl.ID, PARSE_URL_DEFINITION],
  [IsValidHostLabel.ID, IS_VALID_HOST_LABEL_DEFINITION],
  [Substring.ID, SUBSTRING_DEFINITION],
  [UriEncode.ID, URI_ENCODE_DEFINITION],
  [Split.ID, SPLIT_DEFINITION],
]);

/**
 * Registers a rules function that is not built in, like the AWS partition functions.
 *
 * @internal
 */
export const registerFunctionDefinition = (definition: FunctionDefinition): void => {
  if (FUNCTION_DEFINITIONS.has(definition.getId())) {
    throw new Error("Attempted to load a duplicate library function: " + definition.getId());
  }
  FUNCTION_DEFINITIONS.set(definition.getId(), definition);
};
