import {AwsCredentialIdentity, HttpRequest} from "@smithy/types";
import {Sha256} from "@aws-crypto/sha256-js";
import {SignatureV4a} from "./SignatureV4a";

describe('SignatureV4a', () => {
  it('SignatureV4a credential check', async () => {
    const creds: AwsCredentialIdentity = {
      accessKeyId: 'test-access-key',
      secretAccessKey: 'test-secret-access-key',
      sessionToken: 'test-secret'
    }

    const sigV4aSigner = new SignatureV4a({
      credentials: creds,
      sha256: Sha256,
      region: "*",
      service: "test-service",
      applyChecksum: false
    })

    const request: HttpRequest = {
      headers: {
      },
      hostname: "test",
      method: "GET",
      path: "/v1.1/test",
      protocol: "HTTPS"
    }

    const signingDate = new Date();
    signingDate.setTime(1711493155780)
    const result = await sigV4aSigner.sign(request, {
      signingDate: signingDate
    });

    expect(result.headers['x-amz-date']).toEqual('20240326T224555Z');
    expect(result.headers['x-amz-security-token']).toEqual(creds.sessionToken);
    expect(result.headers['x-amz-region-set']).toEqual('*');
    expect(result.headers['authorization']).toEqual('AWS4-ECDSA-P256-SHA256 Credential=test-access-key/20240326/test-service/aws4_request, SignedHeaders=x-amz-date;x-amz-region-set;x-amz-security-token, Signature=3045022100e05f26f5ca09db87269cc0abf4eb81b9e3db6f09090aa5f66da481d4fc4f98ea0220712d5752a049aa86ab727e265a33454ea8327d9291989d4ca0e6dc53d1569d69')
  });
});
