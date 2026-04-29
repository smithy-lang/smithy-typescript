import { fstatSync, lstatSync, ReadStream } from "node:fs";

/**
 * @internal
 */
type HasFileDescriptor = {
  fd: number;
};

/**
 * @internal
 */
export const calculateBodyLength = (body: any): number | undefined => {
  if (!body) {
    return 0;
  }
  if (typeof body === "string") {
    return Buffer.byteLength(body);
  } else if (typeof body.byteLength === "number") {
    // handles Uint8Array, ArrayBuffer, Buffer, and ArrayBufferView
    return body.byteLength;
  } else if (typeof body.size === "number") {
    return body.size;
  } else if (typeof body.start === "number" && typeof body.end === "number") {
    return body.end + 1 - body.start;
  } else if (body instanceof ReadStream) {
    // the previous use case where start and end are numbers is also potentially a ReadStream.
    if (body.path != null) {
      return lstatSync(body.path).size;
    } else if (typeof (body as ReadStream & HasFileDescriptor).fd === "number") {
      return fstatSync((body as ReadStream & HasFileDescriptor).fd).size;
    }
  }
  throw new Error(`Body Length computation failed for ${body}`);
};
