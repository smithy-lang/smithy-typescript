// smithy-typescript generated code
import type { RuleSetObject } from "@smithy/types";

export const ruleSet: RuleSetObject = {
  version: "1.0",
  parameters: {
    endpoint: {
      builtIn: "SDK::Endpoint",
      required: true,
      documentation: "The endpoint used to send the request.",
      type: "String",
    },
    apiKey: {
      type: "String",
      required: true,
      default: "default-api-key",
      documentation: "API key for service authentication",
    },
    customParam: {
      type: "String",
      required: true,
      default: "default-custom-value",
      documentation: "Custom parameter for testing",
    },
  },
  rules: [
    {
      conditions: [],
      endpoint: {
        url: "{endpoint}",
        properties: {},
        headers: {},
      },
      type: "endpoint",
    },
  ],
};
