import { constructStack } from "@smithy/middleware-stack";
import type {
  Client as IClient,
  Command,
  FetchHttpHandlerOptions,
  Handler,
  MetadataBearer,
  MiddlewareStack,
  NodeHttpHandlerOptions,
  RequestHandler,
} from "@smithy/types";

/**
 * @public
 */
export interface SmithyConfiguration<HandlerOptions> {
  requestHandler:
    | RequestHandler<any, any, HandlerOptions>
    | NodeHttpHandlerOptions
    | FetchHttpHandlerOptions
    | Record<string, unknown>;
  /**
   * The API version set internally by the SDK, and is
   * not planned to be used by customer code.
   * @internal
   */
  readonly apiVersion: string;
  /**
   * @public
   *
   * Default false.
   *
   * When true, the client will only resolve the middleware stack once per
   * Command class. This means modifying the middlewareStack of the
   * command or client after requests have been made will not be
   * recognized.
   *
   * Calling client.destroy() also clears this cache.
   *
   * Enable this only if needing the additional time saved (0-1ms per request)
   * and not needing middleware modifications between requests.
   */
  cacheMiddleware?: boolean;
}

/**
 * @internal
 */
export type SmithyResolvedConfiguration<HandlerOptions> = {
  requestHandler: RequestHandler<any, any, HandlerOptions>;
  readonly apiVersion: string;
  cacheMiddleware?: boolean;
};

/**
 * @public
 */
export class Client<
  HandlerOptions,
  ClientInput extends object,
  ClientOutput extends MetadataBearer,
  ResolvedClientConfiguration extends SmithyResolvedConfiguration<HandlerOptions>,
> implements IClient<ClientInput, ClientOutput, ResolvedClientConfiguration>
{
  public middlewareStack: MiddlewareStack<ClientInput, ClientOutput> = constructStack<ClientInput, ClientOutput>();

  /**
   * Holds an object reference to the initial configuration object.
   * Used to check that the config resolver stack does not create
   * dangling instances of an intermediate form of the configuration object.
   *
   * @internal
   */
  public initConfig?: object;

  /**
   * May be used to cache the resolved handler function for a Command class.
   */
  private handlers?: WeakMap<Function, Handler<any, any>> | undefined;

  constructor(public readonly config: ResolvedClientConfiguration) {}

  send<InputType extends ClientInput, OutputType extends ClientOutput>(
    command: Command<ClientInput, InputType, ClientOutput, OutputType, SmithyResolvedConfiguration<HandlerOptions>>,
    options?: HandlerOptions
  ): Promise<OutputType>;
  send<InputType extends ClientInput, OutputType extends ClientOutput>(
    command: Command<ClientInput, InputType, ClientOutput, OutputType, SmithyResolvedConfiguration<HandlerOptions>>,
    cb: (err: any, data?: OutputType) => void
  ): void;
  send<InputType extends ClientInput, OutputType extends ClientOutput>(
    command: Command<ClientInput, InputType, ClientOutput, OutputType, SmithyResolvedConfiguration<HandlerOptions>>,
    options: HandlerOptions,
    cb: (err: any, data?: OutputType) => void
  ): void;
  send<InputType extends ClientInput, OutputType extends ClientOutput>(
    command: Command<ClientInput, InputType, ClientOutput, OutputType, SmithyResolvedConfiguration<HandlerOptions>>,
    optionsOrCb?: HandlerOptions | ((err: any, data?: OutputType) => void),
    cb?: (err: any, data?: OutputType) => void
  ): Promise<OutputType> | void {
    const options = typeof optionsOrCb !== "function" ? optionsOrCb : undefined;
    const callback = typeof optionsOrCb === "function" ? (optionsOrCb as (err: any, data?: OutputType) => void) : cb;

    const useHandlerCache = options === undefined && this.config.cacheMiddleware === true;

    let handler: Handler<any, any>;

    if (useHandlerCache) {
      if (!this.handlers) {
        this.handlers = new WeakMap();
      }
      const handlers = this.handlers!;

      if (handlers.has(command.constructor)) {
        handler = handlers.get(command.constructor)!;
      } else {
        handler = command.resolveMiddleware(this.middlewareStack as any, this.config, options);
        handlers.set(command.constructor, handler);
      }
    } else {
      delete this.handlers;
      handler = command.resolveMiddleware(this.middlewareStack as any, this.config, options);
    }

    if (callback) {
      handler(command)
        .then(
          (result) => callback(null, result.output),
          (err: any) => callback(err)
        )
        .catch(
          // prevent any errors thrown in the callback from triggering an
          // unhandled promise rejection
          () => {}
        );
    } else {
      return handler(command).then((result) => result.output);
    }
  }

  destroy() {
    this.config?.requestHandler?.destroy?.();
    delete this.handlers;
  }
}
