/**
 * Describes where a writer was when an error occurred.
 */
export class CodeWriterDebugInfo {
  private readonly metadata = new Map<string, string>();

  public putMetadata(key: string, value: string): void {
    this.metadata.set(key, value);
  }

  public toString(): string {
    const parts: string[] = [];
    for (const [key, value] of this.metadata) {
      parts.push(key + "=" + value);
    }
    return "(Debug Info {" + parts.join(", ") + "})";
  }
}
