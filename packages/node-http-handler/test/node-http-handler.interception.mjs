/**
 * This test is in mjs because we do not want the transform applied by any test framework
 * to interfere with the assertions.
 */
import http from "node:http";
import https from "node:https";
import { NodeHttpHandler } from "../dist-cjs/index.js";
import { HttpRequest } from "@smithy/core/protocols";

const originalHttpRequest = http.request;
const originalHttpsRequest = https.request;

let failures = 0;

// Test http interception
{
  let called = false;
  http.request = function (...args) {
    called = true;
    throw new Error("intercepted");
  };

  try {
    const handler = new NodeHttpHandler();
    await handler.handle(
      new HttpRequest({ protocol: "http:", hostname: "localhost", method: "GET", path: "/", headers: {} })
    );
  } catch {}

  http.request = originalHttpRequest;

  if (called) {
    console.log("✅ http.request interception works");
  } else {
    console.log("❌ http.request interception FAILED");
    failures++;
  }
}

// Test https interception
{
  let called = false;
  https.request = function (...args) {
    called = true;
    throw new Error("intercepted");
  };

  try {
    const handler = new NodeHttpHandler();
    await handler.handle(
      new HttpRequest({ protocol: "https:", hostname: "localhost", method: "GET", path: "/", headers: {} })
    );
  } catch {}

  https.request = originalHttpsRequest;

  if (called) {
    console.log("✅ https.request interception works");
  } else {
    console.log("❌ https.request interception FAILED");
    failures++;
  }
}

process.exit(failures);
