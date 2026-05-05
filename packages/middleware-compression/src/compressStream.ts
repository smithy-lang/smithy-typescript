import type { Readable } from "node:stream";
import { createGzip } from "node:zlib";

export const compressStream = async (body: Readable): Promise<Readable> => body.pipe(createGzip());
