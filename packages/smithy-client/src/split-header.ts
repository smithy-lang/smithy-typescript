/**
 * @param value - header string value.
 * @returns value split by commas that aren't in quotes.
 */
export const splitHeader = (value: string): string[] => {
  const z = value.length;
  const values = [];

  let withinQuotes = false;
  let prevChar = undefined;
  let anchor = 0;

  for (let i = 0; i < z; ++i) {
    const char = value[i];
    switch (char) {
      case `"`:
        if (prevChar !== "\\") {
          withinQuotes = !withinQuotes;
        }
        break;
      case ",":
        if (!withinQuotes) {
          values.push(value.slice(anchor, i));
          anchor = i + 1;
        }
        break;
      default:
    }
    prevChar = char;
  }

  values.push(value.slice(anchor));

  return values.map((v) => {
    v = v.trim();
    const z = v.length;
    if (v[0] === `"` && v[z - 1] === `"`) {
      v = v.slice(1, z - 1);
    }
    return v.replace(/\\"/g, '"');
  });
};