import type {
  EndpointParameterInstructions,
  Logger,
  MetadataBearer,
  OptionalParameter,
  Pluggable,
  RequestHandler,
  StaticOperationSchema,
} from "@smithy/types";

import { Command, type CommandImpl } from "./command";

/**
 * Higher order factory for Command builders specific to a client.
 * Produces a command factory that creates Command classes with
 * pre-configured endpoint params, middleware, and schema.
 *
 * @param common - common endpoint params.
 * @param service - service shape name.
 * @param name - SDK Client Name.
 * @param ep - endpoint plugin provider.
 *
 * @internal
 */
export function makeBuilder<
  C extends { logger?: Logger; requestHandler: RequestHandler<any, any, any> },
  SI extends object,
  SO extends MetadataBearer,
>(
  common: EndpointParameterInstructions,
  service: string,
  name: string,
  ep: (config: any, instructions: any) => Pluggable<any, any>
) {
  /**
   * @param added - additional endpoint params.
   * @param plugins - customization plugins.
   * @param op - operation shape name.
   * @param $ - operation schema.
   * @param smithyContext
   * @internal
   */
  return function makeCommand<I extends SI, O extends SO>(
    added: EndpointParameterInstructions,
    plugins: (CommandCtor: any, clientStack: any, config: any, options: any) => Pluggable<any, any>[],
    op: string,
    $: StaticOperationSchema,
    smithyContext: Record<string, unknown> = {}
  ): {
    new (input: I): CommandImpl<I, O, C, SI, SO>;
    new (...[input]: OptionalParameter<I>): CommandImpl<I, O, C, SI, SO>;
    getEndpointParameterInstructions(): EndpointParameterInstructions;
  } {
    const epMerged: EndpointParameterInstructions = Object.assign({}, common, added);
    return Command.classBuilder<I, O, C, SI, SO>()
      .ep(epMerged)
      .m(function (this: any, CommandCtor: any, clientStack: any, config: any, options: any) {
        const list = plugins.call(this, CommandCtor, clientStack, config, options);
        list.unshift(ep(config, CommandCtor.getEndpointParameterInstructions()));
        return list;
      })
      .s(service, op, smithyContext)
      .n(name, op.charAt(0).toUpperCase() + op.slice(1) + "Command")
      .sc($)
      .build();
  };
}
