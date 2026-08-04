/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { concatBytes, fromBase64, toBase64, fromUtf8, toUtf8 } from "@smithy/core/serde";
import type { SerdeFunctions } from "@smithy/types";

/**
 * Creates a default SerdeFunctions context for server-side protocol usage.
 * Provides base64 and UTF-8 codecs plus a stream collector.
 *
 * @internal
 */
export function createDefaultSerdeContext(): SerdeFunctions {
  return {
    base64Encoder: toBase64,
    base64Decoder: fromBase64,
    utf8Encoder: toUtf8,
    utf8Decoder: fromUtf8,
    streamCollector,
  };
}

async function streamCollector(stream: any): Promise<Uint8Array> {
  if (stream instanceof Uint8Array) {
    return stream;
  }
  if (!stream) {
    return new Uint8Array(0);
  }
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === "string" ? fromUtf8(chunk) : chunk);
  }
  return concatBytes(chunks);
}
