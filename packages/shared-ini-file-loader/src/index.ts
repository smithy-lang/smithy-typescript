/** @deprecated Use @smithy/core/config instead. */
export {
  getHomeDir,
  ENV_PROFILE,
  DEFAULT_PROFILE,
  getProfileName,
  getSSOTokenFilepath,
  getSSOTokenFromFile,
  CONFIG_PREFIX_SEPARATOR,
  loadSharedConfigFiles,
  loadSsoSessionData,
  parseKnownFiles,
  externalDataInterceptor,
  readFile,
} from "@smithy/core/config";
export type {
  SSOToken,
  SharedConfigInit,
  SsoSessionInit,
  SourceProfileInit,
  Profile,
  ParsedIniData,
  SharedConfigFiles,
  ReadFileOptions,
} from "@smithy/core/config";
