import {
  getHttpApiKeyAuthPlugin,
  httpApiKeyAuthMiddleware,
  resolveHttpApiKeyAuthConfig,
} from "./index";
import { HttpRequest } from "@aws-sdk/protocol-http";

describe("resolveHttpApiKeyAuthConfig", () => {
  it("should return the input unchanged", () => {
    const config = {
      apiKey: "exampleApiKey",
    };
    expect(resolveHttpApiKeyAuthConfig(config)).toEqual(config);
  });
});

describe("getHttpApiKeyAuthPlugin", () => {
  it("should apply the middleware to the stack", () => {
    const plugin = getHttpApiKeyAuthPlugin(
      {
        apiKey: "exampleApiKey",
      },
      {
        in: "query",
        name: "key",
      }
    );

    const mockAdd = jest.fn();
    const mockOther = jest.fn();

    // TODO there's got to be a better way to do this mocking
    plugin.applyToStack({
      add: mockAdd,
      // We don't expect any of these others to be called.
      addRelativeTo: mockOther,
      concat: mockOther,
      resolve: mockOther,
      applyToStack: mockOther,
      use: mockOther,
      clone: mockOther,
      remove: mockOther,
      removeByTag: mockOther,
    });

    expect(mockAdd.mock.calls.length).toEqual(1);
    expect(mockOther.mock.calls.length).toEqual(0);
  });
});

describe("httpApiKeyAuthMiddleware", () => {
  describe("returned middleware function", () => {
    const mockNextHandler = jest.fn();

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should set the query parameter if the location is `query`", async () => {
      const middleware = httpApiKeyAuthMiddleware(
        {
          apiKey: "exampleApiKey",
        },
        {
          in: "query",
          name: "key",
        }
      );

      const handler = middleware(mockNextHandler, {});

      await handler({
        input: {},
        request: new HttpRequest({}),
      });

      expect(mockNextHandler.mock.calls.length).toEqual(1);
      expect(
        mockNextHandler.mock.calls[0][0].request.query.key
      ).toBe("exampleApiKey");
    });

    it("should throw an error if the api key has not been set", async () => {
      const middleware = httpApiKeyAuthMiddleware(
        {},
        {
          in: "header",
          name: "auth",
          scheme: "scheme",
        }
      );

      const handler = middleware(mockNextHandler, {});

      await expect(
        handler({
          input: {},
          request: new HttpRequest({}),
        })
      ).rejects.toThrow("no API key was provided");

      expect(mockNextHandler.mock.calls.length).toEqual(0);
    });

    it("should skip if the request is not an HttpRequest", async () => {
      const middleware = httpApiKeyAuthMiddleware(
        {},
        {
          in: "header",
          name: "Authorization",
        }
      );

      const handler = middleware(mockNextHandler, {});

      await handler({
        input: {},
        request: {},
      });

      expect(mockNextHandler.mock.calls.length).toEqual(1);
    });

    it("should set the API key in the lower-cased named header", async () => {
      const middleware = httpApiKeyAuthMiddleware(
        {
          apiKey: "exampleApiKey",
        },
        {
          in: "header",
          name: "Authorization",
        }
      );

      const handler = middleware(mockNextHandler, {});

      await handler({
        input: {},
        request: new HttpRequest({}),
      });

      expect(mockNextHandler.mock.calls.length).toEqual(1);
      expect(
        mockNextHandler.mock.calls[0][0].request.headers.authorization
      ).toBe("exampleApiKey");
    });

    it("should set the API key in the named header with the provided scheme", async () => {
      const middleware = httpApiKeyAuthMiddleware(
        {
          apiKey: "exampleApiKey",
        },
        {
          in: "header",
          name: "authorization",
          scheme: "exampleScheme",
        }
      );
      const handler = middleware(mockNextHandler, {});

      await handler({
        input: {},
        request: new HttpRequest({}),
      });

      expect(mockNextHandler.mock.calls.length).toEqual(1);
      expect(
        mockNextHandler.mock.calls[0][0].request.headers.authorization
      ).toBe("exampleScheme exampleApiKey");
    });
  });
});
