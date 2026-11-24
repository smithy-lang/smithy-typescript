import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, posix } from "node:path";

/**
 * In-memory collection of files to write, keyed by relative path.
 *
 * @internal
 */
export class FileManifest {
  private readonly _files = new Map<string, string>();

  public writeFile(path: string, content: string): void {
    this._files.set(posix.normalize(path.replace(/\\/g, "/")), content);
  }

  public async writeTo(baseDir: string): Promise<void> {
    const dirs = new Set<string>();
    for (const path of this._files.keys()) {
      dirs.add(dirname(join(baseDir, path)));
    }
    await Promise.all(Array.from(dirs, (dir) => mkdir(dir, { recursive: true })));
    await Promise.all(Array.from(this._files, ([path, content]) => writeFile(join(baseDir, path), content, "utf-8")));
  }
}
