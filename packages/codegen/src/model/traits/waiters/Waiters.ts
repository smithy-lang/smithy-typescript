import { ExpectationNotMetException } from "../../exceptions/exceptions";
import { Nodes } from "../../node/Nodes";
import type { JsonObject } from "../../node/Nodes";
import { ShapeId } from "../../shapes/ShapeId";
import { Trait } from "../Trait";

/**
 * @internal
 */
export type AcceptorState = "success" | "failure" | "retry";
type PathComparator = "allStringEquals" | "anyStringEquals" | "stringEquals" | "booleanEquals";

const ACCEPTOR_STATES: readonly string[] = ["success", "failure", "retry"];
const PATH_COMPARATORS: readonly string[] = ["allStringEquals", "anyStringEquals", "stringEquals", "booleanEquals"];

class PathMatcher {
  private readonly _path: string;
  private readonly _expected: string;
  private readonly _comparator: PathComparator;

  constructor(path: string, expected: string, comparator: PathComparator) {
    this._path = path;
    this._expected = expected;
    this._comparator = comparator;
  }

  public static fromNode(node: unknown): PathMatcher {
    const object = Nodes.expectObject(node);
    const comparator = Nodes.expectString(Nodes.expectMember(object, "comparator"));
    if (PATH_COMPARATORS.indexOf(comparator) === -1) {
      throw new ExpectationNotMetException(
        "Expected string value of one of " + PATH_COMPARATORS.join(", ") + ", but found " + comparator
      );
    }
    return new PathMatcher(
      Nodes.expectString(Nodes.expectMember(object, "path")),
      Nodes.expectString(Nodes.expectMember(object, "expected")),
      comparator as PathComparator
    );
  }
}

interface MatcherVisitor<T> {
  visitOutput(matcher: OutputMember): T;
  visitInputOutput(matcher: InputOutputMember): T;
  visitSuccess(matcher: SuccessMember): T;
  visitErrorType(matcher: ErrorTypeMember): T;
  visitUnknown(matcher: UnknownMember): T;
}

abstract class Matcher<T> {
  public static fromNode(node: unknown): Matcher<unknown> {
    const object = Nodes.expectObject(node);
    const keys = Object.keys(object);
    if (keys.length !== 1) {
      throw new ExpectationNotMetException("Union value must have exactly one value set");
    }
    const key = keys[0];
    const value = object[key];
    switch (key) {
      case "output":
        return new OutputMember(PathMatcher.fromNode(value));
      case "inputOutput":
        return new InputOutputMember(PathMatcher.fromNode(value));
      case "success":
        return new SuccessMember(Nodes.expectBoolean(value));
      case "errorType":
        return new ErrorTypeMember(Nodes.expectString(value));
      default:
        return new UnknownMember(key, value);
    }
  }

  public abstract getValue(): T;

  public abstract getMemberName(): string;

  public abstract accept<U>(visitor: MatcherVisitor<U>): U;
}

/**
 * @internal
 */
export class OutputMember extends Matcher<PathMatcher> {
  private readonly _value: PathMatcher;

  constructor(value: PathMatcher) {
    super();
    this._value = value;
  }

  public getValue(): PathMatcher {
    return this._value;
  }

  public getMemberName(): string {
    return "output";
  }

  public accept<U>(visitor: MatcherVisitor<U>): U {
    return visitor.visitOutput(this);
  }
}

/**
 * @internal
 */
export class InputOutputMember extends Matcher<PathMatcher> {
  private readonly _value: PathMatcher;

  constructor(value: PathMatcher) {
    super();
    this._value = value;
  }

  public getValue(): PathMatcher {
    return this._value;
  }

  public getMemberName(): string {
    return "inputOutput";
  }

  public accept<U>(visitor: MatcherVisitor<U>): U {
    return visitor.visitInputOutput(this);
  }
}

/**
 * @internal
 */
export class SuccessMember extends Matcher<boolean> {
  private readonly _value: boolean;

  constructor(value: boolean) {
    super();
    this._value = value;
  }

  public getValue(): boolean {
    return this._value;
  }

  public getMemberName(): string {
    return "success";
  }

  public accept<U>(visitor: MatcherVisitor<U>): U {
    return visitor.visitSuccess(this);
  }
}

/**
 * @internal
 */
export class ErrorTypeMember extends Matcher<string> {
  private readonly _value: string;

  constructor(value: string) {
    super();
    this._value = value;
  }

  public getValue(): string {
    return this._value;
  }

  public getMemberName(): string {
    return "errorType";
  }

  public accept<U>(visitor: MatcherVisitor<U>): U {
    return visitor.visitErrorType(this);
  }
}

class UnknownMember extends Matcher<unknown> {
  private readonly _key: string;
  private readonly _value: unknown;

  constructor(key: string, value: unknown) {
    super();
    this._key = key;
    this._value = value;
  }

  public getValue(): unknown {
    return this._value;
  }

  public getMemberName(): string {
    return this._key;
  }

  public accept<U>(visitor: MatcherVisitor<U>): U {
    return visitor.visitUnknown(this);
  }
}

/**
 * @internal
 */
export class Acceptor {
  private readonly _state: AcceptorState;
  private readonly _matcher: Matcher<unknown>;
  private readonly _message: string | undefined;

  constructor(state: AcceptorState, matcher: Matcher<unknown>, message?: string) {
    this._state = state;
    this._matcher = matcher;
    this._message = message;
  }

  public static fromNode(node: unknown): Acceptor {
    const object = Nodes.expectObject(node);
    const state = Nodes.expectString(Nodes.expectMember(object, "state"));
    if (ACCEPTOR_STATES.indexOf(state) === -1) {
      throw new ExpectationNotMetException(
        "Expected string value of one of " + ACCEPTOR_STATES.join(", ") + ", but found " + state
      );
    }
    return new Acceptor(
      state as AcceptorState,
      Matcher.fromNode(Nodes.expectMember(object, "matcher")),
      Nodes.getString(object, "message")
    );
  }

  public getState(): AcceptorState {
    return this._state;
  }

  public getMatcher(): Matcher<unknown> {
    return this._matcher;
  }

  public getMessage(): string | undefined {
    return this._message;
  }
}

/**
 * @internal
 */
export class Waiter {
  private static readonly _DEFAULT_MIN_DELAY = 2;
  private static readonly _DEFAULT_MAX_DELAY = 120;

  private readonly _documentation: string | undefined;
  private readonly _acceptors: Acceptor[];
  private readonly _minDelay: number;
  private readonly _maxDelay: number;
  private readonly _deprecated: boolean;
  private readonly _tags: string[];

  private constructor(object: JsonObject) {
    this._documentation = Nodes.getString(object, "documentation");
    this._acceptors = Nodes.expectArray(Nodes.expectMember(object, "acceptors")).map((entry) =>
      Acceptor.fromNode(entry)
    );
    this._minDelay = Math.trunc(Nodes.getNumber(object, "minDelay") ?? Waiter._DEFAULT_MIN_DELAY);
    this._maxDelay = Math.trunc(Nodes.getNumber(object, "maxDelay") ?? Waiter._DEFAULT_MAX_DELAY);
    this._deprecated = Nodes.getBooleanOrDefault(object, "deprecated");
    this._tags = Nodes.getStringArray(object, "tags") ?? [];
  }

  public static fromNode(node: unknown): Waiter {
    return new Waiter(Nodes.expectObject(node));
  }

  public getDocumentation(): string | undefined {
    return this._documentation;
  }

  public getAcceptors(): Acceptor[] {
    return this._acceptors;
  }

  public getMinDelay(): number {
    return this._minDelay;
  }

  public getMaxDelay(): number {
    return this._maxDelay;
  }
}

/**
 * @internal
 */
export class WaitableTrait extends Trait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.waiters#waitable");

  private readonly _waiters: Map<string, Waiter>;

  constructor(value: unknown) {
    super(WaitableTrait.ID, value);
    const object = Nodes.expectObject(value);
    this._waiters = new Map<string, Waiter>();
    for (const key of Object.keys(object)) {
      this._waiters.set(key, Waiter.fromNode(object[key]));
    }
  }

  public getWaiters(): ReadonlyMap<string, Waiter> {
    return this._waiters;
  }
}
