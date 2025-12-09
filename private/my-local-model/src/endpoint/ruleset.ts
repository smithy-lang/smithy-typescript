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
    ApiKey: {
      required: false,
      documentation: "ApiKey",
      type: "String",
    },
    region: {
      type: "String",
      required: false,
      documentation: "AWS region",
    },
    customParam: {
      type: "String",
      required: true,
      default: "default-custom-value",
      documentation: "Custom parameter for testing",
    },
    enableFeature: {
      type: "Boolean",
      required: true,
      default: true,
      documentation: "Feature toggle with default",
    },
    debugMode: {
      type: "Boolean",
      required: true,
      default: false,
      documentation: "Debug mode with default",
    },
    nonConflictingParam: {
      type: "String",
      required: true,
      default: "non-conflict-default",
      documentation: "Non-conflicting with default",
    },
  },
  rules: [
    {
      conditions: [
        {
          fn: "isSet",
          argv: [
            {
              ref: "ApiKey",
            },
          ],
        },
      ],
      endpoint: {
        url: "{endpoint}",
        properties: {},
        headers: {
          "x-api-key": [
            "{ApiKey}",
          ],
        },
      },
      type: "endpoint",
    },
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
