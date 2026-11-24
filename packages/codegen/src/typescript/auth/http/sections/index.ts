import type { CodeSection } from "../../../../codegen-core";

type Props = Record<string, unknown>;

export interface PropsCodeSection extends CodeSection {
  readonly props: Props;
  [getter: string]: unknown;
}

const capitalize = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

/**
 * Defines a code section class with a builder and `getXxx` accessors for each property.
 */
const defineSection = (className: string, keys: readonly string[]) => {
  const sectionName = `software.amazon.smithy.typescript.codegen.auth.http.sections.${className}`;

  class Section implements CodeSection {
    public static readonly SECTION_NAME = sectionName;
    public readonly props: Props;

    public constructor(props: Props) {
      for (const key of keys) {
        if (props[key] === undefined) {
          throw new Error(`${key} is required`);
        }
      }
      this.props = props;
    }

    public static builder(): SectionBuilder {
      return new SectionBuilder();
    }

    public sectionName(): string {
      return sectionName;
    }
  }
  for (const key of keys) {
    Object.defineProperty(Section.prototype, "get" + capitalize(key), {
      value(this: Section) {
        return this.props[key];
      },
    });
  }

  class SectionBuilder {
    private readonly _props: Props = {};

    public build(): Section {
      return new Section(this._props);
    }
  }
  for (const key of keys) {
    Object.defineProperty(SectionBuilder.prototype, key, {
      value(this: { _props: Props }, value: unknown) {
        this._props[key] = value;
        return this;
      },
    });
  }
  return Section as unknown as {
    SECTION_NAME: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    builder(): any;
    new (props: Props): PropsCodeSection;
  };
};

const COMMON = ["service", "settings", "model", "symbolProvider"] as const;

export const HttpAuthSchemeParametersInterfaceCodeSection = defineSection(
  "HttpAuthSchemeParametersInterfaceCodeSection",
  [...COMMON, "httpAuthSchemeParameters"]
);
export const HttpAuthSchemeParametersProviderInterfaceCodeSection = defineSection(
  "HttpAuthSchemeParametersProviderInterfaceCodeSection",
  COMMON
);
export const DefaultHttpAuthSchemeParametersProviderFunctionCodeSection = defineSection(
  "DefaultHttpAuthSchemeParametersProviderFunctionCodeSection",
  [...COMMON, "httpAuthSchemeParameters"]
);
export const HttpAuthOptionFunctionsCodeSection = defineSection("HttpAuthOptionFunctionsCodeSection", [
  ...COMMON,
  "effectiveHttpAuthSchemes",
]);
export const HttpAuthOptionFunctionCodeSection = defineSection("HttpAuthOptionFunctionCodeSection", [
  ...COMMON,
  "effectiveHttpAuthSchemes",
  "schemeId",
  "httpAuthScheme",
]);
export const HttpAuthSchemeProviderInterfaceCodeSection = defineSection(
  "HttpAuthSchemeProviderInterfaceCodeSection",
  COMMON
);
export const DefaultHttpAuthSchemeProviderFunctionCodeSection = defineSection(
  "DefaultHttpAuthSchemeProviderFunctionCodeSection",
  COMMON
);
const CONFIG = [...COMMON, "integrations", "configFields", "resolveConfigFunctions"] as const;
export const HttpAuthSchemeInputConfigInterfaceCodeSection = defineSection(
  "HttpAuthSchemeInputConfigInterfaceCodeSection",
  CONFIG
);
export const HttpAuthSchemeResolvedConfigInterfaceCodeSection = defineSection(
  "HttpAuthSchemeResolvedConfigInterfaceCodeSection",
  CONFIG
);
export const ResolveHttpAuthSchemeConfigFunctionCodeSection = defineSection(
  "ResolveHttpAuthSchemeConfigFunctionCodeSection",
  CONFIG
);
export const ResolveHttpAuthSchemeConfigFunctionConfigFieldsCodeSection = defineSection(
  "ResolveHttpAuthSchemeConfigFunctionConfigFieldsCodeSection",
  [...COMMON, "integrations", "configFields"]
);
export const ResolveHttpAuthSchemeConfigFunctionReturnBlockCodeSection = defineSection(
  "ResolveHttpAuthSchemeConfigFunctionReturnBlockCodeSection",
  [...COMMON, "integrations", "configFields"]
);
