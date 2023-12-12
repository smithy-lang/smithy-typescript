import { EventStreamSerdeContext } from "@smithy/types";

/**
 * @internal
 *
 * Attempts to merge the first event if it is the initial-response event type
 * into the operation output.
 *
 * If it is not the initial-response type, the value is restacked into the
 * iterator and the remaining iterations are pass-through to the
 * event stream.
 */
export async function bufferInitialResponse(
  field: string,
  deser: Function,
  output: any,
  context: EventStreamSerdeContext
) {
  const contents = { [field]: null as any };
  const controller = deser(output.body, context) as any;
  const it = controller[Symbol.asyncIterator]() as any;

  const initialResponse = (await it.next()) ?? {};

  if ("initial-response" in (initialResponse.value || {})) {
    Object.assign(contents, initialResponse.value["initial-response"]);
  } else {
    controller.push(initialResponse.value);
  }

  contents[field] = {
    async *[Symbol.asyncIterator]() {
      while (!it.done) {
        yield (await it.next()).value;
      }
    },
  };

  return contents;
}
