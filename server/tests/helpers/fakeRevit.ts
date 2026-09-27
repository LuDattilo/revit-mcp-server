import * as net from "net";

export interface FakeRequest {
  jsonrpc: string;
  method: string;
  params: any;
  id: string;
}

export interface FakeRevitServer {
  port: number;
  /** Raw bytes received, per connection, in arrival order. */
  received: string[];
  requests: FakeRequest[];
  connectionCount: number;
  maxConcurrentConnections: number;
  close(): Promise<void>;
}

export type RequestHandler = (req: FakeRequest, socket: net.Socket) => void;

/** Replies `{ jsonrpc, id, result: { echo: method, params } }` on one line. */
export const echoHandler: RequestHandler = (req, socket) => {
  socket.write(JSON.stringify({ jsonrpc: "2.0", id: req.id, result: { echo: req.method, params: req.params } }) + "\n");
};

/**
 * A stand-in for the plugin's SocketService: newline-delimited JSON-RPC over TCP
 * on the loopback interface. Listens on `port` (0 = ephemeral).
 */
export async function startFakeRevit(handler: RequestHandler = echoHandler, port = 0): Promise<FakeRevitServer> {
  const sockets = new Set<net.Socket>();
  let open = 0;
  const state: FakeRevitServer = {
    port: 0,
    received: [],
    requests: [],
    connectionCount: 0,
    maxConcurrentConnections: 0,
    close: async () => {
      for (const s of sockets) s.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };

  const server = net.createServer((socket) => {
    sockets.add(socket);
    state.connectionCount++;
    open++;
    state.maxConcurrentConnections = Math.max(state.maxConcurrentConnections, open);
    let buffer = "";
    const index = state.received.push("") - 1;
    socket.on("data", (chunk) => {
      const text = chunk.toString();
      state.received[index] += text;
      buffer += text;
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        if (!line.trim()) continue;
        const req = JSON.parse(line) as FakeRequest;
        state.requests.push(req);
        handler(req, socket);
      }
    });
    socket.on("error", () => {});
    socket.on("close", () => {
      open--;
      sockets.delete(socket);
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve());
  });
  state.port = (server.address() as net.AddressInfo).port;
  return state;
}

/** A port that nothing is listening on (bound once, then released). */
export async function unusedPort(): Promise<number> {
  const s = net.createServer();
  await new Promise<void>((resolve) => s.listen(0, "127.0.0.1", () => resolve()));
  const port = (s.address() as net.AddressInfo).port;
  await new Promise<void>((resolve) => s.close(() => resolve()));
  return port;
}
