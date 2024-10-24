import { CredentialsProviderError } from "@smithy/property-provider";
import { afterEach, beforeEach, describe, expect, test as it, vi } from "vitest";

import { InstanceMetadataV1FallbackError } from "./error/InstanceMetadataV1FallbackError";
import { fromInstanceMetadata } from "./fromInstanceMetadata";
import { httpRequest } from "./remoteProvider/httpRequest";
import { fromImdsCredentials, isImdsCredentials } from "./remoteProvider/ImdsCredentials";
import { providerConfigFromInit } from "./remoteProvider/RemoteProviderInit";
import { retry } from "./remoteProvider/retry";
import { getInstanceMetadataEndpoint } from "./utils/getInstanceMetadataEndpoint";
import { staticStabilityProvider } from "./utils/staticStabilityProvider";

vi.mock("./remoteProvider/httpRequest");
vi.mock("./remoteProvider/ImdsCredentials");
vi.mock("./remoteProvider/retry");
vi.mock("./remoteProvider/RemoteProviderInit");
vi.mock("./utils/getInstanceMetadataEndpoint");
vi.mock("./utils/staticStabilityProvider");

describe("fromInstanceMetadata", () => {
  const hostname = "127.0.0.1";
  const mockTimeout = 1000;
  const mockMaxRetries = 3;
  const mockToken = "fooToken";
  const mockProfile = "fooProfile";

  const mockTokenRequestOptions = {
    hostname,
    path: "/latest/api/token",
    method: "PUT",
    headers: {
      "x-aws-ec2-metadata-token-ttl-seconds": "21600",
    },
    timeout: mockTimeout,
  };

  const mockProfileRequestOptions = {
    hostname,
    path: "/latest/meta-data/iam/security-credentials/",
    timeout: mockTimeout,
    headers: {
      "x-aws-ec2-metadata-token": mockToken,
    },
  };

  const ONE_HOUR_IN_FUTURE = new Date(Date.now() + 60 * 60 * 1000);
  const mockImdsCreds = Object.freeze({
    AccessKeyId: "foo",
    SecretAccessKey: "bar",
    Token: "baz",
    Expiration: ONE_HOUR_IN_FUTURE.toISOString(),
  });

  const mockCreds = Object.freeze({
    accessKeyId: mockImdsCreds.AccessKeyId,
    secretAccessKey: mockImdsCreds.SecretAccessKey,
    sessionToken: mockImdsCreds.Token,
    expiration: new Date(mockImdsCreds.Expiration),
  });

  beforeEach(() => {
    vi.mocked(staticStabilityProvider).mockImplementation((input) => input);
    vi.mocked(getInstanceMetadataEndpoint).mockResolvedValue({ hostname });
    (isImdsCredentials as unknown as any).mockReturnValue(true);
    vi.mocked(providerConfigFromInit).mockReturnValue({
      timeout: mockTimeout,
      maxRetries: mockMaxRetries,
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("gets token and profile name to fetch credentials", async () => {
    vi.mocked(httpRequest)
      .mockResolvedValueOnce(mockToken)
      .mockResolvedValueOnce(mockProfile)
      .mockResolvedValueOnce(JSON.stringify(mockImdsCreds));

    vi.mocked(retry).mockImplementation((fn: any) => fn());
    vi.mocked(fromImdsCredentials).mockReturnValue(mockCreds);

    await expect(fromInstanceMetadata()()).resolves.toEqual(mockCreds);
    expect(httpRequest).toHaveBeenCalledTimes(3);
    expect(httpRequest).toHaveBeenNthCalledWith(1, mockTokenRequestOptions);
    expect(httpRequest).toHaveBeenNthCalledWith(2, mockProfileRequestOptions);
    expect(httpRequest).toHaveBeenNthCalledWith(3, {
      ...mockProfileRequestOptions,
      path: `${mockProfileRequestOptions.path}${mockProfile}`,
    });
  });

  it("trims profile returned name from IMDS", async () => {
    vi.mocked(httpRequest)
      .mockResolvedValueOnce(mockToken)
      .mockResolvedValueOnce("   " + mockProfile + "  ")
      .mockResolvedValueOnce(JSON.stringify(mockImdsCreds));

    vi.mocked(retry).mockImplementation((fn: any) => fn());
    vi.mocked(fromImdsCredentials).mockReturnValue(mockCreds);

    await expect(fromInstanceMetadata()()).resolves.toEqual(mockCreds);
    expect(httpRequest).toHaveBeenNthCalledWith(3, {
      ...mockProfileRequestOptions,
      path: `${mockProfileRequestOptions.path}${mockProfile}`,
    });
  });

  it("passes {} to providerConfigFromInit if init not defined", async () => {
    vi.mocked(retry).mockResolvedValueOnce(mockProfile).mockResolvedValueOnce(mockCreds);

    await expect(fromInstanceMetadata()()).resolves.toEqual(mockCreds);
    expect(providerConfigFromInit).toHaveBeenCalledTimes(1);
    expect(providerConfigFromInit).toHaveBeenCalledWith({});
  });

  it("passes init to providerConfigFromInit", async () => {
    vi.mocked(retry).mockResolvedValueOnce(mockProfile).mockResolvedValueOnce(mockCreds);

    const init = { maxRetries: 5, timeout: 1213 };
    await expect(fromInstanceMetadata(init)()).resolves.toEqual(mockCreds);
    expect(providerConfigFromInit).toHaveBeenCalledTimes(1);
    expect(providerConfigFromInit).toHaveBeenCalledWith(init);
  });

  it("passes maxRetries returned from providerConfigFromInit to retry", async () => {
    vi.mocked(retry).mockResolvedValueOnce(mockProfile).mockResolvedValueOnce(mockCreds);

    await expect(fromInstanceMetadata()()).resolves.toEqual(mockCreds);
    expect(retry).toHaveBeenCalledTimes(2);
    expect(vi.mocked(retry).mock.calls[0][1]).toBe(mockMaxRetries);
    expect(vi.mocked(retry).mock.calls[1][1]).toBe(mockMaxRetries);
  });

  it("throws CredentialsProviderError if credentials returned are incorrect", async () => {
    vi.mocked(httpRequest)
      .mockResolvedValueOnce(mockToken)
      .mockResolvedValueOnce(mockProfile)
      .mockResolvedValueOnce(JSON.stringify(mockImdsCreds));

    vi.mocked(retry).mockImplementation((fn: any) => fn());
    (isImdsCredentials as unknown as any).mockReturnValueOnce(false);

    await expect(fromInstanceMetadata()()).rejects.toEqual(
      new CredentialsProviderError("Invalid response received from instance metadata service.")
    );
    expect(retry).toHaveBeenCalledTimes(2);
    expect(httpRequest).toHaveBeenCalledTimes(3);
    expect(isImdsCredentials).toHaveBeenCalledTimes(1);
    expect(isImdsCredentials).toHaveBeenCalledWith(mockImdsCreds);
    expect(fromImdsCredentials).not.toHaveBeenCalled();
  });

  it("throws Error if httpRequest for profile fails", async () => {
    const mockError = new Error("profile not found");
    vi.mocked(httpRequest).mockResolvedValueOnce(mockToken).mockRejectedValueOnce(mockError);
    vi.mocked(retry).mockImplementation((fn: any) => fn());

    await expect(fromInstanceMetadata()()).rejects.toEqual(mockError);
    expect(retry).toHaveBeenCalledTimes(1);
    expect(httpRequest).toHaveBeenCalledTimes(2);
  });

  it("throws Error if httpRequest for credentials fails", async () => {
    const mockError = new Error("creds not found");
    vi.mocked(httpRequest)
      .mockResolvedValueOnce(mockToken)
      .mockResolvedValueOnce(mockProfile)
      .mockRejectedValueOnce(mockError);
    vi.mocked(retry).mockImplementation((fn: any) => fn());

    await expect(fromInstanceMetadata()()).rejects.toEqual(mockError);
    expect(retry).toHaveBeenCalledTimes(2);
    expect(httpRequest).toHaveBeenCalledTimes(3);
    expect(fromImdsCredentials).not.toHaveBeenCalled();
  });

  it("throws SyntaxError if httpRequest returns unparseable creds", async () => {
    vi.mocked(httpRequest)
      .mockResolvedValueOnce(mockToken)
      .mockResolvedValueOnce(mockProfile)
      .mockResolvedValueOnce(".");
    vi.mocked(retry).mockImplementation((fn: any) => fn());

    await expect(fromInstanceMetadata()()).rejects.toThrow("Unexpected token");
    expect(retry).toHaveBeenCalledTimes(2);
    expect(httpRequest).toHaveBeenCalledTimes(3);
    expect(fromImdsCredentials).not.toHaveBeenCalled();
  });

  it("throws error if metadata token errors with statusCode 400", async () => {
    const tokenError = Object.assign(new Error("token not found"), {
      statusCode: 400,
    });
    vi.mocked(httpRequest).mockRejectedValueOnce(tokenError);

    await expect(fromInstanceMetadata()()).rejects.toEqual(tokenError);
  });

  it("should call staticStabilityProvider with the credential loader", async () => {
    vi.mocked(httpRequest)
      .mockResolvedValueOnce(mockToken)
      .mockResolvedValueOnce(mockProfile)
      .mockResolvedValueOnce(JSON.stringify(mockImdsCreds));

    vi.mocked(retry).mockImplementation((fn: any) => fn());
    vi.mocked(fromImdsCredentials).mockReturnValue(mockCreds);

    await fromInstanceMetadata()();
    expect(vi.mocked(staticStabilityProvider)).toBeCalledTimes(1);
  });

  describe("disables fetching of token", () => {
    beforeEach(() => {
      vi.mocked(retry).mockImplementation((fn: any) => fn());
      vi.mocked(fromImdsCredentials).mockReturnValue(mockCreds);
    });

    it("when token fetch returns with TimeoutError", async () => {
      const tokenError = new Error("TimeoutError");

      vi.mocked(httpRequest)
        .mockRejectedValueOnce(tokenError)
        .mockResolvedValueOnce(mockProfile)
        .mockResolvedValueOnce(JSON.stringify(mockImdsCreds))
        .mockResolvedValueOnce(mockProfile)
        .mockResolvedValueOnce(JSON.stringify(mockImdsCreds));

      const fromInstanceMetadataFunc = fromInstanceMetadata();
      await expect(fromInstanceMetadataFunc()).resolves.toEqual(mockCreds);
      await expect(fromInstanceMetadataFunc()).resolves.toEqual(mockCreds);
    });

    [403, 404, 405].forEach((statusCode) => {
      it(`when token fetch errors with statusCode ${statusCode}`, async () => {
        const tokenError = Object.assign(new Error(), { statusCode });

        vi.mocked(httpRequest)
          .mockRejectedValueOnce(tokenError)
          .mockResolvedValueOnce(mockProfile)
          .mockResolvedValueOnce(JSON.stringify(mockImdsCreds))
          .mockResolvedValueOnce(mockProfile)
          .mockResolvedValueOnce(JSON.stringify(mockImdsCreds));

        const fromInstanceMetadataFunc = fromInstanceMetadata();
        await expect(fromInstanceMetadataFunc()).resolves.toEqual(mockCreds);
        await expect(fromInstanceMetadataFunc()).resolves.toEqual(mockCreds);
      });
    });
  });

  it("uses insecure data flow once, if error is not TimeoutError", async () => {
    const tokenError = new Error("Error");

    vi.mocked(httpRequest)
      .mockRejectedValueOnce(tokenError)
      .mockResolvedValueOnce(mockProfile)
      .mockResolvedValueOnce(JSON.stringify(mockImdsCreds))
      .mockResolvedValueOnce(mockToken)
      .mockResolvedValueOnce(mockProfile)
      .mockResolvedValueOnce(JSON.stringify(mockImdsCreds));

    vi.mocked(retry).mockImplementation((fn: any) => fn());
    vi.mocked(fromImdsCredentials).mockReturnValue(mockCreds);

    const fromInstanceMetadataFunc = fromInstanceMetadata();
    await expect(fromInstanceMetadataFunc()).resolves.toEqual(mockCreds);
    await expect(fromInstanceMetadataFunc()).resolves.toEqual(mockCreds);
  });

  it("uses insecure data flow once, if error statusCode is not 400, 403, 404, 405", async () => {
    const tokenError = Object.assign(new Error("Error"), { statusCode: 406 });

    vi.mocked(httpRequest)
      .mockRejectedValueOnce(tokenError)
      .mockResolvedValueOnce(mockProfile)
      .mockResolvedValueOnce(JSON.stringify(mockImdsCreds))
      .mockResolvedValueOnce(mockToken)
      .mockResolvedValueOnce(mockProfile)
      .mockResolvedValueOnce(JSON.stringify(mockImdsCreds));

    vi.mocked(retry).mockImplementation((fn: any) => fn());
    vi.mocked(fromImdsCredentials).mockReturnValue(mockCreds);

    const fromInstanceMetadataFunc = fromInstanceMetadata();
    await expect(fromInstanceMetadataFunc()).resolves.toEqual(mockCreds);
    await expect(fromInstanceMetadataFunc()).resolves.toEqual(mockCreds);
  });

  // ToDo: Investigate why Jest29 throws TypeError: Class constructor cannot be invoked without 'new'
  it.skip("allows blocking imdsv1 fallback", async () => {
    const tokenError = Object.assign(new Error("Error"), { statusCode: 406 });

    vi.mocked(httpRequest).mockRejectedValueOnce(tokenError);

    vi.mocked(retry).mockImplementation((fn: any) => fn());
    vi.mocked(fromImdsCredentials).mockReturnValue(mockCreds);

    const fromInstanceMetadataFunc = fromInstanceMetadata({
      ec2MetadataV1Disabled: true,
    });
    await fromInstanceMetadataFunc();
    await expect(() => fromInstanceMetadataFunc()).rejects.toBeInstanceOf(InstanceMetadataV1FallbackError);
  });
});
