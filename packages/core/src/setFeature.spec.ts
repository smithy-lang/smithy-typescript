import { HandlerExecutionContext } from "@smithy/types";

import { setFeature } from "./setFeature";

describe(setFeature.name, () => {
  it("creates the context object path if needed", () => {
    const context: HandlerExecutionContext = {};
    setFeature(context, "RETRY_MODE_STANDARD", "E");
  });
});
