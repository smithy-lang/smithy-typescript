import type { Symbol } from "../../../codegen-core";

interface ResolveConfigFunctionInit {
  resolveConfigFunction: Symbol;
  inputConfig: Symbol;
  resolvedConfig: Symbol;
  addArgs: string[];
  previouslyResolved?: Symbol;
}

/**
 * A config resolution function contributed by an auth scheme.
 *
 * @internal
 */
export class ResolveConfigFunction {
  public readonly resolveConfigFunction: Symbol;
  public readonly inputConfig: Symbol;
  public readonly resolvedConfig: Symbol;
  public readonly addArgs: string[];
  public readonly previouslyResolved: Symbol | undefined;

  public constructor(init: ResolveConfigFunctionInit) {
    this.resolveConfigFunction = init.resolveConfigFunction;
    this.inputConfig = init.inputConfig;
    this.resolvedConfig = init.resolvedConfig;
    this.addArgs = init.addArgs;
    this.previouslyResolved = init.previouslyResolved;
  }

  public static builder(): ResolveConfigFunctionBuilder {
    return new ResolveConfigFunctionBuilder();
  }
}

class ResolveConfigFunctionBuilder {
  private _init: Partial<ResolveConfigFunctionInit> = { addArgs: [] };

  public resolveConfigFunction(value: Symbol): this {
    this._init.resolveConfigFunction = value;
    return this;
  }

  public inputConfig(value: Symbol): this {
    this._init.inputConfig = value;
    return this;
  }

  public resolvedConfig(value: Symbol): this {
    this._init.resolvedConfig = value;
    return this;
  }

  public addArgs(args: string[]): this {
    this._init.addArgs = args;
    return this;
  }

  public previouslyResolved(value: Symbol | undefined): this {
    this._init.previouslyResolved = value;
    return this;
  }
}
