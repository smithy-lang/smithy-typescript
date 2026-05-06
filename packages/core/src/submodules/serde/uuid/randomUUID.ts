export const randomUUID =
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? (crypto.randomUUID.bind(crypto) as typeof crypto.randomUUID)
    : undefined;
