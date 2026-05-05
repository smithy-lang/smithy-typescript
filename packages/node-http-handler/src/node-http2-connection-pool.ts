import type { ClientHttp2Session } from "node:http2";
import type { ConnectionPool } from "@smithy/types";

import { ClientHttp2SessionRef } from "./http2/ClientHttp2SessionRef";

/**
 * These are keyed by URL, therefore all sessions within this class' state
 * are for the same URL.
 *
 * Sessions remain in the pool for their entire lifetime (until destroyed or
 * removed). The pool tracks capacity via each session's ref count.
 *
 * Interface implementation changed from ConnectionPool<ClientHttp2Session>.
 * @since 4.6.0
 * @internal
 */
export class NodeHttp2ConnectionPool implements ConnectionPool<ClientHttp2SessionRef> {
  private readonly sessions: ClientHttp2SessionRef[] = [];
  private maxConcurrency = 0;

  constructor(sessions?: ClientHttp2Session[]) {
    this.sessions = (sessions ?? []).map((session: ClientHttp2Session) => new ClientHttp2SessionRef(session));
  }

  /**
   * Find a session with available capacity (refs < maxConcurrency).
   * Returns undefined if all sessions are at capacity or the pool is empty.
   */
  public poll(): ClientHttp2SessionRef | undefined {
    let cleanup = false;
    for (const session of this.sessions) {
      if (session.deref().destroyed) {
        cleanup = true;
        continue;
      }
      if (!this.maxConcurrency || session.useCount() < this.maxConcurrency) {
        return session;
      }
    }
    if (cleanup) {
      for (const session of this.sessions) {
        if (session.deref().destroyed) {
          this.remove(session);
        }
      }
    }
  }

  /**
   * Add a session to the pool.
   */
  public offerLast(ref: ClientHttp2SessionRef): void {
    this.sessions.push(ref);
  }

  public remove(ref: ClientHttp2SessionRef): void {
    const ix = this.sessions.indexOf(ref);
    if (ix > -1) {
      this.sessions.splice(ix, 1);
    }
  }

  public [Symbol.iterator]() {
    return this.sessions[Symbol.iterator]();
  }

  public setMaxConcurrency(maxConcurrency: number): void {
    this.maxConcurrency = maxConcurrency;
  }

  /**
   * This is unused, but part of the interface.
   * @deprecated
   */
  public destroy(ref: ClientHttp2SessionRef): void {
    this.remove(ref);
    ref.destroy();
  }
}
