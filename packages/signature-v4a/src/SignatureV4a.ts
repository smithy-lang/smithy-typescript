import {
  ALGORITHM_IDENTIFIER_V4A,
  AMZ_DATE_HEADER,
  AUTH_HEADER,
  SHA256_HEADER,
  TOKEN_HEADER,
} from "@smithy/signature-v4";
import { getCanonicalHeaders } from "@smithy/signature-v4";
import { getPayloadHash } from "@smithy/signature-v4";
import { hasHeader } from "@smithy/signature-v4";
import { prepareRequest } from "@smithy/signature-v4";
import { SignatureV4Base, SignatureV4CryptoInit, SignatureV4Init } from "@smithy/signature-v4";
import { HttpRequest, RequestSigner, RequestSigningArguments } from "@smithy/types";
import { toHex } from "@smithy/util-hex-encoding";
import { toUint8Array } from "@smithy/util-utf8";

import { REGION_HEADER } from "./constants";
import { createSigV4aScope, getSigV4aSigningKey } from "./credentialDerivation";
// @ts-ignore
import { Ec } from "./elliptic/Ec";

/**
 * @public
 */
export class SignatureV4a extends SignatureV4Base implements RequestSigner {
  /**
   * Creates a SigV4a signer
   * @param applyChecksum Apply checksum header
   * @param credentials Credentials to use when signing
   * @param region Region to sign for, Wildcard (*) also accepted
   * @param service Service to sign for
   * @param uriEscapePath Defaults to true. Used for non s3 services.
   */
  constructor({
    applyChecksum,
    credentials,
    region,
    service,
    sha256,
    uriEscapePath = true,
  }: SignatureV4Init & SignatureV4CryptoInit) {
    super({
      applyChecksum,
      credentials,
      region,
      service,
      sha256,
      uriEscapePath,
    });
  }

  /**
   * Sign a request using SigV4a
   * @param toSign HttpRequest to sign
   * @param options Additional options
   */
  public async sign(toSign: HttpRequest, options: any): Promise<any> {
    return this.signRequest(toSign, options);
  }

  /**
   * Sign a SigV4a request and return its modified HttpRequest. See SigV4a wiki for implementation details
   * @param requestToSign HttpRequest to sign
   * @param signingDate Signing date (uses UTC now if not specified)
   * @param signableHeaders Headers to include in the signing process
   * @param unsignableHeaders Headers to not include in the signing process
   * @param signingRegion Region to sign the request for. '*' can be used as a wildcard. Falls back to constructor value
   * @param signingService Service to sign for
   * @private
   */
  private async signRequest(
    requestToSign: HttpRequest,
    {
      signingDate = new Date(),
      signableHeaders,
      unsignableHeaders,
      signingRegion,
      signingService,
    }: RequestSigningArguments = {}
  ): Promise<HttpRequest> {
    const credentials = await this.credentialProvider();
    this.validateResolvedCredentials(credentials);
    const region = signingRegion ?? (await this.regionProvider());
    const request = prepareRequest(requestToSign);
    const { longDate, shortDate } = this.formatDate(signingDate);
    const scope = createSigV4aScope(shortDate, signingService ?? this.service);
    const pKey = await getSigV4aSigningKey(this.sha256, credentials.accessKeyId, credentials.secretAccessKey);

    request.headers[AMZ_DATE_HEADER] = longDate;
    if (credentials.sessionToken) {
      request.headers[TOKEN_HEADER] = credentials.sessionToken;
    }

    // Region can also be '*' for SigV4a
    request.headers[REGION_HEADER] = region;

    const payloadHash = await getPayloadHash(request, this.sha256);
    if (!hasHeader(SHA256_HEADER, request.headers) && this.applyChecksum) {
      request.headers[SHA256_HEADER] = payloadHash;
    }

    const canonicalHeaders = getCanonicalHeaders(request, unsignableHeaders, signableHeaders);
    const canonicalRequest = this.createCanonicalRequest(request, canonicalHeaders, payloadHash);
    const stringToSign = await this.createStringToSign(longDate, scope, canonicalRequest, ALGORITHM_IDENTIFIER_V4A);

    const signature = await this.GetSignature(pKey, stringToSign);

    request.headers[AUTH_HEADER] =
      `${ALGORITHM_IDENTIFIER_V4A} ` +
      `Credential=${credentials.accessKeyId}/${scope}, ` +
      `SignedHeaders=${this.getCanonicalHeaderList(canonicalHeaders)}, ` +
      `Signature=${signature}`;

    return request;
  }

  /**
   *
   * @param privateKey Calculated private key
   * @param stringToSign String to sign using private key
   * @private
   */
  private async GetSignature(privateKey: Uint8Array, stringToSign: string): Promise<string> {
    // Create ECDSA and get key pair
    const ecdsa = new Ec("p256");
    const key = ecdsa.keyFromPrivate(privateKey);

    // Format request using SHA256
    const hash = new this.sha256();
    hash.update(toUint8Array(stringToSign));
    const hashResult = await hash.digest();

    // Finally sign using ECDSA keypair.
    const signature = key.sign(hashResult);

    // Convert signature to DER format (ASN.1's normal singing format)
    return toHex(new Uint8Array(signature.toDER()));
  }
}
