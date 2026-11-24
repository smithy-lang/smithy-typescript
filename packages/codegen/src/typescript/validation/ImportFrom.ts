/**
 * Interprets the string portion of an import statement.
 */
export class ImportFrom {
  public static readonly NODE_NATIVE_DEPENDENCIES: ReadonlySet<string> = new Set([
    "buffer",
    "child_process",
    "crypto",
    "dns",
    "events",
    "fs",
    "http",
    "http2",
    "https",
    "os",
    "path",
    "process",
    "stream",
    "tls",
    "url",
    "util",
    "zlib",
  ]);

  private readonly _from: string;

  public constructor(importTargetExpression: string) {
    this._from = importTargetExpression;
  }

  public isNodejsNative(): boolean {
    const packageNameSegments = this._from.split("/");
    return this._from.startsWith("node:") || ImportFrom.NODE_NATIVE_DEPENDENCIES.has(packageNameSegments[0]);
  }

  public isNamespaced(): boolean {
    return this._from.startsWith("@") && this._from.includes("/");
  }

  public isRelative(): boolean {
    return this._from.startsWith("/") || this._from.startsWith(".");
  }

  public isDeclarablePackageImport(): boolean {
    return !this.isNodejsNative() && !this.isRelative();
  }

  public getPackageName(): string {
    const packageNameSegments = this._from.split("/");
    if (this.isNodejsNative()) {
      return packageNameSegments[0].slice("node:".length);
    } else if (this.isNamespaced()) {
      return packageNameSegments[0] + "/" + packageNameSegments[1];
    }
    return packageNameSegments[0];
  }
}
