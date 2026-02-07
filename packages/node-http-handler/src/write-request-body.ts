import type { HttpRequest } from "@smithy/types";
import type { ClientRequest } from "http";
import type { ClientHttp2Stream } from "http2";
import { Readable } from "stream";

import { timing } from "./timing";

const MIN_WAIT_TIME = 6_000;

/**
 * This resolves when writeBody has been called.
 *
 * @param httpRequest - opened Node.js request.
 * @param request - container with the request body.
 * @param maxContinueTimeoutMs - time to wait for the continue event.
 * @param externalAgent - whether agent is owned by caller code.
 */
export async function writeRequestBody(
  httpRequest: ClientRequest | ClientHttp2Stream,
  request: HttpRequest,
  maxContinueTimeoutMs = MIN_WAIT_TIME,
  externalAgent = false
): Promise<void> {
  const headers = request.headers ?? {};
  const expect = headers.Expect || headers.expect;

  let timeoutId = -1;
  let sendBody = true;

  if (!externalAgent && expect === "100-continue") {
    sendBody = await Promise.race<boolean>([
      new Promise((resolve) => {
        // If this resolves first (wins the race), it means that at least MIN_WAIT_TIME ms
        // elapsed and no continue, response, or error has happened.
        // The high default timeout is to give the server ample time to respond.
        // This is an unusual situation, and indicates the server may not be S3 actual
        // and did not correctly implement 100-continue event handling.
        // Strictly speaking, we should perhaps keep waiting up to the request timeout
        // and then throw an error, but we resolve true to allow the server to deal
        // with the request body.
        timeoutId = Number(timing.setTimeout(() => resolve(true), Math.max(MIN_WAIT_TIME, maxContinueTimeoutMs)));
      }),
      new Promise((resolve) => {
        httpRequest.on("continue", () => {
          timing.clearTimeout(timeoutId);
          resolve(true);
        });
        httpRequest.on("response", () => {
          // if this handler is called, then response is
          // already received and there is no point in
          // sending body or waiting
          timing.clearTimeout(timeoutId);
          resolve(false);
        });
        httpRequest.on("error", () => {
          timing.clearTimeout(timeoutId);
          // this handler does not reject with the error
          // because there is already an error listener
          // on the request in node-http-handler
          // and node-http2-handler.
          resolve(false);
        });
      }),
    ]);
  }

  if (sendBody) {
    writeBody(httpRequest, request.body);
  }
}

function writeBody(
  httpRequest: ClientRequest | ClientHttp2Stream,
  body?: string | ArrayBuffer | ArrayBufferView | Readable | Uint8Array
) {
  if (body instanceof Readable) {
    // pipe automatically handles end
    body.pipe(httpRequest);
    return;
  }

  if (body) {
    const isBuffer = Buffer.isBuffer(body);
    const isString = typeof body === "string";
    if (isBuffer || isString) {
      // https://github.com/aws/aws-sdk-js-v3/issues/6426
      // describes why we don't send an empty Buffer.
      if (isBuffer && body.byteLength === 0) {
        httpRequest.end();
      } else {
        httpRequest.end(body);
      }
      return;
    }

    const uint8 = body as Uint8Array;
    if (
      typeof uint8 === "object" &&
      uint8.buffer &&
      typeof uint8.byteOffset === "number" &&
      typeof uint8.byteLength === "number"
    ) {
      // this avoids copying the array.
      httpRequest.end(Buffer.from(uint8.buffer, uint8.byteOffset, uint8.byteLength));
      return;
    }

    httpRequest.end(Buffer.from(body as ArrayBuffer));
    return;
  }

  httpRequest.end();
}
