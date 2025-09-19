// ToDo: Merge Node.js and browser implementations after dropping support for Node.js 22.x
import crypto from "crypto";

export const randomUUID = crypto.randomUUID.bind(crypto);
