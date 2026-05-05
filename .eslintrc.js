module.exports = {
  parser: "@typescript-eslint/parser", // Specifies the ESLint parser
  parserOptions: {
    ecmaVersion: 2020, // Allows for the parsing of modern ECMAScript features
    sourceType: "module", // Allows for the use of imports
  },
  extends: [
    // Uses the recommended rules from the @typescript-eslint/eslint-plugin
    "plugin:@typescript-eslint/recommended",
  ],
  plugins: ["@typescript-eslint", "n"],
  rules: {
    /** Turn off strict enforcement */
    "@typescript-eslint/ban-types": "off",
    "@typescript-eslint/ban-ts-comment": "off",
    "@typescript-eslint/no-var-requires": "off",
    "@typescript-eslint/no-empty-function": "off",
    "@typescript-eslint/no-empty-interface": "off",
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "prefer-rest-params": "off",
    "@typescript-eslint/no-non-null-assertion": "off",

    // intentional usage
    "@typescript-eslint/no-empty-object-type": "off",
    "@typescript-eslint/no-unsafe-function-type": "off",

    // temporary until upgrading ESLint
    "@typescript-eslint/no-unused-vars": "off",
    "@typescript-eslint/no-require-imports": "off",

    /** Warnings */
    "@typescript-eslint/no-namespace": "warn",

    /** Errors */
    "@typescript-eslint/consistent-type-imports": "error",
    "@typescript-eslint/no-import-type-side-effects": "error",
    "n/prefer-node-protocol": "error",
  },
  overrides: [
    {
      files: ["packages/*/src/**/*.ts"],
      excludedFiles: ["packages/*/src/**/*.spec.ts"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                group: ["*src*", "*dist-*"],
              },
              {
                group: [
                  "@smithy/util-hex-encoding",
                  "@smithy/util-base64",
                  "@smithy/util-body-length-browser",
                  "@smithy/util-body-length-node",
                  "@smithy/util-utf8",
                  "@smithy/util-buffer-from",
                  "@smithy/is-array-buffer",
                  "@smithy/middleware-serde",
                  "@smithy/hash-node",
                  "@smithy/hash-blob-browser",
                  "@smithy/hash-stream-node",
                  "@smithy/md5-js",
                  "@smithy/chunked-blob-reader",
                  "@smithy/chunked-blob-reader-native",
                  "@smithy/util-stream",
                  "@smithy/uuid",
                ],
                message: "This package has been consolidated into @smithy/core/serde.",
              },
              {
                group: [
                  "@smithy/smithy-client",
                  "@smithy/middleware-stack",
                  "@smithy/util-middleware",
                  "@smithy/invalid-dependency",
                  "@smithy/util-waiter",
                ],
                message: "This package has been consolidated into @smithy/core/client.",
              },
              {
                group: [
                  "@smithy/config-resolver",
                  "@smithy/util-config-provider",
                  "@smithy/node-config-provider",
                  "@smithy/shared-ini-file-loader",
                  "@smithy/property-provider",
                  "@smithy/util-defaults-mode-browser",
                  "@smithy/util-defaults-mode-node",
                ],
                message: "This package has been consolidated into @smithy/core/config.",
              },
              {
                group: [
                  "@smithy/protocol-http",
                  "@smithy/middleware-content-length",
                  "@smithy/util-uri-escape",
                  "@smithy/querystring-builder",
                  "@smithy/querystring-parser",
                  "@smithy/url-parser",
                ],
                message: "This package has been consolidated into @smithy/core/protocols.",
              },
              {
                group: ["@smithy/util-retry", "@smithy/middleware-retry", "@smithy/service-error-classification"],
                message: "This package has been consolidated into @smithy/core/retry.",
              },
              {
                group: ["@smithy/util-endpoints", "@smithy/middleware-endpoint"],
                message: "This package has been consolidated into @smithy/core/endpoints.",
              },
              {
                group: [
                  "@smithy/hash-blob-browser",
                  "@smithy/hash-stream-node",
                  "@smithy/md5-js",
                  "@smithy/chunked-blob-reader",
                  "@smithy/chunked-blob-reader-native",
                ],
                message: "This package has been consolidated into @smithy/core/checksum.",
              },
              {
                group: [
                  "@smithy/eventstream-codec",
                  "@smithy/eventstream-serde-universal",
                  "@smithy/eventstream-serde-browser",
                  "@smithy/eventstream-serde-node",
                  "@smithy/eventstream-serde-config-resolver",
                ],
                message: "This package has been consolidated into @smithy/core/event-streams.",
              },
            ],
          },
        ],
      },
    },
  ],
};
