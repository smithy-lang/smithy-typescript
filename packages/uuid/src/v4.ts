import { randomUUID } from "./randomUUID";

export const v4 = () => {
  if (randomUUID) {
    return randomUUID();
  }

  const rnds = new Uint8Array(16);
  crypto.getRandomValues(rnds);

  // Set version (4) and variant (RFC4122)
  rnds[6] = (rnds[6] & 0x0f) | 0x40; // version 4
  rnds[8] = (rnds[8] & 0x3f) | 0x80; // variant

  return Array.from(rnds.slice(0, 16))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, "$1-$2-$3-$4-$5");
};
