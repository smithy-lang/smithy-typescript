import { AwsCredentialIdentity } from "@smithy/types";

import { fromImdsCredentials, ImdsCredentials, isImdsCredentials } from "./ImdsCredentials";

const creds: ImdsCredentials = Object.freeze({
  AccessKeyId: "foo",
  SecretAccessKey: "bar",
  Token: "baz",
  Expiration: new Date().toISOString(),
  AccountId: "123456789012",
});

describe("isImdsCredentials", () => {
  it("should accept valid ImdsCredentials objects", () => {
    expect(isImdsCredentials(creds)).toBe(true);
  });

  it("should reject credentials without an AccessKeyId", () => {
    expect(isImdsCredentials({ ...creds, AccessKeyId: void 0 })).toBe(false);
  });

  it("should reject credentials without a SecretAccessKey", () => {
    expect(isImdsCredentials({ ...creds, SecretAccessKey: void 0 })).toBe(false);
  });

  it("should reject credentials without a Token", () => {
    expect(isImdsCredentials({ ...creds, Token: void 0 })).toBe(false);
  });

  it("should reject credentials without an Expiration", () => {
    expect(isImdsCredentials({ ...creds, Expiration: void 0 })).toBe(false);
  });

  it("should reject scalar values", () => {
    for (const scalar of ["string", 1, true, null, void 0]) {
      expect(isImdsCredentials(scalar)).toBe(false);
    }
  });
});

describe("fromImdsCredentials", () => {
  it("should convert IMDS credentials to a credentials object", () => {
    const converted: AwsCredentialIdentity = fromImdsCredentials(creds);
    expect(converted.accessKeyId).toEqual(creds.AccessKeyId);
    expect(converted.secretAccessKey).toEqual(creds.SecretAccessKey);
    expect(converted.sessionToken).toEqual(creds.Token);
    expect(converted.expiration).toEqual(new Date(creds.Expiration));
    expect(converted.accountId).toEqual(creds.AccountId);
  });

  it("should convert IMDS credentials to a credentials object without accountId when it's not provided", () => {
    const credsWithoutAccountId: ImdsCredentials = {
      AccessKeyId: "foo",
      SecretAccessKey: "bar",
      Token: "baz",
      Expiration: new Date().toISOString(),
      // AccountId is omitted
    };
    const converted: AwsCredentialIdentity = fromImdsCredentials(credsWithoutAccountId);
    expect(converted.accessKeyId).toEqual(credsWithoutAccountId.AccessKeyId);
    expect(converted.secretAccessKey).toEqual(credsWithoutAccountId.SecretAccessKey);
    expect(converted.sessionToken).toEqual(credsWithoutAccountId.Token);
    expect(converted.expiration).toEqual(new Date(credsWithoutAccountId.Expiration));
    expect(converted).not.toHaveProperty('accountId'); // Verify accountId is not included
  });
});