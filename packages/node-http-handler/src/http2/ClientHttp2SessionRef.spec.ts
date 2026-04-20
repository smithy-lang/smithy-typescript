import type { ClientHttp2Session } from "node:http2";
import { describe, expect, test as it, vi } from "vitest";

import { ClientHttp2SessionRef } from "./ClientHttp2SessionRef";

const createMockSession = (destroyed = false) => {
  const session = {
    ref: vi.fn(),
    unref: vi.fn(),
    destroy: vi.fn(() => {
      (session as any).destroyed = true;
    }),
    destroyed,
  } as unknown as ClientHttp2Session;
  return session;
};

describe(ClientHttp2SessionRef.name, () => {
  it("calls unref on the session at the start of object lifecycle", () => {
    const session = createMockSession();
    new ClientHttp2SessionRef(session);
    expect(session.unref).toHaveBeenCalledTimes(1);
  });

  it("retain() calls ref on the session", () => {
    const session = createMockSession();
    const ref = new ClientHttp2SessionRef(session);
    ref.retain();
    expect(session.ref).toHaveBeenCalledTimes(1);
  });

  it("retain() throws if session is destroyed", () => {
    const session = createMockSession(true);
    const ref = new ClientHttp2SessionRef(session);
    expect(() => ref.retain()).toThrow("cannot acquire reference to destroyed session");
  });

  it("deref() returns the session without ref-counting", () => {
    const session = createMockSession();
    const ref = new ClientHttp2SessionRef(session);
    expect(ref.deref()).toBe(session);
    expect(session.ref).not.toHaveBeenCalled();
  });

  it("free() calls unref when refcount reaches zero", () => {
    const session = createMockSession();
    const ref = new ClientHttp2SessionRef(session);
    ref.retain();
    // 1 from constructor
    expect(session.unref).toHaveBeenCalledTimes(1);
    ref.free();
    // 1 from constructor + 1 from free reaching zero
    expect(session.unref).toHaveBeenCalledTimes(2);
  });

  it("free() does not call unref when refcount is still positive", () => {
    const session = createMockSession();
    const ref = new ClientHttp2SessionRef(session);
    ref.retain();
    ref.retain();
    ref.free(); // refcount 2 -> 1
    // only constructor unref
    expect(session.unref).toHaveBeenCalledTimes(1);
  });

  it("free() throws when refcount goes below zero", () => {
    const session = createMockSession();
    const ref = new ClientHttp2SessionRef(session);
    expect(() => ref.free()).toThrow("refcount at zero, cannot decrement");
  });

  it("free() is a no-op on destroyed session", () => {
    const session = createMockSession();
    const ref = new ClientHttp2SessionRef(session);
    ref.retain();
    ref.destroy();
    // should not throw
    ref.free();
  });

  it("destroy() destroys the session and resets refcount", () => {
    const session = createMockSession();
    const ref = new ClientHttp2SessionRef(session);
    ref.retain();
    ref.destroy();
    expect(session.destroy).toHaveBeenCalledTimes(1);
  });

  it("destroy() is safe to call on already-destroyed session", () => {
    const session = createMockSession(true);
    const ref = new ClientHttp2SessionRef(session);
    ref.destroy();
    expect(session.destroy).not.toHaveBeenCalled();
  });
});
