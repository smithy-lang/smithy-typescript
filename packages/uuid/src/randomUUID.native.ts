// If user has provided their polyfill, like "react-native-random-uuid"
export const randomUUID = typeof crypto !== "undefined" && crypto.randomUUID && crypto.randomUUID.bind(crypto);
