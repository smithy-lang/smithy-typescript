import type { PaginationConfiguration, WaiterConfiguration } from "@smithy/types";

import type { Client } from "./client";

/**
 * @internal
 */
type AggregatedClientPaginationConfiguration = Omit<PaginationConfiguration, "client">;

/**
 * @internal
 */
type AggregatedClientWaiterConfiguration<C> = Omit<WaiterConfiguration<C>, "client">;

/**
 * @internal
 *
 * @param commands - command lookup container.
 * @param Client - client instance on which to add aggregated methods.
 * @param options
 * @param options.paginators - paginator functions.
 * @param options.waiters - waiter functions.
 *
 * @returns an aggregated client with dynamically created methods.
 */
export const createAggregatedClient = (
  commands: Record<string, any>,
  Client: { new (...args: any): Client<any, any, any, any> },
  options?: {
    paginators?: Record<string, any>;
    waiters?: Record<string, any>;
  }
): void => {
  type CommandInput = any;
  for (const [command, CommandCtor] of Object.entries(commands)) {
    const methodImpl = async function (
      this: InstanceType<typeof Client>,
      args: CommandInput,
      optionsOrCb: any,
      cb: any
    ) {
      const command: any = new CommandCtor(args);
      if (typeof optionsOrCb === "function") {
        this.send(command, optionsOrCb);
      } else if (typeof cb === "function") {
        if (typeof optionsOrCb !== "object") throw new Error(`Expected http options but got ${typeof optionsOrCb}`);
        this.send(command, optionsOrCb || {}, cb);
      } else {
        return this.send(command, optionsOrCb);
      }
    };
    const methodName = (command[0].toLowerCase() + command.slice(1)).replace(/Command$/, "");
    Client.prototype[methodName] = methodImpl;
  }
  const { paginators = {}, waiters = {} } = options ?? {};
  for (const [paginatorName, paginatorFn] of Object.entries(paginators)) {
    if (Client.prototype[paginatorName] === void 0) {
      Client.prototype[paginatorName] = function (
        this: InstanceType<typeof Client>,
        commandInput: CommandInput = {},
        paginationConfiguration: AggregatedClientPaginationConfiguration,
        ...rest: any[]
      ) {
        return paginatorFn(
          {
            ...paginationConfiguration,
            client: this,
          },
          commandInput,
          ...rest
        );
      };
    }
  }
  for (const [waiterName, waiterFn] of Object.entries(waiters)) {
    if (Client.prototype[waiterName] === void 0) {
      Client.prototype[waiterName] = async function (
        this: InstanceType<typeof Client>,
        commandInput: CommandInput = {},
        waiterConfiguration: AggregatedClientWaiterConfiguration<typeof Client> | number,
        ...rest: any[]
      ) {
        let config = waiterConfiguration as AggregatedClientWaiterConfiguration<typeof Client>;
        if (typeof waiterConfiguration === "number") {
          config = {
            maxWaitTime: waiterConfiguration,
          };
        }
        return waiterFn(
          {
            ...config,
            client: this,
          },
          commandInput,
          ...rest
        );
      };
    }
  }
};
