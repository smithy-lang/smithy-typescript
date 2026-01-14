import type {
  HandlerExecutionContext,
  InitializeHandler,
  InitializeHandlerArguments,
  InitializeHandlerOptions,
  MetadataBearer,
  MiddlewareStack,
  Pluggable,
  StaticOperationSchema,
} from "@smithy/types";
import { getSmithyContext } from "@smithy/util-middleware";

import type { RuntimeTypecheckOptions } from "./types";
import { validateSchema } from "./validateSchema";

/**
 * Applies a configurable middleware that performs runtime typechecks on request inputs and response outputs.
 * @public
 */
export function getRuntimeTypecheckPlugin<InputType extends object = any, OutputType extends MetadataBearer = any>(
  options: RuntimeTypecheckOptions
): Pluggable<InputType, OutputType> {
  return {
    applyToStack: (commandStack: MiddlewareStack<InputType, OutputType>) => {
      commandStack.add(rttcMiddleware(options), rttcMiddlewareOptions);
    },
  };
}

/**
 * @internal
 */
const rttcMiddlewareOptions: InitializeHandlerOptions = {
  name: "runtimeTypecheckMiddleware",
  step: "initialize",
  tags: ["RUNTIME_TYPECHECK"],
  override: true,
};

/**
 * @internal
 */
const runtimeTypecheckMiddleware =
  (options: RuntimeTypecheckOptions) => (next: InitializeHandler<any, any>, context: HandlerExecutionContext) => {
    const n = options;

    return async (args: InitializeHandlerArguments<any>) => {
      const { input } = args;
      const { operationSchema } = getSmithyContext(context) as {
        operationSchema: StaticOperationSchema;
      };

      if (!operationSchema) {
        throw new Error(`@smithy/typecheck::rttcMiddleware - unsupported client version.`);
      }

      if (operationSchema?.[4]) {
        const errors = validateSchema(operationSchema[4], input);
        if (n.input && errors.length) {
          const msg = `${context.clientName}->${context.commandName} input validation: \n\t${errors.join("\n\t")}`;
          if (n.input === "throw") {
            throw new Error(msg);
          } else {
            options?.logger?.[n.input]?.(msg);
          }
        }
      }

      const result = await next(args);

      const { output } = result;
      if (operationSchema?.[5]) {
        const copy = {
          ...output,
        };
        delete copy.$metadata;
        const errors = validateSchema(operationSchema[5], copy);
        if (n.output && errors.length) {
          const msg = `${context.clientName}->${context.commandName} output validation: \n\t${errors.join("\n\t")}`;
          options?.logger?.[n.output]?.(msg);
        }
      }
      return result;
    };
  };
