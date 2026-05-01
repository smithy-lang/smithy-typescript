import { afterEach, describe, expect, test as it, vi } from "vitest";

import { booleanSelector } from "../../util-config-provider/booleanSelector";
import { SelectorType } from "../../util-config-provider/types";
import {
  CONFIG_USE_DUALSTACK_ENDPOINT,
  DEFAULT_USE_DUALSTACK_ENDPOINT,
  ENV_USE_DUALSTACK_ENDPOINT,
  NODE_USE_DUALSTACK_ENDPOINT_CONFIG_OPTIONS,
  nodeDualstackConfigSelectors,
} from "./NodeUseDualstackEndpointConfigOptions";

vi.mock("../../util-config-provider/booleanSelector");

describe("NODE_USE_DUALSTACK_ENDPOINT_CONFIG_OPTIONS", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  const test = (func: Function, obj: Record<string, string>, key: string, type: SelectorType) => {
    it.each([true, false, undefined])("returns %s", (output) => {
      vi.mocked(booleanSelector).mockReturnValueOnce(output);
      expect(func(obj)).toEqual(output);
      expect(booleanSelector).toBeCalledWith(obj, key, type);
    });

    it("throws error", () => {
      const mockError = new Error("error");
      vi.mocked(booleanSelector).mockImplementationOnce(() => {
        throw mockError;
      });
      expect(() => {
        func(obj);
      }).toThrow(mockError);
    });
  };

  describe("calls booleanSelector for environmentVariableSelector", () => {
    const env: { [ENV_USE_DUALSTACK_ENDPOINT]: any } = {} as any;
    const { environmentVariableSelector } = NODE_USE_DUALSTACK_ENDPOINT_CONFIG_OPTIONS;
    test(environmentVariableSelector, env, ENV_USE_DUALSTACK_ENDPOINT, SelectorType.ENV);
  });

  describe("calls booleanSelector for configFileSelector", () => {
    const profileContent: { [CONFIG_USE_DUALSTACK_ENDPOINT]: any } = {} as any;
    const { configFileSelector } = NODE_USE_DUALSTACK_ENDPOINT_CONFIG_OPTIONS;
    test(configFileSelector, profileContent, CONFIG_USE_DUALSTACK_ENDPOINT, SelectorType.CONFIG);
  });

  it("returns undefined for default", () => {
    const { default: defaultValue } = NODE_USE_DUALSTACK_ENDPOINT_CONFIG_OPTIONS;
    expect(defaultValue).toEqual(DEFAULT_USE_DUALSTACK_ENDPOINT);
  });

  it("returns undefined for default when using nodeFipsConfigSelectors", () => {
    const { default: defaultValue } = nodeDualstackConfigSelectors;
    expect(defaultValue).toBeUndefined();
  });
});
