function isSerializableHeaderValue(value: any): boolean {
  return value !== undefined
      && value !== ""
      && (!Object.getOwnPropertyNames(value).includes("length") || value.length != 0)
      && (!Object.getOwnPropertyNames(value).includes("size") || value.size != 0);
}
