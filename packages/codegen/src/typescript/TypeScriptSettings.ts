import { CodegenException } from "../codegen-core";
import type { Model, ServiceShape } from "../model";
import { ServiceIndex, ShapeId } from "../model";
import { ProtocolPriorityConfig } from "./protocols/ProtocolPriorityConfig";

/**
 * @internal
 */
export type JsonObject = { [key: string]: unknown };

/**
 * @internal
 */
export type ArtifactType = "CLIENT" | "SSDK" | "TYPES";
/**
 * @internal
 */
export type RequiredMemberMode = "nullable" | "strict";
type PackageManagerName = "yarn" | "npm" | "pnpm";

const PACKAGE = "package";
const PACKAGE_DESCRIPTION = "packageDescription";
const PACKAGE_VERSION = "packageVersion";
const PACKAGE_JSON = "packageJson";
const SERVICE = "service";
const PROTOCOL = "protocol";
const PRIVATE = "private";
const PACKAGE_MANAGER = "packageManager";
const CREATE_DEFAULT_README = "createDefaultReadme";
const USE_LEGACY_AUTH = "useLegacyAuth";
const GENERATE_INDEX_TESTS = "generateIndexTests";
const GENERATE_SNAPSHOT_TESTS = "generateSnapshotTests";
const SERVICE_PROTOCOL_PRIORITY = "serviceProtocolPriority";
const DEFAULT_PROTOCOL_PRIORITY = "defaultProtocolPriority";
const BIG_NUMBER_MODE = "bigNumberMode";
const GENERATE_SCHEMAS = "generateSchemas";
const GENERATE_SERVER_SCHEMAS = "generateServerSchemas";
const GENERATE_ENDPOINT_BDD = "generateEndpointBdd";
const VERSIONING_SCHEME = "versioningScheme";
const TSCONFIG = "tsconfig";
const MODES = "modes";
const CLOSURE = "closure";
const TYPESCRIPT_VERSION = "typescriptVersion";
const DISABLE_DEFAULT_VALIDATION = "disableDefaultValidation";
const REQUIRED_MEMBER_MODE = "requiredMemberMode";
const DEFAULT_TYPESCRIPT_VERSION = "~5.8.3";

const COMMON = [
  PACKAGE,
  PACKAGE_DESCRIPTION,
  PACKAGE_JSON,
  PACKAGE_VERSION,
  PACKAGE_MANAGER,
  PRIVATE,
  REQUIRED_MEMBER_MODE,
  BIG_NUMBER_MODE,
  GENERATE_SCHEMAS,
  VERSIONING_SCHEME,
  TSCONFIG,
  TYPESCRIPT_VERSION,
];
const SERVICE_COMMON = [
  SERVICE,
  PROTOCOL,
  CREATE_DEFAULT_README,
  GENERATE_INDEX_TESTS,
  GENERATE_SNAPSHOT_TESTS,
  GENERATE_ENDPOINT_BDD,
  SERVICE_PROTOCOL_PRIORITY,
  DEFAULT_PROTOCOL_PRIORITY,
];

const ARTIFACT_CONFIG: Record<ArtifactType, { modeName: string; properties: string[] }> = {
  CLIENT: { modeName: "client", properties: [...COMMON, ...SERVICE_COMMON, USE_LEGACY_AUTH] },
  SSDK: {
    modeName: "server",
    properties: [...COMMON, ...SERVICE_COMMON, DISABLE_DEFAULT_VALIDATION, GENERATE_SERVER_SCHEMAS],
  },
  TYPES: { modeName: "types", properties: [...COMMON, CLOSURE] },
};

const PACKAGE_MANAGERS: Record<PackageManagerName, { command: string; execCommand: string }> = {
  yarn: { command: "yarn", execCommand: "yarn dlx" },
  npm: { command: "npm", execCommand: "npx" },
  pnpm: { command: "pnpm", execCommand: "pnpm dlx" },
};

/**
 * Settings used by the TypeScript codegen plugins.
 *
 * @internal
 */
export class TypeScriptSettings {
  private _packageName: string | undefined;
  private _packageDescription = "";
  private _packageVersion: string | undefined;
  private _packageJson: JsonObject = {};
  private _service: ShapeId | undefined;
  private _pluginSettings: JsonObject = {};
  private _protocol: ShapeId | undefined;
  private _defaultSigningName = "";
  private _isPrivate = false;
  private _artifactTypes: Set<ArtifactType> = new Set(["CLIENT"]);
  private _closure: string | undefined;
  private _disableDefaultValidation = false;
  private _requiredMemberMode: RequiredMemberMode = "nullable";
  private _packageManager: PackageManagerName = "yarn";
  private _createDefaultReadme = false;
  private _useLegacyAuth = false;
  private _protocolPriorityConfig = new ProtocolPriorityConfig(null, null);
  private _bigNumberMode = "native";
  private _generateSchemas = true;
  private _generateServerSchemas = false;
  private _generateEndpointBdd = true;
  private _generateIndexTests = false;
  private _generateSnapshotTests = false;
  private _versioningScheme = "";
  private _isolatedModules = false;
  private _typescriptVersion = DEFAULT_TYPESCRIPT_VERSION;

  public static from(model: Model, config: JsonObject, artifactType: ArtifactType = "CLIENT"): TypeScriptSettings {
    if (config[MODES] !== undefined) {
      throw new CodegenException("The 'modes' setting is only supported by the unified 'typescript-codegen' plugin.");
    }
    return TypeScriptSettings._from(model, config, new Set([artifactType]), false);
  }

  public static fromWithModes(model: Model, config: JsonObject): TypeScriptSettings {
    return TypeScriptSettings._from(model, config, TypeScriptSettings._resolveArtifactTypes(config), true);
  }

  public static artifactTypeFromMode(mode: string): ArtifactType {
    for (const [type, { modeName }] of Object.entries(ARTIFACT_CONFIG)) {
      if (modeName.toLowerCase() === mode.toLowerCase()) {
        return type as ArtifactType;
      }
    }
    throw new CodegenException(`Unsupported codegen mode: '${mode}'. Expected one of: client, server, types`);
  }

  public getPackageName(): string {
    if (this._packageName === undefined) {
      throw new Error(PACKAGE + " not set");
    }
    return this._packageName;
  }

  public getPackageDescription(): string {
    return this._packageDescription;
  }

  public getPackageVersion(): string {
    return this._packageVersion as string;
  }

  public setPackageVersion(packageVersion: string): void {
    this._packageVersion = packageVersion;
  }

  public getBigNumberMode(): string {
    return this._bigNumberMode;
  }

  public setBigNumberMode(mode: string): void {
    if (mode !== "big.js" && mode !== "native") {
      throw new Error('bigNumberMode must be one of ["native", "big.js"]');
    }
    this._bigNumberMode = mode;
  }

  public generateSchemas(): boolean {
    return this._generateSchemas;
  }

  public generateServerSchemas(): boolean {
    return this._generateServerSchemas;
  }

  public generateEndpointBdd(): boolean {
    return this._generateEndpointBdd;
  }

  public generateIndexTests(): boolean {
    return this._generateIndexTests;
  }

  public generateSnapshotTests(): boolean {
    return this._generateSnapshotTests;
  }

  public getVersioningScheme(): string {
    return this._versioningScheme;
  }

  public isolatedModules(): boolean {
    return this._isolatedModules;
  }

  public getTypescriptVersion(): string {
    return this._typescriptVersion;
  }

  public getPackageJson(): JsonObject {
    return this._packageJson;
  }

  public getService(): ShapeId;
  public getService(model: Model): ServiceShape;
  public getService(model?: Model): ShapeId | ServiceShape {
    if (this._service === undefined) {
      throw new Error(SERVICE + " not set");
    }
    if (model === undefined) {
      return this._service;
    }
    const shape = model.getShape(this._service);
    if (shape === undefined) {
      throw new CodegenException("Service shape not found: " + this._service);
    }
    const service = shape.asServiceShape();
    if (service === undefined) {
      throw new CodegenException("Shape is not a Service: " + this._service);
    }
    return service;
  }

  public getOptionalService(): ShapeId | undefined {
    return this._service;
  }

  public isPrivate(): boolean {
    return this._isPrivate;
  }

  public generateClient(): boolean {
    return this._artifactTypes.has("CLIENT");
  }

  public generateServerSdk(): boolean {
    return this._artifactTypes.has("SSDK");
  }

  public generateTypes(): boolean {
    return this._artifactTypes.has("TYPES");
  }

  public isTypesOnly(): boolean {
    return this._artifactTypes.size === 1 && this.generateTypes();
  }

  public getArtifactType(): ArtifactType {
    if (this.generateClient()) {
      return "CLIENT";
    }
    if (this.generateServerSdk()) {
      return "SSDK";
    }
    return "TYPES";
  }

  public getRequiredMemberMode(): RequiredMemberMode {
    return this._requiredMemberMode;
  }

  public getPackageManagerCommand(): string {
    return PACKAGE_MANAGERS[this._packageManager].command;
  }

  public getPackageManagerExecCommand(): string {
    return PACKAGE_MANAGERS[this._packageManager].execCommand;
  }

  public useLegacyAuth(): boolean;
  public useLegacyAuth(useLegacyAuth: boolean): void;
  public useLegacyAuth(useLegacyAuth?: boolean): boolean | void {
    if (useLegacyAuth === undefined) {
      return this._useLegacyAuth;
    }
    this._useLegacyAuth = useLegacyAuth;
  }

  public getProtocol(): ShapeId | undefined {
    return this._protocol;
  }

  public setProtocol(protocol: ShapeId): void {
    this._protocol = protocol;
  }

  public resolveServiceProtocol(model: Model, service: ServiceShape, supportedProtocols: ShapeId[]): ShapeId {
    if (this._protocol !== undefined) {
      return this._protocol;
    }
    const resolved = new Set<string>([...ServiceIndex.of(model).getProtocols(service).keys()].map(String));
    if (resolved.size === 0) {
      throw new UnresolvableProtocolException(
        `Unable to derive the protocol setting of the service \`${service.getId()}\` because no protocol definition traits were present. You need to set an explicit \`protocol\` to generate in smithy-build.json to generate this service.`
      );
    }
    const configured = this._protocolPriorityConfig.getProtocolPriority(service.getId());
    const priority = configured !== null && configured.length > 0 ? configured : supportedProtocols;
    const match = priority.find((p) => resolved.has(p.toString()));
    if (match === undefined) {
      throw new UnresolvableProtocolException(
        `The ${service.getId()} service supports the following unsupported protocols [${[...resolved].join(", ")}]. The following protocol generators were found on the class path: [${supportedProtocols.join(", ")}]`
      );
    }
    return match;
  }

  public getDefaultSigningName(): string {
    return this._defaultSigningName;
  }

  private static _from(
    model: Model,
    config: JsonObject,
    artifactTypes: Set<ArtifactType>,
    allowModesSetting: boolean
  ): TypeScriptSettings {
    const settings = new TypeScriptSettings();
    settings._artifactTypes = artifactTypes;

    const allowed = new Set<string>(allowModesSetting ? [MODES] : []);
    for (const type of artifactTypes) {
      ARTIFACT_CONFIG[type].properties.forEach((p) => allowed.add(p));
    }
    for (const key of Object.keys(config)) {
      if (!allowed.has(key)) {
        console.warn(`Unexpected configuration property: ${key}`);
      }
    }

    settings._closure = typeof config[CLOSURE] === "string" ? config[CLOSURE] : undefined;
    if (settings._closure !== undefined && !settings.generateTypes()) {
      throw new CodegenException("The 'closure' setting can only be used in types mode (modes: [\"types\"]).");
    }
    if (settings.isTypesOnly() && config[SERVICE] !== undefined) {
      throw new CodegenException("The 'service' setting cannot be used in types-only mode.");
    }
    if (settings.generateClient() || settings.generateServerSdk()) {
      settings._service =
        typeof config[SERVICE] === "string" ? ShapeId.from(config[SERVICE]) : TypeScriptSettings._inferService(model);
    }

    settings._packageName = TypeScriptSettings._expectString(config, PACKAGE);
    settings._packageVersion = TypeScriptSettings._expectString(config, PACKAGE_VERSION);
    settings._packageDescription =
      typeof config[PACKAGE_DESCRIPTION] === "string" ? config[PACKAGE_DESCRIPTION] : settings._getDefaultDescription();
    settings._packageJson = (config[PACKAGE_JSON] as JsonObject | undefined) ?? {};
    if (!settings.isTypesOnly() && typeof config[PROTOCOL] === "string") {
      settings._protocol = ShapeId.from(config[PROTOCOL]);
    }
    settings._isPrivate = config[PRIVATE] === true;
    if (!settings.isTypesOnly()) {
      settings._createDefaultReadme = config[CREATE_DEFAULT_README] === true;
    }
    if (settings.generateClient()) {
      settings._useLegacyAuth = config[USE_LEGACY_AUTH] === true;
    }
    if (typeof config[PACKAGE_MANAGER] === "string") {
      const name = config[PACKAGE_MANAGER];
      if (!(name in PACKAGE_MANAGERS)) {
        throw new CodegenException(`Unsupported package manager: ${name}`);
      }
      settings._packageManager = name as PackageManagerName;
    }
    if (settings.generateServerSdk()) {
      settings._disableDefaultValidation = config[DISABLE_DEFAULT_VALIDATION] === true;
    }
    if (typeof config[REQUIRED_MEMBER_MODE] === "string") {
      const mode = config[REQUIRED_MEMBER_MODE];
      if (mode !== "nullable" && mode !== "strict") {
        throw new CodegenException(`Unsupported required member mode: ${mode}`);
      }
      settings._requiredMemberMode = mode;
    }

    settings._pluginSettings = config;
    if (!settings.isTypesOnly()) {
      settings._readProtocolPriorityConfiguration(config);
    }
    settings.setBigNumberMode(typeof config[BIG_NUMBER_MODE] === "string" ? config[BIG_NUMBER_MODE] : "native");
    settings._generateSchemas = config[GENERATE_SCHEMAS] !== false;
    settings._generateServerSchemas = config[GENERATE_SERVER_SCHEMAS] === true;
    settings._generateEndpointBdd = config[GENERATE_ENDPOINT_BDD] !== false;
    settings._generateIndexTests = config[GENERATE_INDEX_TESTS] === true;
    settings._generateSnapshotTests = config[GENERATE_SNAPSHOT_TESTS] === true;
    settings._versioningScheme = typeof config[VERSIONING_SCHEME] === "string" ? config[VERSIONING_SCHEME] : "";
    const tsconfig = config[TSCONFIG] as JsonObject | undefined;
    const types = tsconfig?.types as JsonObject | undefined;
    const compilerOptions = types?.compilerOptions as JsonObject | undefined;
    settings._isolatedModules = compilerOptions?.isolatedModules === true;
    settings._typescriptVersion =
      typeof config[TYPESCRIPT_VERSION] === "string" ? config[TYPESCRIPT_VERSION] : DEFAULT_TYPESCRIPT_VERSION;
    return settings;
  }

  private static _resolveArtifactTypes(config: JsonObject): Set<ArtifactType> {
    const modes = config[MODES];
    if (modes === undefined) {
      return new Set(["CLIENT"]);
    }
    const types = new Set<ArtifactType>();
    for (const mode of modes as string[]) {
      types.add(TypeScriptSettings.artifactTypeFromMode(mode));
    }
    if (types.size === 0) {
      throw new CodegenException("At least one codegen mode must be specified.");
    }
    if (types.has("CLIENT") && types.has("SSDK")) {
      throw new CodegenException("The 'client' and 'server' modes cannot be combined in a single plugin invocation.");
    }
    return types;
  }

  private static _expectString(config: JsonObject, key: string): string {
    const value = config[key];
    if (typeof value !== "string") {
      throw new CodegenException(`Expected a string member named \`${key}\` in plugin settings`);
    }
    return value;
  }

  private static _inferService(model: Model): ShapeId {
    const services = model
      .getServiceShapes()
      .map((s) => s.getId().toString())
      .sort();
    if (services.length === 0) {
      throw new CodegenException(
        "Cannot infer a service to generate because the model does not contain any service shapes"
      );
    }
    if (services.length > 1) {
      throw new CodegenException(
        `Cannot infer a service to generate because the model contains multiple service shapes: [${services.join(", ")}]`
      );
    }
    return ShapeId.from(services[0]);
  }

  private _getDefaultDescription(): string {
    const suffix = { CLIENT: " client", SSDK: " server", TYPES: " types" }[this.getArtifactType()];
    return this.getPackageName() + suffix;
  }

  private _readProtocolPriorityConfiguration(config: JsonObject): void {
    const perService = new Map<string, ShapeId[]>();
    const toIds = (value: unknown): ShapeId[] => (value as string[]).map((id) => ShapeId.from(id));
    try {
      const priority = config[SERVICE_PROTOCOL_PRIORITY] as JsonObject | undefined;
      if (priority !== undefined) {
        for (const [service, protocols] of Object.entries(priority)) {
          perService.set(ShapeId.from(service).toString(), toIds(protocols));
        }
      }
      const defaults = config[DEFAULT_PROTOCOL_PRIORITY] === undefined ? [] : toIds(config[DEFAULT_PROTOCOL_PRIORITY]);
      this._protocolPriorityConfig = new ProtocolPriorityConfig(perService, defaults.length === 0 ? null : defaults);
    } catch (e) {
      throw new Error(
        `Error while parsing serviceProtocolPriority or defaultProtocolPriority configuration fields: ${e}`
      );
    }
  }
}

/**
 * @internal
 */
export class UnresolvableProtocolException extends Error {}
