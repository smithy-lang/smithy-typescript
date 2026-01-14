import type { Logger } from "@smithy/types";

/**
 * Caution: the default and intended behavior is to skip runtime typechecking
 * for performance and compatibility reasons. The server response will
 * contain validation information if requirements are not met, and
 * is the most accurate source.
 *
 * Client-side RTTC is provided as a convenience for a faster feedback loop
 * during script development, but cannot be relied upon as the authority.
 *
 * `trace`, `debug`, `info`, `warn`, and `error` will call the corresponding logger channel.
 * `throw` will instead throw an exception.
 *
 * `false` shuts off all runtime typecheck behavior (the default).
 *
 * @public
 */
export type RuntimeTypecheckBehavior = false | keyof Logger | "throw";

/**
 * Allows separate configuration of inputs and outputs.
 * If providing a single value (RuntimeTypecheckBehavior), it will apply ONLY
 * to inputs.
 *
 * @public
 */
export type RuntimeTypecheckOptions = {
  /**
   * The logger to call with the typecheck validation errors.
   */
  logger?: Logger;
  input?: RuntimeTypecheckBehavior;
  /**
   * Automatic `throw` is not supported in output validation.
   * We do not recommend throwing on output validation.
   */
  output?: false | keyof Logger;
};
