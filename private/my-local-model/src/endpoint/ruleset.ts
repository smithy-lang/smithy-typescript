// smithy-typescript generated code
import type { RuleSetObject } from "@smithy/types";

export const ruleSet: RuleSetObject = {
  version: "1.0",
  parameters: {
    endpoint: {
      builtIn: "SDK::Endpoint",
      required: true,
      documentation: "The endpoint used to send the request.",
      type: "string",
    },
    ApiKey: {
      required: false,
      documentation: "ApiKey",
      type: "string",
    },
    region: {
      type: "string",
      required: false,
      documentation: "AWS region",
    },
    customParam: {
      type: "string",
      required: true,
      default: "default-custom-value",
      documentation: "Custom parameter for testing",
    },
    enableFeature: {
      type: "boolean",
      required: true,
      default: true,
      documentation: "Feature toggle with default",
    },
    debugMode: {
      type: "boolean",
      required: true,
      default: false,
      documentation: "Debug mode with default",
    },
    nonConflictingParam: {
      type: "string",
      required: true,
      default: "non-conflict-default",
      documentation: "Non-conflicting with default",
    },
    logger: {
      type: "string",
      required: true,
      default: "default-logger",
      documentation: "Conflicting logger with default",
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
