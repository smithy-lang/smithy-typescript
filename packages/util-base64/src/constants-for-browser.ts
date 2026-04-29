const chars = `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/`;

export const alphabetByEncoding: Record<string, number> = Object.entries(chars).reduce(
  (acc, [i, c]) => {
    acc[c] = Number(i);
    return acc;
  },
  {} as Record<string, number>
);
export const alphabetByValue: Array<string> = chars.split("");

export const bitsPerLetter = 6;
export const bitsPerByte = 8;
export const maxLetterValue = 0b111111;
