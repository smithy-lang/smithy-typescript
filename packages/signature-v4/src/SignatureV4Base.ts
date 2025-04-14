import {
  AwsCredentialIdentity,
  ChecksumConstructor,
  DateInput,
  HashConstructor,
  HeaderBag,
  HttpRequest,
  Provider,
} from "@smithy/types";
import { toHex } from "@smithy/util-hex-encoding";
import { normalizeProvider } from "@smithy/util-middleware";
import { escapeUri } from "@smithy/util-uri-escape";
import { toUint8Array } from "@smithy/util-utf8";

import { getCanonicalQuery } from "./getCanonicalQuery";
import { iso8601 } from "./utilDate";

/**
 * @public
 */
export interface SignatureV4Init {
  /**
   * The service signing name.
   */
  service: string;

  /**
   * The region name or a function that returns a promise that will be
   * resolved with the region name.
   */
  region: string | Provider<string>;

  /**
   * The credentials with which the request should be signed or a function
   * that returns a promise that will be resolved with credentials.
   */
  credentials: AwsCredentialIdentity | Provider<AwsCredentialIdentity>;

  /**
   * A constructor function for a hash object that will calculate SHA-256 HMAC
   * checksums.
   */
  sha256?: ChecksumConstructor | HashConstructor;

  /**
   * Whether to uri-escape the request URI path as part of computing the
   * canonical request string. This is required for every AWS service, except
   * Amazon S3, as of late 2017.
   *
   * @default [true]
   */
  uriEscapePath?: boolean;

  /**
   * Whether to calculate a checksum of the request body and include it as
   * either a request header (when signing) or as a query string parameter
   * (when presigning). This is required for AWS Glacier and Amazon S3 and optional for
   * every other AWS service as of late 2017.
   *
   * @default [true]
   */
  applyChecksum?: boolean;
}

/**
 * @public
 */
export interface SignatureV4CryptoInit {
  sha256: ChecksumConstructor | HashConstructor;
}

/**
 * @internal
 */
export abstract class SignatureV4Base {
  protected readonly service: string;
  protected readonly regionProvider: Provider<string>;
  protected readonly credentialProvider: Provider<AwsCredentialIdentity>;
  protected readonly sha256: ChecksumConstructor | HashConstructor;
  private readonly uriEscapePath: boolean;
  protected readonly applyChecksum: boolean;

  protected constructor({
    applyChecksum,
    credentials,
    region,
    service,
    sha256,
    uriEscapePath = true,
  }: SignatureV4Init & SignatureV4CryptoInit) {
    this.service = service;
    this.sha256 = sha256;
    this.uriEscapePath = uriEscapePath;
    // default to true if applyChecksum isn't set
    this.applyChecksum = typeof applyChecksum === "boolean" ? applyChecksum : true;
    this.regionProvider = normalizeProvider(region);
    this.credentialProvider = normalizeProvider(credentials);
  }

  protected createCanonicalRequest(request: HttpRequest, canonicalHeaders: HeaderBag, payloadHash: string): string {
    const sortedHeaders = Object.keys(canonicalHeaders).sort();
    return `${request.method}
${this.getCanonicalPath(request)}
${getCanonicalQuery(request)}
${sortedHeaders.map((name) => `${name}:${canonicalHeaders[name]}`).join("\n")}

${sortedHeaders.join(";")}
${payloadHash}`;
  }

  protected async createStringToSign(
    longDate: string,
    credentialScope: string,
    canonicalRequest: string,
    algorithmIdentifier: string
  ): Promise<string> {
    const hash = new this.sha256();
    hash.update(toUint8Array(canonicalRequest));
    const hashedRequest = await hash.digest();

    return `${algorithmIdentifier}
${longDate}
${credentialScope}
${toHex(hashedRequest)}`;
  }

  private getCanonicalPath({ path }: HttpRequest): string {
    if (this.uriEscapePath) {
      // Non-S3 services, we normalize the path and then double URI encode it.
      // Ref: "Remove Dot Segments" https://datatracker.ietf.org/doc/html/rfc3986#section-5.2.4
      const normalizedPathSegments = [];
      for (const pathSegment of path.split("/")) {
        if (pathSegment?.length === 0) continue;
        if (pathSegment === ".") continue;
        if (pathSegment === "..") {
          normalizedPathSegments.pop();
        } else {
          normalizedPathSegments.push(pathSegment);
        }
      }
      // Joining by single slashes to remove consecutive slashes.
      const normalizedPath = `${path?.startsWith("/") ? "/" : ""}${normalizedPathSegments.join("/")}${
        normalizedPathSegments.length > 0 && path?.endsWith("/") ? "/" : ""
      }`;

      // Double encode and replace non-standard characters !'()* according to RFC 3986
      const doubleEncoded = escapeUri(normalizedPath);
      return doubleEncoded.replace(/%2F/g, "/");
    }

    // For S3, we shouldn't normalize the path. For example, object name
    // my-object//example//photo.user should not be normalized to
    // my-object/example/photo.user
    return path;
  }

  protected validateResolvedCredentials(credentials: unknown) {
    if (
      typeof credentials !== "object" ||
      // @ts-expect-error: Property 'accessKeyId' does not exist on type 'object'.ts(2339)
      typeof credentials.accessKeyId !== "string" ||
      // @ts-expect-error: Property 'secretAccessKey' does not exist on type 'object'.ts(2339)
      typeof credentials.secretAccessKey !== "string"
    ) {
      throw new Error("Resolved credential object is not valid");
    }
  }

  protected formatDate(now: DateInput): { longDate: string; shortDate: string } {
    const longDate = iso8601(now).replace(/[\-:]/g, "");
    return {
      longDate,
      shortDate: longDate.slice(0, 8),
    };
  }

  protected getCanonicalHeaderList(headers: object): string {
    return Object.keys(headers).sort().join(";");
  }
}
