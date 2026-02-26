export const serializeDate = (d: Date) =>
  d.toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "long",
    hour12: false,
  });
