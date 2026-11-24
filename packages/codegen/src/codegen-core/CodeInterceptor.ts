import type { AbstractCodeWriter } from "./AbstractCodeWriter";
import type { CodeSection, CodeSectionType } from "./CodeSection";

/**
 * Intercepts the text of a section as it is popped from a writer.
 *
 * @internal
 */
export interface CodeInterceptor<S extends CodeSection, W extends AbstractCodeWriter<W>> {
  /**
   * Returns the section class this interceptor matches, or null to match any section.
   */
  sectionType(): CodeSectionType<S> | null;

  isIntercepted?(section: S): boolean;

  write(writer: W, previousText: string, section: S): void;
}

abstract class CodeInterceptorAppender<
  S extends CodeSection,
  W extends AbstractCodeWriter<W>,
> implements CodeInterceptor<S, W> {
  public abstract sectionType(): CodeSectionType<S> | null;

  public abstract append(writer: W, section: S): void;

  public write(writer: W, previousText: string, section: S): void {
    if (previousText.length > 0) {
      writer.writeInlineWithNoFormatting(previousText);
    }
    this.append(writer, section);
  }
}

/**
 * @internal
 */
export const CodeInterceptor = {
  appender<S extends CodeSection, W extends AbstractCodeWriter<W>>(
    type: CodeSectionType<S>,
    appender: (writer: W, section: S) => void
  ): CodeInterceptor<S, W> {
    return new (class extends CodeInterceptorAppender<S, W> {
      public sectionType(): CodeSectionType<S> {
        return type;
      }
      public append(writer: W, section: S): void {
        appender(writer, section);
      }
    })();
  },

  forName<W extends AbstractCodeWriter<W>>(
    sectionName: string,
    consumer: (writer: W, previousText: string) => void
  ): CodeInterceptor<CodeSection, W> {
    return {
      sectionType: () => null,
      isIntercepted: (section: CodeSection) => section.sectionName() === sectionName,
      write: (writer: W, previousText: string) => consumer(writer, previousText),
    };
  },
};
