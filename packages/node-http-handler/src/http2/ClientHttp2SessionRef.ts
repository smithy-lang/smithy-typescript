import type { ClientHttp2Session } from "node:http2";

const ids = new Uint16Array(1);

/**
 * Shared access ref counter for ClientHttp2Session, where owners are
 * in-flight requests.
 *
 * @internal
 * @since 4.6.0
 */
export class ClientHttp2SessionRef {
  // debug information
  public readonly id = ids[0]++;
  /**
   * Total calls to retain for this session.
   */
  public total = 0;
  /**
   * Max ref count observed.
   */
  public max = 0;

  private readonly session: ClientHttp2Session;
  private refs = 0;

  public constructor(session: ClientHttp2Session) {
    // The session starts in unref state.
    // The start of the request (call to retain) will bring it into ref state.
    session.unref();
    this.session = session;
  }

  /**
   * Signal that the session is entering a request span and has an additional owning request.
   * This must be called when beginning a request using the session.
   */
  public retain(): void {
    if (this.session.destroyed) {
      throw new Error("@smithy/node-http-handler - cannot acquire reference to destroyed session.");
    }
    this.refs += 1;
    this.total += 1;

    this.max = Math.max(this.refs, this.max);
    this.session.ref();
  }

  /**
   * Release reference to session, to be called when it exits request span, indicating one fewer owning request.
   * When reaching zero, the session is unref'd.
   * This must be called when concluding a request using the session.
   */
  public free(): void {
    if (this.session.destroyed) {
      return;
    }
    this.refs -= 1;
    if (this.refs === 0) {
      this.session.unref();
    }
    if (this.refs < 0) {
      throw new Error("@smithy/node-http-handler - ClientHttp2Session refcount at zero, cannot decrement.");
    }
  }

  /**
   * Access the session (don't call ref/unref on it).
   */
  public deref(): ClientHttp2Session {
    return this.session;
  }

  /**
   * Allow open refs to free on their own.
   */
  public close(): void {
    if (!this.session.closed) {
      this.session.close();
    }
  }

  public destroy(): void {
    this.refs = 0;
    if (!this.session.destroyed) {
      this.session.destroy();
    }
  }

  /**
   * @returns the current number of active references (in-flight requests).
   */
  public useCount(): number {
    return this.refs;
  }
}
