import http2, { type ClientHttp2Session, type ClientSessionOptions, type SecureClientSessionOptions } from "node:http2";
import type {
  ConnectConfiguration,
  ConnectionManager,
  ConnectionManagerConfiguration,
  RequestContext,
} from "@smithy/types";

import { ClientHttp2SessionRef } from "./http2/ClientHttp2SessionRef";
import { NodeHttp2ConnectionPool } from "./node-http2-connection-pool";

/**
 * This class previously implemented the ConnectionManager<ClientHttp2Session> interface,
 * but this class isn't exported from this package, except as a private property of NodeHttp2Handler.
 *
 * @since 4.6.0
 * @internal
 */
export class NodeHttp2ConnectionManager implements ConnectionManager<ClientHttp2SessionRef> {
  private config: ConnectionManagerConfiguration;
  private connectOptions?: Partial<SecureClientSessionOptions | ClientSessionOptions>;
  private readonly connectionPools: Map<string, NodeHttp2ConnectionPool> = new Map<string, NodeHttp2ConnectionPool>();

  constructor(config: ConnectionManagerConfiguration) {
    this.config = config;

    if (this.config.maxConcurrency && this.config.maxConcurrency <= 0) {
      throw new RangeError("maxConcurrency must be greater than zero.");
    }
  }

  /**
   * Acquire a session for making a request.
   */
  public lease(requestContext: RequestContext, connectionConfiguration: ConnectConfiguration): ClientHttp2SessionRef {
    const url = this.getUrlString(requestContext);

    const pool = this.getPool(url);

    if (!this.config.disableConcurrency && !connectionConfiguration.isEventStream) {
      const available = pool.poll();
      if (available) {
        available.retain();
        return available;
      }
    }

    const ref = new ClientHttp2SessionRef(this.connect(url));
    const session = ref.deref();

    if (this.config.maxConcurrency) {
      session.settings({ maxConcurrentStreams: this.config.maxConcurrency }, (err) => {
        if (err) {
          throw new Error(
            "Fail to set maxConcurrentStreams to " +
              this.config.maxConcurrency +
              "when creating new session for " +
              requestContext.destination.toString()
          );
        }
      });
    }

    const graceful = () => {
      this.removeFromPoolAndClose(url, ref);
    };
    const ensureDestroyed = () => {
      this.removeFromPoolAndCheckedDestroy(url, ref);
    };
    session.on("goaway", graceful);
    session.on("error", ensureDestroyed);
    session.on("frameError", ensureDestroyed);
    session.on("close", ensureDestroyed);

    if (connectionConfiguration.requestTimeout) {
      session.setTimeout(connectionConfiguration.requestTimeout, ensureDestroyed);
    }

    pool.offerLast(ref);
    ref.retain();
    return ref;
  }

  /**
   * Signal that a request using this session has completed.
   *
   * The session remains in its pool for reuse.
   * This method is not called for isolated sessions.
   */
  public release(_requestContext: RequestContext, ref: ClientHttp2SessionRef): void {
    ref.free();
  }

  /**
   * Create an isolated session that isn't part of the connection pools.
   * For use in event-streams or when concurrency is turned off.
   */
  public createIsolatedSession(
    requestContext: RequestContext,
    connectionConfiguration: ConnectConfiguration
  ): ClientHttp2SessionRef {
    const url = this.getUrlString(requestContext);
    const ref = new ClientHttp2SessionRef(this.connect(url));
    const session = ref.deref();

    session.settings({ maxConcurrentStreams: 1 });

    const ensureDestroyed = () => {
      ref.destroy();
    };

    // note: there is no goaway handler for an isolated session.
    // the session is already closing after receiving "goaway" and
    // there is no pool from which to remove it.
    session.on("error", ensureDestroyed);
    session.on("frameError", ensureDestroyed);
    session.on("close", ensureDestroyed);

    if (connectionConfiguration.requestTimeout) {
      session.setTimeout(connectionConfiguration.requestTimeout, ensureDestroyed);
    }

    ref.retain();
    return ref;
  }

  public destroy(): void {
    for (const [url, connectionPool] of this.connectionPools) {
      // copy pool array to avoid potential synchronous mutation from
      // call to session.destroy().
      for (const session of [...connectionPool]) {
        session.destroy();
      }
      this.connectionPools.delete(url);
    }
  }

  public setMaxConcurrentStreams(maxConcurrentStreams: number) {
    if (maxConcurrentStreams && maxConcurrentStreams <= 0) {
      throw new RangeError("maxConcurrentStreams must be greater than zero.");
    }
    this.config.maxConcurrency = maxConcurrentStreams;
    for (const pool of this.connectionPools.values()) {
      pool.setMaxConcurrency(maxConcurrentStreams);
    }
  }

  public setDisableConcurrentStreams(disableConcurrentStreams: boolean) {
    this.config.disableConcurrency = disableConcurrentStreams;
  }

  public setNodeHttp2ConnectOptions(
    nodeHttp2ConnectOptions: Partial<SecureClientSessionOptions | ClientSessionOptions>
  ) {
    this.connectOptions = nodeHttp2ConnectOptions;
  }

  /**
   * @internal
   * @returns a snapshot of the state of all connection pools and their sessions.
   */
  public debug() {
    const pools: Record<string, any> = {};
    for (const [url, pool] of this.connectionPools) {
      const sessions = [];
      for (const ref of pool) {
        sessions.push({
          id: ref.id,
          active: ref.useCount(),
          maxConcurrent: ref.max,
          totalRequests: ref.total,
        });
      }
      pools[url] = { sessions };
    }
    return pools;
  }

  private removeFromPoolAndClose(authority: string, ref: ClientHttp2SessionRef): void {
    this.connectionPools.get(authority)?.remove(ref);
    // no-op when this function is called as a "goaway" reaction,
    // but in case the method is called from another path, this is a defensive closure
    // because we lose the reference to the session.
    ref.close();
  }

  private removeFromPoolAndCheckedDestroy(authority: string, ref: ClientHttp2SessionRef): void {
    this.connectionPools.get(authority)?.remove(ref);
    ref.destroy();
  }

  private getPool(url: string): NodeHttp2ConnectionPool {
    if (!this.connectionPools.has(url)) {
      const pool = new NodeHttp2ConnectionPool();
      if (this.config.maxConcurrency) {
        pool.setMaxConcurrency(this.config.maxConcurrency);
      }
      this.connectionPools.set(url, pool);
    }
    return this.connectionPools.get(url)!;
  }

  private getUrlString(request: RequestContext): string {
    return request.destination.toString();
  }

  private connect(url: string): ClientHttp2Session {
    return this.connectOptions === undefined ? http2.connect(url) : http2.connect(url, this.connectOptions);
  }
}
