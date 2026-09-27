import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RevitClientConnection } from "../src/utils/SocketClient.js";
import { startFakeRevit, type FakeRevitServer, type RequestHandler } from "./helpers/fakeRevit.js";

let fake: FakeRevitServer | undefined;
let client: RevitClientConnection | undefined;

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(async () => {
  client?.disconnect();
  client = undefined;
  await fake?.close();
  fake = undefined;
  vi.restoreAllMocks();
});

async function connected(handler?: RequestHandler): Promise<RevitClientConnection> {
  fake = await startFakeRevit(handler);
  client = new RevitClientConnection("127.0.0.1", fake.port);
  await new Promise<void>((resolve, reject) => {
    client!.socket.once("connect", () => resolve());
    client!.socket.once("error", reject);
    client!.connect();
  });
  return client;
}

describe("RevitClientConnection framing", () => {
  it("sends one newline-terminated JSON-RPC 2.0 request with a unique id", async () => {
    const c = await connected();
    const result = await c.sendCommand("create_level", { data: [{ name: "L2", elevation: 3000 }] });

    expect(result).toEqual({ echo: "create_level", params: { data: [{ name: "L2", elevation: 3000 }] } });
    const raw = fake!.received[0];
    expect(raw.endsWith("\n")).toBe(true);
    expect(raw.split("\n").filter(Boolean)).toHaveLength(1);
    const req = JSON.parse(raw);
    expect(req).toMatchObject({ jsonrpc: "2.0", method: "create_level" });
    expect(req.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("defaults params to {}", async () => {
    const c = await connected();
    await c.sendCommand("get_project_info");
    expect(fake!.requests[0].params).toEqual({});
  });

  it("reassembles a response split across several TCP chunks", async () => {
    const c = await connected((req, socket) => {
      const line = JSON.stringify({ jsonrpc: "2.0", id: req.id, result: { big: "x".repeat(50_000) } }) + "\n";
      const third = Math.floor(line.length / 3);
      socket.write(line.slice(0, third));
      setTimeout(() => socket.write(line.slice(third, 2 * third)), 10);
      setTimeout(() => socket.write(line.slice(2 * third)), 20);
    });
    const result = await c.sendCommand("big", {});
    expect(result.big).toHaveLength(50_000);
  });

  it("matches out-of-order responses (several in one chunk) to their requests by id", async () => {
    const pending: Array<{ id: string; method: string }> = [];
    const c = await connected((req, socket) => {
      pending.push({ id: req.id, method: req.method });
      if (pending.length === 3) {
        const lines = pending
          .reverse()
          .map((p) => JSON.stringify({ jsonrpc: "2.0", id: p.id, result: p.method }) + "\n")
          .join("");
        socket.write(lines); // one write, reversed order
      }
    });
    const results = await Promise.all([c.sendCommand("a"), c.sendCommand("b"), c.sendCommand("c")]);
    expect(results).toEqual(["a", "b", "c"]);
  });

  it("ignores blank lines, malformed lines and responses for unknown ids", async () => {
    const c = await connected((req, socket) => {
      socket.write("\n   \nnot json at all\n");
      socket.write(JSON.stringify({ jsonrpc: "2.0", id: "someone-else", result: "wrong" }) + "\n");
      socket.write(JSON.stringify({ jsonrpc: "2.0", id: req.id, result: "right" }) + "\n");
    });
    await expect(c.sendCommand("x")).resolves.toBe("right");
  });

  it("rejects with the plugin's error message for a JSON-RPC error response", async () => {
    const c = await connected((req, socket) => {
      socket.write(JSON.stringify({ jsonrpc: "2.0", id: req.id, error: { code: -32000, message: "Element 42 not found" } }) + "\n");
    });
    await expect(c.sendCommand("delete_element", { elementIds: ["42"] })).rejects.toThrow("Element 42 not found");
  });

  it("rejects with a generic message when the error has no message", async () => {
    const c = await connected((req, socket) => {
      socket.write(JSON.stringify({ jsonrpc: "2.0", id: req.id, error: {} }) + "\n");
    });
    await expect(c.sendCommand("x")).rejects.toThrow("Unknown error from Revit");
  });
});

describe("RevitClientConnection failure modes", () => {
  it("times out a command that never gets a response and drops the socket", async () => {
    const c = await connected(() => {
      /* never answer */
    });
    const started = Date.now();
    await expect(c.sendCommand("slow_command", {}, 150)).rejects.toThrow(/Command 'slow_command' timed out/);
    expect(Date.now() - started).toBeGreaterThanOrEqual(140);
    await vi.waitFor(() => expect(c.socket.destroyed).toBe(true));
  });

  it("uses defaultTimeout when no per-call timeout is given", async () => {
    const c = await connected(() => {});
    c.defaultTimeout = 100;
    await expect(c.sendCommand("slow_command")).rejects.toThrow(/timed out/);
  });

  it("rejects pending commands when the server closes the connection", async () => {
    const c = await connected((_req, socket) => socket.destroy());
    await expect(c.sendCommand("x")).rejects.toThrow("Socket closed");
  });

  it("rejects pending commands when the client disconnects", async () => {
    const c = await connected(() => {});
    const p = c.sendCommand("x");
    c.disconnect();
    await expect(p).rejects.toThrow(/Disconnected from Revit|Socket closed/);
    expect(c.isConnected).toBe(false);
  });
});
