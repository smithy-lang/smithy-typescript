export const toUtf8 = (input: Uint8Array | string): string => {
  if (typeof input === "string") {
    return input;
  }
  return new TextDecoder("utf-8").decode(input);
};
