import { SerdeContext } from "@smithy/types";
import { Uint8ArrayBlobAdapter } from "@smithy/util-stream";

/**
 * @internal
 *
 * Collect low-level response body stream to Uint8Array.
 */
export const collectBody = async (
  streamBody: any = new Uint8Array(),
  context: {
    streamCollector: SerdeContext["streamCollector"];
  }
): Promise<Uint8ArrayBlobAdapter> => {
  if (streamBody instanceof Uint8Array) {
    return Uint8ArrayBlobAdapter.mutate(streamBody);
  }

  if (!streamBody) {
    return Uint8ArrayBlobAdapter.mutate(new Uint8Array());
  }

  const fromContext = context.streamCollector(streamBody);

  return Uint8ArrayBlobAdapter.mutate(await fromContext);
};
