/**
 * Peeks the first frame of the async iterable and writes the values into
 * the container if it is an initial-response event.
 *
 * @internal
 *
 * @param container - write destination for initial-response.
 * @param responseIterable - the response event stream.
 */
export async function writeResponse<T>(
  container: Record<string, any>,
  responseIterable: AsyncIterable<T>
): Promise<AsyncIterable<T>> {
  const asyncIterator = responseIterable[Symbol.asyncIterator]();
  // todo: handle empty iterator or timeout.
  const firstFrame = await asyncIterator.next();
  if (firstFrame.value.$unknown?.["initial-response"]) {
    console.log("assigned initial response into container", {
      initialResponse: firstFrame.value.$unknown["initial-response"],
    });
    Object.assign(container, firstFrame.value.$unknown["initial-response"]);
    return {
      [Symbol.asyncIterator]: () => ({
        next: asyncIterator.next.bind(asyncIterator),
      }),
    };
  }
  return responseIterable;
}

/**
 * @internal
 */
export async function writeRequest<T>() {
  throw new Error("not implemented");
}
