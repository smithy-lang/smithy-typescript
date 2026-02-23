import type { HttpRequest } from "@smithy/types";
import { describe, expect, it as test } from "vitest";

import { serializeHttpRequest } from "./serializeHttpRequest";

describe("serializeHttpRequest user-agent replacement", () => {
  test("should replace aws-sdk-js version", async () => {
    const request: HttpRequest = {
      method: "GET",
      protocol: "https:",
      hostname: "example.com",
      path: "/",
      headers: {
        "user-agent": "aws-sdk-js/3.123.456 os/linux lang/js",
      },
    };

    const result = await serializeHttpRequest(request);
    expect(result).toEqual(`GET https://example.com 
/

user-agent: aws-sdk-js/3.___._ lang/js

[no body]

`);
  });

  test("should remove os metadata", async () => {
    const request: HttpRequest = {
      method: "GET",
      protocol: "https:",
      hostname: "example.com",
      path: "/",
      headers: {
        "user-agent": "aws-sdk-js/3.0.0 os/darwin lang/js",
      },
    };

    const result = await serializeHttpRequest(request);
    expect(result).toEqual(`GET https://example.com 
/

user-agent: aws-sdk-js/3.___._ lang/js

[no body]

`);
  });

  test("should remove exec-env with various formats", async () => {
    const request: HttpRequest = {
      method: "GET",
      protocol: "https:",
      hostname: "example.com",
      path: "/",
      headers: {
        "user-agent": "aws-sdk-js/3.0.0 exec-env/AWS_Lambda_nodejs20.x lang/js",
      },
    };

    const result = await serializeHttpRequest(request);
    expect(result).toEqual(`GET https://example.com 
/

user-agent: aws-sdk-js/3.___._ lang/js

[no body]

`);
  });

  test("should remove exec-env with periods, underscores, and dashes", async () => {
    const request: HttpRequest = {
      method: "GET",
      protocol: "https:",
      hostname: "example.com",
      path: "/",
      headers: {
        "x-amz-user-agent": "aws-sdk-js/3.0.0 exec-env/test_env.name-123 lang/js",
      },
    };

    const result = await serializeHttpRequest(request);
    expect(result).toEqual(`GET https://example.com 
/

x-amz-user-agent: aws-sdk-js/3.___._ lang/js

[no body]

`);
  });

  test("should replace hash version", async () => {
    const request: HttpRequest = {
      method: "GET",
      protocol: "https:",
      hostname: "example.com",
      path: "/",
      headers: {
        "user-agent": "aws-sdk-js/3.0.0 #1.2.3 lang/js",
      },
    };

    const result = await serializeHttpRequest(request);
    expect(result).toEqual(`GET https://example.com 
/

user-agent: aws-sdk-js/3.___._ #_.__ lang/js

[no body]

`);
  });
});
