const compareEquivalentCborBodies = (expectedBody: string, generatedBody: string | Uint8Array): undefined => {
  expect(
    normalizeByteArrayType(cbor.deserialize(typeof generatedBody === "string" ? toBytes(generatedBody) : generatedBody))
  ).toEqual(normalizeByteArrayType(cbor.deserialize(toBytes(expectedBody))));
  return undefined;
};
