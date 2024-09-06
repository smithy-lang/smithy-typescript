import { EventEmitter } from "events";
import { ClientRequest } from "http";
import { Socket } from "net";

import { setSocketKeepAlive } from "./set-socket-keep-alive";

describe("setSocketKeepAlive", () => {
  let request: ClientRequest;
  let socket: Socket;

  beforeEach(() => {
    request = new EventEmitter() as ClientRequest;
    socket = new Socket();
  });

  it("should set keepAlive to true", () => {
    setSocketKeepAlive(request, { keepAlive: true }, 0);

    const setKeepAliveSpy = jest.spyOn(socket, "setKeepAlive");
    request.emit("socket", socket);

    expect(setKeepAliveSpy).toHaveBeenCalled();
    expect(setKeepAliveSpy).toHaveBeenCalledWith(true, 0);
  });

  it("should set keepAlive to true with custom initialDelay", () => {
    const initialDelay = 5 * 1000;
    setSocketKeepAlive(request, { keepAlive: true, keepAliveMsecs: initialDelay }, 0);

    const setKeepAliveSpy = jest.spyOn(socket, "setKeepAlive");
    request.emit("socket", socket);

    expect(setKeepAliveSpy).toHaveBeenCalled();
    expect(setKeepAliveSpy).toHaveBeenCalledWith(true, initialDelay);
  });

  it("should not set keepAlive at all when keepAlive is false", () => {
    setSocketKeepAlive(request, { keepAlive: false }, 0);

    const setKeepAliveSpy = jest.spyOn(socket, "setKeepAlive");
    request.emit("socket", socket);

    expect(setKeepAliveSpy).not.toHaveBeenCalled();
  });

  it("calls socket operations directly if socket is available", async () => {
    const request = {
      on: jest.fn(),
      socket: {
        setKeepAlive: jest.fn(),
      },
    } as any;
    setSocketKeepAlive(request, { keepAlive: true, keepAliveMsecs: 1000 }, 0);

    expect(request.socket.setKeepAlive).toHaveBeenCalled();
    expect(request.on).not.toHaveBeenCalled();
  });
});
