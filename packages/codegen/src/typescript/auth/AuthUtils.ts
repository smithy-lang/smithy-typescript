import { CodegenException, type SymbolDependency } from "../../codegen-core";
import type { ServiceIndex, TopDownIndex } from "../../model";
import { type ServiceShape, ShapeId, TreeMap, type Trait } from "../../model";
import type { Dependency } from "../Dependency";
import { CodegenUtils } from "../CodegenUtils";
import { JavaHashMap } from "../util";
import type { ConfigField } from "./http/ConfigField";
import type { HttpAuthScheme } from "./http/HttpAuthScheme";
import type { HttpAuthSchemeParameter } from "./http/HttpAuthSchemeParameter";
import type { ResolveConfigFunction } from "./http/ResolveConfigFunction";
import type { SupportedHttpAuthSchemesIndex } from "./http/SupportedHttpAuthSchemesIndex";

const moduleDependency = (packageName: string): Dependency => ({
  getPackageName: () => packageName,
  getDependencies: (): SymbolDependency[] => [],
});

/**
 * Shared constants and collectors for HTTP auth generation.
 *
 * @internal
 */
export class AuthUtils {
  public static readonly HTTP_AUTH_SCHEME_PROVIDER_MODULE = [
    ".",
    CodegenUtils.SOURCE_FOLDER,
    "auth",
    "httpAuthSchemeProvider",
  ].join("/");
  public static readonly HTTP_AUTH_SCHEME_PROVIDER_PATH = AuthUtils.HTTP_AUTH_SCHEME_PROVIDER_MODULE + ".ts";
  public static readonly AUTH_HTTP_PROVIDER_DEPENDENCY: Dependency = moduleDependency(
    AuthUtils.HTTP_AUTH_SCHEME_PROVIDER_MODULE
  );
  public static readonly HTTP_AUTH_SCHEME_EXTENSION_MODULE = [
    ".",
    CodegenUtils.SOURCE_FOLDER,
    "auth",
    "httpAuthExtensionConfiguration",
  ].join("/");
  public static readonly HTTP_AUTH_SCHEME_EXTENSION_PATH = AuthUtils.HTTP_AUTH_SCHEME_EXTENSION_MODULE + ".ts";
  public static readonly AUTH_HTTP_EXTENSION_DEPENDENCY: Dependency = moduleDependency(
    AuthUtils.HTTP_AUTH_SCHEME_EXTENSION_MODULE
  );

  private constructor() {}

  /** Effective schemes keyed and ordered by shape ID. */
  public static getAllEffectiveNoAuthAwareAuthSchemes(
    serviceShape: ServiceShape,
    serviceIndex: ServiceIndex,
    authIndex: SupportedHttpAuthSchemesIndex,
    topDownIndex: TopDownIndex
  ): Map<string, HttpAuthScheme | undefined> {
    const effective = new TreeMap<string, HttpAuthScheme | undefined>((a, b) =>
      ShapeId.from(a).compareTo(ShapeId.from(b))
    );
    const serviceSchemes = serviceIndex.getEffectiveAuthSchemes(serviceShape, "NO_AUTH_AWARE");
    for (const shapeId of serviceSchemes.keys()) {
      effective.set(shapeId.toString(), authIndex.getHttpAuthScheme(shapeId));
    }
    for (const operation of topDownIndex.getContainedOperations(serviceShape)) {
      const operationSchemes = serviceIndex.getEffectiveAuthSchemes(serviceShape, operation, "NO_AUTH_AWARE");
      for (const shapeId of operationSchemes.keys()) {
        effective.set(shapeId.toString(), authIndex.getHttpAuthScheme(shapeId));
      }
    }
    const sigv4 = ShapeId.from("aws.auth#sigv4").toString();
    const sigv4a = ShapeId.from("aws.auth#sigv4a");
    const supportedSigv4a = authIndex.getHttpAuthScheme(sigv4a);
    if (
      effective.get(sigv4) !== undefined &&
      effective.get(sigv4a.toString()) === undefined &&
      supportedSigv4a !== undefined
    ) {
      effective.set(supportedSigv4a.getSchemeId().toString(), supportedSigv4a);
    }
    return effective;
  }

  public static collectConfigFields(httpAuthSchemes: Iterable<HttpAuthScheme | undefined>): JavaHashMap<ConfigField> {
    const configFields = new JavaHashMap<ConfigField>();
    for (const authScheme of httpAuthSchemes) {
      if (authScheme === undefined) {
        continue;
      }
      for (const configField of authScheme.getConfigFields()) {
        const existing = configFields.get(configField.name);
        if (existing !== undefined) {
          if (!AuthUtils._sameValue(configField, existing)) {
            throw new CodegenException(
              `Contradicting \`ConfigField\` definitions for \`${configField.name}\`; existing: ${existing}, conflict: ${configField}`
            );
          }
        } else {
          configFields.set(configField.name, configField);
        }
      }
    }
    return configFields;
  }

  /** Resolve functions keyed by the symbol's string form. */
  public static collectResolveConfigFunctions(
    httpAuthSchemes: Iterable<HttpAuthScheme | undefined>
  ): Map<string, ResolveConfigFunction> {
    const result = new Map<string, ResolveConfigFunction>();
    for (const authScheme of httpAuthSchemes) {
      if (authScheme === undefined) {
        continue;
      }
      for (const fn of authScheme.getResolveConfigFunctions()) {
        const key = fn.resolveConfigFunction.toString();
        const existing = result.get(key);
        if (existing !== undefined) {
          if (!AuthUtils._sameValue(fn, existing)) {
            throw new CodegenException(
              `Contradicting \`ResolveConfigFunction\` definitions for \`${key}\`; existing: ${existing}, conflict: ${fn}`
            );
          }
        } else {
          result.set(key, fn);
        }
      }
    }
    return result;
  }

  public static collectHttpAuthSchemeParameters(
    httpAuthSchemes: Iterable<HttpAuthScheme | undefined>
  ): JavaHashMap<HttpAuthSchemeParameter> {
    const parameters = new JavaHashMap<HttpAuthSchemeParameter>();
    for (const authScheme of httpAuthSchemes) {
      if (authScheme === undefined) {
        continue;
      }
      for (const param of authScheme.getHttpAuthSchemeParameters()) {
        const existing = parameters.get(param.name);
        if (existing !== undefined) {
          if (!AuthUtils._sameValue(param, existing)) {
            throw new CodegenException(
              `Contradicting \`HttpAuthSchemeParameter\` definitions for \`${param.name}\`; existing: ${existing}, conflict: ${param}`
            );
          }
        } else {
          parameters.set(param.name, param);
        }
      }
    }
    return parameters;
  }

  public static areHttpAuthSchemesEqual(a: Map<ShapeId, Trait>, b: Map<ShapeId, Trait>): boolean {
    if (a.size !== b.size) {
      return false;
    }
    const entriesB = [...b.entries()];
    return [...a.entries()].every(
      ([id, trait], i) =>
        id.equals(entriesB[i][0]) && JSON.stringify(trait.toNode()) === JSON.stringify(entriesB[i][1].toNode())
    );
  }

  private static _sameValue(a: object, b: object): boolean {
    if (a === b) {
      return true;
    }
    const keys = Object.keys(a) as (keyof typeof a)[];
    return keys.every((key) => a[key] === (b as typeof a)[key]);
  }
}
