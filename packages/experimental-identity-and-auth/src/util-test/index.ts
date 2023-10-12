import { expect } from "@jest/globals";
import { FinalizeRequestMiddleware, HandlerExecutionContext } from "@smithy/types";
import { getSmithyContext } from "@smithy/util-middleware";
import { requireRequestsFrom } from "@smithy/util-test";

import { SelectedHttpAuthScheme } from "../HttpAuthScheme";

/**
 * @internal
 */
export const expectClientCommand = async (input: any) => {
  const {
    // Constructors
    clientConstructor,
    commandConstructor,
    // Config
    defaultClientConfig = {
      // Arbitrary mock endpoint (`requireRequestsFrom()` intercepts network requests)
      endpoint: "https://foo.bar",
    },
    clientConfig = {},
    // Request Matching
    requestMatchers = {
      headers: {
        Authorization: (val: any) => expect(val).toBeUndefined(),
        authorization: (val: any) => expect(val).toBeUndefined(),
      },
    },
    // Expectations
    contextExpectFn = undefined,
    clientRejects = undefined,
  } = input;
  const client = new clientConstructor(Object.assign({}, defaultClientConfig, clientConfig));
  if (contextExpectFn) {
    client.middlewareStack.add(
      ((next, context) => async (args) => {
        (contextExpectFn as Function)(context);
        return next(args);
      }) as FinalizeRequestMiddleware<any, any>,
      {
        step: "finalizeRequest",
        priority: "low",
      }
    );
  }
  requireRequestsFrom(client).toMatch(requestMatchers);
  const command = new commandConstructor({});
  if (clientRejects) {
    await expect(client.send(command)).rejects.toThrow(clientRejects);
  } else {
    await client.send(command);
  }
};

/**
 * @internal
 */
export const getSelectedHttpAuthScheme = (context: HandlerExecutionContext): SelectedHttpAuthScheme =>
  getSmithyContext(context).selectedHttpAuthScheme as SelectedHttpAuthScheme;
