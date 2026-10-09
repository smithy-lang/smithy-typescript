import { NormalizedSchema, TypeRegistry } from "@smithy/core/schema";
import type { StaticErrorSchema } from "@smithy/types";

type ErrorStatus = {
  readonly $fault?: "client" | "server";
  readonly $metadata?: {
    readonly httpStatusCode?: number;
  };
  readonly statusCode?: number;
};

const isStaticErrorSchema = (schema: unknown): schema is StaticErrorSchema => Array.isArray(schema) && schema[0] === -3;

const getModeledErrorStatusCode = (error: object): number | undefined => {
  for (const registry of TypeRegistry.registries.values()) {
    const errorSchema = registry.find((schema) => {
      if (!isStaticErrorSchema(schema)) {
        return false;
      }

      const errorConstructor = registry.getErrorCtor(schema);
      return typeof errorConstructor === "function" && errorConstructor.prototype?.isPrototypeOf(error);
    });

    if (isStaticErrorSchema(errorSchema)) {
      const httpError = NormalizedSchema.of(errorSchema).getOwnTraits().httpError;
      if (typeof httpError === "number") {
        return httpError;
      }
    }
  }

  return undefined;
};

/**
 * Resolves an HTTP status code for a server error.
 *
 * Explicit runtime status codes take precedence over the modeled `httpError`
 * trait. Errors without either use the Smithy defaults for client and server
 * faults.
 *
 * @internal
 */
export const resolveErrorStatusCode = (error: unknown): number => {
  if (error === null || (typeof error !== "object" && typeof error !== "function")) {
    return 500;
  }

  const errorStatus = error as ErrorStatus;
  return (
    errorStatus.$metadata?.httpStatusCode ??
    errorStatus.statusCode ??
    getModeledErrorStatusCode(error) ??
    (errorStatus.$fault === "client" ? 400 : 500)
  );
};
