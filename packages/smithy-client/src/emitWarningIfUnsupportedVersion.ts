// Stores whether the warning was already emitted.
let warningEmitted = false;

/**
 * @internal
 *
 * Emits warning if the provided Node.js version string is pending deprecation.
 *
 * @param version - The Node.js version string.
 */
export const emitWarningIfUnsupportedVersion = (version: string) => {
  if (version && !warningEmitted && parseInt(version.substring(1, version.indexOf("."))) < 16) {
    warningEmitted = true;
    // ToDo: Turn back warning for future Node.js version deprecation
    // process.emitWarning(
    //   `The AWS SDK for JavaScript (v3) will\n` +
    //     `no longer support Node.js ${version} on <<DATE>>.\n\n` +
    //     `To continue receiving updates to AWS services, bug fixes, and security\n` +
    //     `updates please upgrade to Node.js <<VERSION.x>> or later.\n\n` +
    //     `For details, please refer our blog post: <<LINK>>`,
    //   `NodeDeprecationWarning`
    // );
  }
};
