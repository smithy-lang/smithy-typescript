import { Symbol, SymbolDependency, type SymbolDependencyContainer } from "../codegen-core";
import type { Dependency } from "./Dependency";
import { DependencyVersions } from "./DependencyVersions";

const REGISTRY: TypeScriptDependency[] = [];

/**
 * The built-in dependencies managed by this package.
 *
 * @internal
 */
export class TypeScriptDependency implements Dependency, SymbolDependencyContainer {
  public static readonly NORMAL_DEPENDENCY = "dependencies";

  public static readonly SMITHY_TYPES = new TypeScriptDependency("dependencies", "@smithy/types", null, true);
  public static readonly SMITHY_CORE = new TypeScriptDependency("dependencies", "@smithy/core", null, false);
  public static readonly AWS_SDK_FETCH_HTTP_HANDLER = new TypeScriptDependency(
    "dependencies",
    "@smithy/fetch-http-handler",
    null,
    false
  );
  public static readonly AWS_SDK_NODE_HTTP_HANDLER = new TypeScriptDependency(
    "dependencies",
    "@smithy/node-http-handler",
    null,
    false
  );
  public static readonly BIG_JS = new TypeScriptDependency("dependencies", "big.js", "^6.0.0", false);
  public static readonly BODY_CHECKSUM = new TypeScriptDependency(
    "dependencies",
    "@smithy/middleware-apply-body-checksum",
    null,
    false
  );
  public static readonly HTML_ENTITIES = new TypeScriptDependency("dependencies", "entities", "2.2.0", false);
  public static readonly MIDDLEWARE_COMPRESSION = new TypeScriptDependency(
    "dependencies",
    "@smithy/middleware-compression",
    null,
    false
  );
  public static readonly SIGNATURE_V4 = new TypeScriptDependency("dependencies", "@smithy/signature-v4", null, false);
  public static readonly TYPES_BIG_JS = new TypeScriptDependency("devDependencies", "@types/big.js", "^6.0.0", false);
  public static readonly TYPES_NODE = new TypeScriptDependency("devDependencies", "@types/node", "^20.14.8", true);
  public static readonly XML_PARSER = new TypeScriptDependency("dependencies", "fast-xml-parser", "5.7.1", false);
  public static readonly MIDDLEWARE_ENDPOINTS_V2 = new TypeScriptDependency(
    "dependencies",
    "@smithy/middleware-endpoint",
    "0.0.0",
    false
  );
  public static readonly UTIL_ENDPOINTS = new TypeScriptDependency(
    "dependencies",
    "@smithy/util-endpoints",
    "0.0.0",
    false
  );
  public static readonly MIDDLEWARE_RETRY = new TypeScriptDependency(
    "dependencies",
    "@smithy/middleware-retry",
    "0.0.0",
    false
  );
  public static readonly UTIL_RETRY = new TypeScriptDependency("dependencies", "@smithy/util-retry", "0.0.0", false);
  public static readonly SERVER_COMMON = new TypeScriptDependency("dependencies", "@smithy/server-common", null, false);
  public static readonly SMITHY_TYPECHECK = new TypeScriptDependency("dependencies", "@smithy/typecheck", null, false);
  public static readonly SNAPSHOTS = new TypeScriptDependency(
    "devDependencies",
    "@smithy/snapshot-testing",
    null,
    false
  );
  public static readonly VITEST = new TypeScriptDependency("devDependencies", "vitest", "^4.0.17", false);
  public static readonly AWS_SDK_HASH_NODE = new TypeScriptDependency(
    "dependencies",
    "@smithy/hash-node",
    "0.0.0",
    false
  );
  public static readonly AWS_SDK_QUERYSTRING_BUILDER = new TypeScriptDependency(
    "dependencies",
    "@smithy/querystring-builder",
    "0.0.0",
    false
  );
  public static readonly AWS_SDK_TYPES = new TypeScriptDependency("dependencies", "@aws-sdk/types", "0.0.0", false);
  public static readonly AWS_SDK_URL_PARSER = new TypeScriptDependency(
    "dependencies",
    "@smithy/url-parser",
    "0.0.0",
    false
  );
  public static readonly AWS_SDK_UTIL_BODY_LENGTH_BROWSER = new TypeScriptDependency(
    "dependencies",
    "@smithy/util-body-length-browser",
    "0.0.0",
    false
  );
  public static readonly AWS_SDK_UTIL_BODY_LENGTH_NODE = new TypeScriptDependency(
    "dependencies",
    "@smithy/util-body-length-node",
    "0.0.0",
    false
  );
  public static readonly AWS_SDK_UTIL_DEFAULTS_MODE_BROWSER = new TypeScriptDependency(
    "dependencies",
    "@smithy/util-defaults-mode-browser",
    "0.0.0",
    false
  );
  public static readonly AWS_SDK_UTIL_DEFAULTS_MODE_NODE = new TypeScriptDependency(
    "dependencies",
    "@smithy/util-defaults-mode-node",
    "0.0.0",
    false
  );
  public static readonly AWS_SDK_UTIL_ENDPOINTS = new TypeScriptDependency(
    "dependencies",
    "@aws-sdk/util-endpoints",
    "0.0.0",
    false
  );
  public static readonly AWS_SDK_UTIL_MIDDLEWARE = new TypeScriptDependency(
    "dependencies",
    "@smithy/util-middleware",
    "0.0.0",
    false
  );
  public static readonly AWS_SDK_UTIL_WAITERS = new TypeScriptDependency(
    "dependencies",
    "@smithy/util-waiter",
    "0.0.0",
    false
  );
  public static readonly AWS_SMITHY_CLIENT = new TypeScriptDependency(
    "dependencies",
    "@smithy/smithy-client",
    "0.0.0",
    false
  );
  public static readonly CONFIG_RESOLVER = new TypeScriptDependency(
    "dependencies",
    "@smithy/config-resolver",
    "0.0.0",
    false
  );
  public static readonly INVALID_DEPENDENCY = new TypeScriptDependency(
    "dependencies",
    "@smithy/invalid-dependency",
    "0.0.0",
    false
  );
  public static readonly MD5_BROWSER = new TypeScriptDependency("dependencies", "@smithy/md5-js", "0.0.0", false);
  public static readonly MIDDLEWARE_CONTENT_LENGTH = new TypeScriptDependency(
    "dependencies",
    "@smithy/middleware-content-length",
    "0.0.0",
    false
  );
  public static readonly MIDDLEWARE_SERDE = new TypeScriptDependency(
    "dependencies",
    "@smithy/middleware-serde",
    "0.0.0",
    false
  );
  public static readonly MIDDLEWARE_STACK = new TypeScriptDependency(
    "dependencies",
    "@smithy/middleware-stack",
    "0.0.0",
    false
  );
  public static readonly NODE_CONFIG_PROVIDER = new TypeScriptDependency(
    "dependencies",
    "@smithy/node-config-provider",
    "0.0.0",
    false
  );
  public static readonly PROTOCOL_HTTP = new TypeScriptDependency(
    "dependencies",
    "@smithy/protocol-http",
    "0.0.0",
    false
  );
  public static readonly SMITHY_UUID = new TypeScriptDependency("dependencies", "@smithy/uuid", "0.0.0", false);
  public static readonly STREAM_HASHER_BROWSER = new TypeScriptDependency(
    "dependencies",
    "@smithy/hash-blob-browser",
    "0.0.0",
    false
  );
  public static readonly STREAM_HASHER_NODE = new TypeScriptDependency(
    "dependencies",
    "@smithy/hash-stream-node",
    "0.0.0",
    false
  );
  public static readonly UTIL_MIDDLEWARE = new TypeScriptDependency(
    "dependencies",
    "@smithy/util-middleware",
    "0.0.0",
    false
  );
  public static readonly UTIL_STREAM = new TypeScriptDependency("dependencies", "@smithy/util-stream", "0.0.0", false);
  public static readonly UTIL_STREAM_BROWSER = new TypeScriptDependency(
    "dependencies",
    "@smithy/util-stream-browser",
    "0.0.0",
    false
  );
  public static readonly UTIL_STREAM_NODE = new TypeScriptDependency(
    "dependencies",
    "@smithy/util-stream-node",
    "0.0.0",
    false
  );
  public static readonly UUID = new TypeScriptDependency("dependencies", "uuid", "0.0.0", false);
  public static readonly UUID_TYPES = new TypeScriptDependency("dependencies", "@types/uuid", "0.0.0", false);
  public static readonly AWS_SDK_EVENTSTREAM_CODEC = new TypeScriptDependency(
    "dependencies",
    "@smithy/eventstream-codec",
    "0.0.0",
    false
  );
  public static readonly AWS_SDK_EVENTSTREAM_SERDE_BROWSER = new TypeScriptDependency(
    "dependencies",
    "@smithy/eventstream-serde-browser",
    "0.0.0",
    false
  );
  public static readonly AWS_SDK_EVENTSTREAM_SERDE_CONFIG_RESOLVER = new TypeScriptDependency(
    "dependencies",
    "@smithy/eventstream-serde-config-resolver",
    "0.0.0",
    false
  );
  public static readonly AWS_SDK_EVENTSTREAM_SERDE_NODE = new TypeScriptDependency(
    "dependencies",
    "@smithy/eventstream-serde-node",
    "0.0.0",
    false
  );
  public static readonly TYPEDOC = new TypeScriptDependency("devDependencies", "typedoc", "0.23.23", false);
  public static readonly AWS_CRYPTO_SHA256_BROWSER = new TypeScriptDependency(
    "dependencies",
    "@aws-crypto/sha256-browser",
    "5.2.0",
    false
  );
  public static readonly AWS_CRYPTO_SHA256_JS = new TypeScriptDependency(
    "dependencies",
    "@aws-crypto/sha256-js",
    "5.2.0",
    false
  );
  public static readonly AWS_SDK_CLIENT_DOCGEN = new TypeScriptDependency(
    "devDependencies",
    "@smithy/service-client-documentation-generator",
    null,
    false
  );
  public static readonly EXPERIMENTAL_IDENTITY_AND_AUTH = new TypeScriptDependency(
    "dependencies",
    "@smithy/experimental-identity-and-auth",
    null,
    false
  );

  public readonly packageName: string;
  private readonly _type: string;
  private readonly _explicitVersion: string | null;
  private readonly _unconditional: boolean;
  private _dependency: SymbolDependency | undefined;

  private constructor(type: string, name: string, version: string | null, unconditional: boolean) {
    this._type = type;
    this.packageName = name;
    this._explicitVersion = version;
    this._unconditional = unconditional;
    REGISTRY.push(this);
  }

  public static getUnconditionalDependencies(): SymbolDependency[] {
    const resolved: SymbolDependency[] = [];
    for (const dependency of REGISTRY) {
      if (dependency._unconditional) {
        resolved.push(dependency.dependency);
      }
    }
    return resolved;
  }

  public static getAwsSdkLeadingClientVersion(): string {
    return "0.0.0";
  }

  public static getSmithyCoreVersion(): string | undefined {
    return DependencyVersions.get("@smithy/core");
  }

  public get version(): string {
    return this._resolveVersion();
  }

  public get dependency(): SymbolDependency {
    if (this._dependency === undefined) {
      this._dependency = SymbolDependency.builder()
        .dependencyType(this._type)
        .packageName(this.packageName)
        .version(this._resolveVersion())
        .putProperty("unconditional", this._unconditional)
        .build();
    }
    return this._dependency;
  }

  public getDependencies(): SymbolDependency[] {
    return [this.dependency];
  }

  public getPackageName(): string {
    return this.packageName;
  }

  public createSymbol(name: string): Symbol {
    return Symbol.builder().namespace(this.packageName, "/").name(name).addDependency(this.dependency).build();
  }

  public toString(): string {
    return this.packageName;
  }

  private _resolveVersion(): string {
    if (this._explicitVersion !== null) {
      return this._explicitVersion;
    }
    const name = this.packageName;
    let version = name.startsWith("@aws-sdk/") ? "latest" : DependencyVersions.get(name);
    if (version === undefined) {
      version = "latest";
    }
    const isSmithyServerPackage = name.startsWith("@smithy/server-");
    if ((name.startsWith("@smithy/") || name.startsWith("@aws-sdk/")) && !isSmithyServerPackage) {
      if (!version.startsWith("^") && /^\d+\.\d+\.\d+$/.test(version)) {
        version = "^" + version;
      }
    }
    return version;
  }
}
