import { CodegenUtils } from "./CodegenUtils";

/**
 * A possible language target that can be generated.
 *
 * @internal
 */
export class LanguageTarget {
  public static readonly NODE = new LanguageTarget("NODE", "runtimeConfig.ts.template");
  public static readonly BROWSER = new LanguageTarget("BROWSER", "runtimeConfig.browser.ts.template");
  public static readonly REACT_NATIVE = new LanguageTarget("REACT_NATIVE", "runtimeConfig.native.ts.template");
  public static readonly SHARED = new LanguageTarget("SHARED", "runtimeConfig.shared.ts.template");

  private readonly _name: string;
  private readonly _templateFileName: string;

  private constructor(name: string, templateFileName: string) {
    this._name = name;
    this._templateFileName = templateFileName;
  }

  public static values(): LanguageTarget[] {
    return [LanguageTarget.NODE, LanguageTarget.BROWSER, LanguageTarget.REACT_NATIVE, LanguageTarget.SHARED];
  }

  public name(): string {
    return this._name;
  }

  public getTemplateFileName(): string {
    return this._templateFileName;
  }

  public getTargetFilename(): string {
    return CodegenUtils.SOURCE_FOLDER + "/" + this._templateFileName.replace(".template", "");
  }

  public toString(): string {
    return this._name;
  }
}
