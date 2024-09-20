// Set up binary for Chromium browser in CHROME_BIN environment variable before running the test

module.exports = function (config) {
  config.set({
    frameworks: ["jasmine", "karma-typescript"],
    files: [
      "src/checksum/createChecksumStream.browser.spec.ts",
      "src/checksum/createChecksumStream.browser.ts",
      "src/getAwsChunkedEncodingStream.browser.spec.ts",
      "src/getAwsChunkedEncodingStream.browser.ts",
      "src/headStream.browser.ts",
      "src/stream-type-check.ts",
    ],
    exclude: ["**/*.d.ts"],
    preprocessors: {
      "**/*.ts": "karma-typescript",
    },
    reporters: ["progress", "karma-typescript"],
    browsers: ["ChromeHeadlessNoSandbox"],
    customLaunchers: {
      ChromeHeadlessNoSandbox: {
        base: "ChromeHeadless",
        flags: ["--no-sandbox"],
      },
    },
    karmaTypescriptConfig: {
      bundlerOptions: {
        addNodeGlobals: true,
      },
    },
    singleRun: true,
  });
};
