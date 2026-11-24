/**
 * A named region of generated code that interceptors can modify.
 *
 * @internal
 */
export interface CodeSection {
  sectionName(): string;
}

/**
 * Constructor of a CodeSection implementation, used to match interceptors by section type.
 */
export type CodeSectionType<S extends CodeSection = CodeSection> = abstract new (...args: any[]) => S;

/**
 * @internal
 */
export const CodeSection = {
  forName(sectionName: string): CodeSection {
    return {
      sectionName: () => sectionName,
    };
  },
};
