/**
 * @public
 */
export type IniSection = Record<string, string | undefined>;

/**
 * @public
 */
export type ParsedIniData = Record<string, IniSection>;

/**
 * @public
 */
export interface SharedConfigFiles {
  credentialsFile: ParsedIniData;
  configFile: ParsedIniData;
}
