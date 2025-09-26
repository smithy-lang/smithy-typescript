import type {
  AwsCredentialIdentity,
  EventSigner,
  EventSigningArguments,
  FormattedEvent,
  HttpRequest,
  MessageSigner,
  RequestPresigner,
  RequestPresigningArguments,
  RequestSigner,
  RequestSigningArguments,
  SignableMessage,
  SignedMessage,
  SigningArguments,
  StringSigner,
} from "@smithy/types";
import { toHex } from "@smithy/util-hex-encoding";
import { toUint8Array } from "@smithy/util-utf8";

import {
  ALGORITHM_IDENTIFIER,
  ALGORITHM_QUERY_PARAM,
  AMZ_DATE_HEADER,
  AMZ_DATE_QUERY_PARAM,
  AUTH_HEADER,
  CREDENTIAL_QUERY_PARAM,
  EVENT_ALGORITHM_IDENTIFIER,
  EXPIRES_QUERY_PARAM,
  MAX_PRESIGNED_TTL,
  SHA256_HEADER,
  SIGNATURE_QUERY_PARAM,
  SIGNED_HEADERS_QUERY_PARAM,
  TOKEN_HEADER,
  TOKEN_QUERY_PARAM,
} from "./constants";
import { createScope, getSigningKey } from "./credentialDerivation";
import { getCanonicalHeaders } from "./getCanonicalHeaders";
import { getPayloadHash } from "./getPayloadHash";
import { HeaderFormatter } from "./HeaderFormatter";
import { hasHeader } from "./headerUtil";
import { moveHeadersToQuery } from "./moveHeadersToQuery";
import { prepareRequest } from "./prepareRequest";
import type { SignatureV4CryptoInit, SignatureV4Init } from "./SignatureV4Base";
import { SignatureV4Base } from "./SignatureV4Base";

/**
 * @public
 */
export class SignatureV4
  extends SignatureV4Base
  implements RequestPresigner, RequestSigner, StringSigner, EventSigner, MessageSigner
{
  private readonly headerFormatter = new HeaderFormatter();

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

  public async presign(originalRequest: HttpRequest, options: RequestPresigningArguments = {}): Promise<HttpRequest> {
    const {
      signingDate = new Date(),
      expiresIn = 3600,
      unsignableHeaders,
      unhoistableHeaders,
      signableHeaders,
      hoistableHeaders,
      signingRegion,
      signingService,
    } = options;
    const credentials = await this.credentialProvider();
    this.validateResolvedCredentials(credentials);
    const region = signingRegion ?? (await this.regionProvider());

    const { longDate, shortDate } = this.formatDate(signingDate);
    if (expiresIn > MAX_PRESIGNED_TTL) {
      return Promise.reject(
        "Signature version 4 presigned URLs" + " must have an expiration date less than one week in" + " the future"
      );
    }

    const scope = createScope(shortDate, region, signingService ?? this.service);
    const request = moveHeadersToQuery(prepareRequest(originalRequest), { unhoistableHeaders, hoistableHeaders });

    if (credentials.sessionToken) {
      request.query[TOKEN_QUERY_PARAM] = credentials.sessionToken;
    }
    request.query[ALGORITHM_QUERY_PARAM] = ALGORITHM_IDENTIFIER;
    request.query[CREDENTIAL_QUERY_PARAM] = `${credentials.accessKeyId}/${scope}`;
    request.query[AMZ_DATE_QUERY_PARAM] = longDate;
    request.query[EXPIRES_QUERY_PARAM] = expiresIn.toString(10);

    const canonicalHeaders = getCanonicalHeaders(request, unsignableHeaders, signableHeaders);
    request.query[SIGNED_HEADERS_QUERY_PARAM] = this.getCanonicalHeaderList(canonicalHeaders);

    request.query[SIGNATURE_QUERY_PARAM] = await this.getSignature(
      longDate,
      scope,
      this.getSigningKey(credentials, region, shortDate, signingService),
      this.createCanonicalRequest(request, canonicalHeaders, await getPayloadHash(originalRequest, this.sha256))
    );

    return request;
  }

  public async sign(stringToSign: string, options?: SigningArguments): Promise<string>;
  public async sign(event: FormattedEvent, options: EventSigningArguments): Promise<string>;
  public async sign(event: SignableMessage, options: SigningArguments): Promise<SignedMessage>;
  public async sign(requestToSign: HttpRequest, options?: RequestSigningArguments): Promise<HttpRequest>;
  public async sign(toSign: any, options: any): Promise<any> {
    if (typeof toSign === "string") {
      return this.signString(toSign, options);
    } else if (toSign.headers && toSign.payload) {
      return this.signEvent(toSign, options);
    } else if (toSign.message) {
      return this.signMessage(toSign, options);
    } else {
      return this.signRequest(toSign, options);
    }
  }

  private async signEvent(
    { headers, payload }: FormattedEvent,
    { signingDate = new Date(), priorSignature, signingRegion, signingService }: EventSigningArguments
  ): Promise<string> {
    const region = signingRegion ?? (await this.regionProvider());
    const { shortDate, longDate } = this.formatDate(signingDate);
    const scope = createScope(shortDate, region, signingService ?? this.service);
    const hashedPayload = await getPayloadHash({ headers: {}, body: payload } as any, this.sha256);
    const hash = new this.sha256();
    hash.update(headers);
    const hashedHeaders = toHex(await hash.digest());
    const stringToSign = [
      EVENT_ALGORITHM_IDENTIFIER,
      longDate,
      scope,
      priorSignature,
      hashedHeaders,
      hashedPayload,
    ].join("\n");
    return this.signString(stringToSign, { signingDate, signingRegion: region, signingService });
  }

  async signMessage(
    signableMessage: SignableMessage,
    { signingDate = new Date(), signingRegion, signingService }: SigningArguments
  ): Promise<SignedMessage> {
    const promise = this.signEvent(
      {
        headers: this.headerFormatter.format(signableMessage.message.headers),
        payload: signableMessage.message.body,
      },
      {
        signingDate,
        signingRegion,
        signingService,
        priorSignature: signableMessage.priorSignature,
      }
    );

    return promise.then((signature) => {
      return { message: signableMessage.message, signature };
    });
  }

  private async signString(
    stringToSign: string,
    { signingDate = new Date(), signingRegion, signingService }: SigningArguments = {}
  ): Promise<string> {
    const credentials = await this.credentialProvider();
    this.validateResolvedCredentials(credentials);
    const region = signingRegion ?? (await this.regionProvider());
    const { shortDate } = this.formatDate(signingDate);

    const hash = new this.sha256(await this.getSigningKey(credentials, region, shortDate, signingService));
    hash.update(toUint8Array(stringToSign));
    return toHex(await hash.digest());
  }

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
    const scope = createScope(shortDate, region, signingService ?? this.service);

    request.headers[AMZ_DATE_HEADER] = longDate;
    if (credentials.sessionToken) {
      request.headers[TOKEN_HEADER] = credentials.sessionToken;
    }

    const payloadHash = await getPayloadHash(request, this.sha256);
    if (!hasHeader(SHA256_HEADER, request.headers) && this.applyChecksum) {
      request.headers[SHA256_HEADER] = payloadHash;
    }

    const canonicalHeaders = getCanonicalHeaders(request, unsignableHeaders, signableHeaders);
    const signature = await this.getSignature(
      longDate,
      scope,
      this.getSigningKey(credentials, region, shortDate, signingService),
      this.createCanonicalRequest(request, canonicalHeaders, payloadHash)
    );

    request.headers[AUTH_HEADER] =
      `${ALGORITHM_IDENTIFIER} ` +
      `Credential=${credentials.accessKeyId}/${scope}, ` +
      `SignedHeaders=${this.getCanonicalHeaderList(canonicalHeaders)}, ` +
      `Signature=${signature}`;

    return request;
  }

  private async getSignature(
    longDate: string,
    credentialScope: string,
    keyPromise: Promise<Uint8Array>,
    canonicalRequest: string
  ): Promise<string> {
    const stringToSign = await this.createStringToSign(
      longDate,
      credentialScope,
      canonicalRequest,
      ALGORITHM_IDENTIFIER
    );

    const hash = new this.sha256(await keyPromise);
    hash.update(toUint8Array(stringToSign));
    return toHex(await hash.digest());
  }

  private getSigningKey(
    credentials: AwsCredentialIdentity,
    region: string,
    shortDate: string,
    service?: string
  ): Promise<Uint8Array> {
    return getSigningKey(this.sha256, credentials, shortDate, region, service || this.service);
  }
}
