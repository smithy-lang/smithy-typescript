import { Sha256 } from "@aws-crypto/sha256-js";
import { AwsCredentialIdentity, HttpRequest } from "@smithy/types";
import { describe, expect, it } from "vitest";

import { SignatureV4a } from "./SignatureV4a";

describe("SignatureV4a", () => {
  it("SignatureV4a credential check", async () => {
    const creds: AwsCredentialIdentity = {
      accessKeyId: "test-access-key",
      secretAccessKey: "test-secret-access-key",
      sessionToken: "test-secret",
    };

    const sigV4aSigner = new SignatureV4a({
      credentials: creds,
      sha256: Sha256,
      region: "*",
      service: "test-service",
      applyChecksum: false,
    });

    const request: HttpRequest = {
      headers: {},
      hostname: "test",
      method: "GET",
      path: "/v1.1/test",
      protocol: "HTTPS",
    };

    const signingDate = new Date();
    signingDate.setTime(1711493155780);
    const result = await sigV4aSigner.sign(request, {
      signingDate: signingDate,
    });

    expect(result.headers["x-amz-date"]).toEqual("20240326T224555Z");
    expect(result.headers["x-amz-security-token"]).toEqual(creds.sessionToken);
    expect(result.headers["x-amz-region-set"]).toEqual("*");
    expect(result.headers["authorization"]).toEqual(
      "AWS4-ECDSA-P256-SHA256 Credential=test-access-key/20240326/test-service/aws4_request, SignedHeaders=x-amz-date;x-amz-region-set;x-amz-security-token, Signature=30440220145f66a150392193d4c50ec322ac2ab930989bbd56566a43132962f8f5bed2280220346d08e335f58e7d515c45618841869650d11f0dff107733f74228a891828919"
    );
  });
});
