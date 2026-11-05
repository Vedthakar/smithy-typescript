import http, { type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { HttpRequest } from "@smithy/core/protocols";
import { isTransientError } from "@smithy/core/retry";
import { afterEach, beforeEach, describe, expect, test as it } from "vitest";

import { NodeHttpHandler } from "./node-http-handler";

describe("NodeHttpHandler destroy()", () => {
  let server: Server;
  let hits: number;
  let held: ServerResponse[];
  let hold: boolean;

  const request = () =>
    new HttpRequest({
      hostname: "127.0.0.1",
      method: "GET",
      port: (server.address() as AddressInfo).port,
      protocol: "http:",
      path: "/",
      headers: {},
    });

  beforeEach(async () => {
    hits = 0;
    held = [];
    hold = true;
    server = http.createServer((_req: IncomingMessage, res: ServerResponse) => {
      hits += 1;
      if (hold) {
        held.push(res); // hold the response open, like a long poll.
        return;
      }
      res.writeHead(200);
      res.end("ok");
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  });

  afterEach(async () => {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  });

  it("rejects an in-flight request with a non-transient error", async () => {
    const handler = new NodeHttpHandler();
    const pending = handler.handle(request());
    while (hits === 0) {
      await new Promise((r) => setTimeout(r, 10));
    }

    handler.destroy();

    const error = await pending.catch((e) => e);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("AbortError");
    expect(isTransientError(error)).toBe(false);
    expect(hits).toBe(1);
  });

  it("can still be used after destroy()", async () => {
    const handler = new NodeHttpHandler();
    handler.destroy();
    hold = false;

    const { response } = await handler.handle(request());
    expect(response.statusCode).toBe(200);
    expect(hits).toBe(1);
    handler.destroy();
  });

  it("resolves a request whose response arrived before destroy()", async () => {
    hold = false;
    const handler = new NodeHttpHandler();
    const pending = handler.handle(request());
    const { response } = await pending;

    handler.destroy();

    await expect(pending).resolves.toBeDefined();
    expect(response.statusCode).toBe(200);
  });

  it("keeps working for another client that shares the handler", async () => {
    const shared = new NodeHttpHandler();
    const first = shared.handle(request());
    while (hits === 0) {
      await new Promise((r) => setTimeout(r, 10));
    }

    // one client is destroyed while its request is in flight.
    shared.destroy();
    const error = await first.catch((e) => e);
    expect(error.name).toBe("AbortError");

    // the other client's later requests still succeed.
    hold = false;
    const { response } = await shared.handle(request());
    expect(response.statusCode).toBe(200);
    expect(hits).toBe(2);
    shared.destroy();
  });

  it("still surfaces an ordinary ECONNRESET as transient", async () => {
    const handler = new NodeHttpHandler();
    const pending = handler.handle(request());
    while (hits === 0) {
      await new Promise((r) => setTimeout(r, 10));
    }

    server.closeAllConnections();

    const error = await pending.catch((e) => e);
    expect(error.code).toBe("ECONNRESET");
    expect(isTransientError(error)).toBe(true);
    handler.destroy();
  });
});
