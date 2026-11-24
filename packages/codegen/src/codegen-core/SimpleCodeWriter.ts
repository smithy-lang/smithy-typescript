import { AbstractCodeWriter } from "./AbstractCodeWriter";

/**
 * Basic writer that trims trailing spaces.
 *
 * @internal
 */
export class SimpleCodeWriter extends AbstractCodeWriter<SimpleCodeWriter> {
  public constructor() {
    super();
    this.trimTrailingSpaces();
  }
}
