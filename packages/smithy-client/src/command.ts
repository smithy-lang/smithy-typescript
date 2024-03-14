import type { EndpointParameterInstructions } from "@smithy/middleware-endpoint";
import { constructStack } from "@smithy/middleware-stack";
import type { HttpRequest } from "@smithy/protocol-http";
import type {
  Command as ICommand,
  FinalizeHandlerArguments,
  Handler,
  HandlerExecutionContext,
  HttpRequest as IHttpRequest,
  HttpResponse as IHttpResponse,
  Logger,
  MetadataBearer,
  MiddlewareStack as IMiddlewareStack,
  OptionalParameter,
  Pluggable,
  RequestHandler,
  SerdeContext,
} from "@smithy/types";
import { SMITHY_CONTEXT_KEY } from "@smithy/types";

/**
 * @public
 */
export abstract class Command<
  Input extends ClientInput,
  Output extends ClientOutput,
  ResolvedClientConfiguration,
  ClientInput extends object = any,
  ClientOutput extends MetadataBearer = any
> implements ICommand<ClientInput, Input, ClientOutput, Output, ResolvedClientConfiguration> {
  public abstract input: Input;
  public readonly middlewareStack: IMiddlewareStack<Input, Output> = constructStack<Input, Output>();

  /**
   * Factory for Command ClassBuilder.
   * @internal
   */
  public static classBuilder<
    I extends SI,
    O extends SO,
    C extends { logger: Logger; requestHandler: RequestHandler<any, any, any> },
    SI extends object = any,
    SO extends MetadataBearer = any
  >() {
    return new ClassBuilder<I, O, C, SI, SO>();
  }

  abstract resolveMiddleware(
    stack: IMiddlewareStack<ClientInput, ClientOutput>,
    configuration: ResolvedClientConfiguration,
    options: any
  ): Handler<Input, Output>;

  /**
   * @internal
   */
  public resolveMiddlewareWithContext(
    clientStack: IMiddlewareStack<any, any>,
    configuration: { logger: Logger; requestHandler: RequestHandler<any, any, any> },
    options: any,
    {
      middlewareFn,
      clientName,
      commandName,
      inputFilterSensitiveLog,
      outputFilterSensitiveLog,
      smithyContext,
      additionalContext,
      CommandCtor,
    }: ResolveMiddlewareContextArgs
  ) {
    for (const mw of middlewareFn.bind(this)(CommandCtor, clientStack, configuration, options)) {
      this.middlewareStack.use(mw);
    }
    const stack = clientStack.concat(this.middlewareStack);
    const { logger } = configuration;
    const handlerExecutionContext: HandlerExecutionContext = {
      logger,
      clientName,
      commandName,
      inputFilterSensitiveLog,
      outputFilterSensitiveLog,
      [SMITHY_CONTEXT_KEY]: {
        ...smithyContext,
      },
      ...additionalContext,
    };
    const { requestHandler } = configuration;
    return stack.resolve(
      (request: FinalizeHandlerArguments<any>) => requestHandler.handle(request.request as HttpRequest, options || {}),
      handlerExecutionContext
    );
  }
}

/**
 * @internal
 */
type ResolveMiddlewareContextArgs = {
  middlewareFn: (CommandCtor: any, clientStack: any, config: any, options: any) => Pluggable<any, any>[];
  clientName: string;
  commandName: string;
  smithyContext: Record<string, unknown>;
  additionalContext: HandlerExecutionContext;
  inputFilterSensitiveLog: (_: any) => any;
  outputFilterSensitiveLog: (_: any) => any;
  CommandCtor: any /* Command constructor */;
};

/**
 * @internal
 */
class ClassBuilder<
  I extends SI,
  O extends SO,
  C extends { logger: Logger; requestHandler: RequestHandler<any, any, any> },
  SI extends object = any,
  SO extends MetadataBearer = any
> {
  private _init: (_: Command<I, O, C, SI, SO>) => void = () => {};
  private _ep: EndpointParameterInstructions = {};
  private _middlewareFn: (
    CommandCtor: any,
    clientStack: any,
    config: any,
    options: any
  ) => Pluggable<any, any>[] = () => [];
  private _commandName = "";
  private _clientName = "";
  private _additionalContext = {} as HandlerExecutionContext;
  private _smithyContext = {} as Record<string, unknown>;
  private _inputFilterSensitiveLog = (_: any) => _;
  private _outputFilterSensitiveLog = (_: any) => _;
  private _serializer: (input: I, context: SerdeContext | any) => Promise<IHttpRequest> = null as any;
  private _deserializer: (output: IHttpResponse, context: SerdeContext | any) => Promise<O> = null as any;
  /**
   * Optional init callback.
   */
  public init(cb: (_: Command<I, O, C, SI, SO>) => void) {
    this._init = cb;
  }
  /**
   * Set the endpoint parameter instructions.
   */
  public ep(endpointParameterInstructions: EndpointParameterInstructions): ClassBuilder<I, O, C, SI, SO> {
    this._ep = endpointParameterInstructions;
    return this;
  }
  /**
   * Add any number of middleware.
   */
  public m(
    middlewareSupplier: (CommandCtor: any, clientStack: any, config: any, options: any) => Pluggable<any, any>[]
  ): ClassBuilder<I, O, C, SI, SO> {
    this._middlewareFn = middlewareSupplier;
    return this;
  }
  /**
   * Set the initial handler execution context Smithy field.
   */
  public s(
    service: string,
    operation: string,
    smithyContext: Record<string, unknown> = {}
  ): ClassBuilder<I, O, C, SI, SO> {
    this._smithyContext = {
      service,
      operation,
      ...smithyContext,
    };
    return this;
  }
  /**
   * Set the initial handler execution context.
   */
  public c(additionalContext: HandlerExecutionContext = {}): ClassBuilder<I, O, C, SI, SO> {
    this._additionalContext = additionalContext;
    return this;
  }
  /**
   * Set constant string identifiers for the operation.
   */
  public n(clientName: string, commandName: string): ClassBuilder<I, O, C, SI, SO> {
    this._clientName = clientName;
    this._commandName = commandName;
    return this;
  }
  /**
   * Set the input and output sensistive log filters.
   */
  public f(
    inputFilter: (_: any) => any = (_) => _,
    outputFilter: (_: any) => any = (_) => _
  ): ClassBuilder<I, O, C, SI, SO> {
    this._inputFilterSensitiveLog = inputFilter;
    this._outputFilterSensitiveLog = outputFilter;
    return this;
  }
  /**
   * Sets the serializer.
   */
  public ser(
    serializer: (input: I, context?: SerdeContext | any) => Promise<IHttpRequest>
  ): ClassBuilder<I, O, C, SI, SO> {
    this._serializer = serializer;
    return this;
  }
  /**
   * Sets the deserializer.
   */
  public de(
    deserializer: (output: IHttpResponse, context?: SerdeContext | any) => Promise<O>
  ): ClassBuilder<I, O, C, SI, SO> {
    this._deserializer = deserializer;
    return this;
  }
  /**
   * @returns a Command class with the classBuilder properties.
   */
  public build(): {
    new (...[input]: OptionalParameter<I>): CommandImpl<I, O, C, SI, SO>;
    getEndpointParameterInstructions(): EndpointParameterInstructions;
  } {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const closure = this;
    let CommandRef: any;

    return (CommandRef = class extends Command<I, O, C, SI, SO> {
      public readonly input: I;

      /**
       * @public
       */
      public static getEndpointParameterInstructions(): EndpointParameterInstructions {
        return closure._ep;
      }

      /**
       * @public
       */
      public constructor(...[input]: OptionalParameter<I>) {
        super();
        this.input = input ?? (({} as unknown) as I);
        closure._init(this);
      }

      /**
       * @internal
       */
      public resolveMiddleware(stack: IMiddlewareStack<any, any>, configuration: C, options: any): Handler<any, any> {
        return this.resolveMiddlewareWithContext(stack, configuration, options, {
          CommandCtor: CommandRef,
          middlewareFn: closure._middlewareFn,
          clientName: closure._clientName,
          commandName: closure._commandName,
          inputFilterSensitiveLog: closure._inputFilterSensitiveLog,
          outputFilterSensitiveLog: closure._outputFilterSensitiveLog,
          smithyContext: closure._smithyContext,
          additionalContext: closure._additionalContext,
        });
      }

      /**
       * @internal
       */
      // @ts-ignore used in middlewareFn closure.
      public serialize = closure._serializer;

      /**
       * @internal
       */
      // @ts-ignore used in middlewareFn closure.
      public deserialize = closure._deserializer;
    });
  }
}

/**
 * A concrete implementation of ICommand with no abstract members.
 * @public
 */
export interface CommandImpl<
  I extends SI,
  O extends SO,
  C extends { logger: Logger; requestHandler: RequestHandler<any, any, any> },
  SI extends object = any,
  SO extends MetadataBearer = any
> extends Command<I, O, C, SI, SO> {
  readonly input: I;
  resolveMiddleware(stack: IMiddlewareStack<SI, SO>, configuration: C, options: any): Handler<I, O>;
}
