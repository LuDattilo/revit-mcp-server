import { RevitClientConnection } from "./SocketClient.js";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

// Mutex to serialize all Revit connections - prevents race conditions
// when multiple requests are made in parallel
let connectionMutex: Promise<void> = Promise.resolve();

const MAX_RETRIES = 3;
const BACKOFF_MS = [1000, 2000, 4000];
const CONNECT_TIMEOUT_MS = 5000;

/**
 * Resolve the port of the Revit plugin's socket service.
 *
 * REVIT_MCP_PORT (any valid TCP port) wins when set - useful when the plugin runs
 * on a non-default port and for tests against a fake server. Otherwise read the
 * plugin's mcp-port.txt (the plugin binds the first free port in 8080-8089 and
 * writes it there), scanning Revit Addins folders from newest to oldest year.
 * Falls back to 8080 if no valid port file is found.
 */
export function readPortFromFile(): number {
  const override = process.env.REVIT_MCP_PORT?.trim();
  if (override) {
    const port = Number(override);
    if (Number.isInteger(port) && port > 0 && port <= 65535) return port;
  }

  const appData = process.env.APPDATA || "";
  const years = ["2027", "2026", "2025", "2024", "2023"];
  for (const year of years) {
    const portFile = join(appData, "Autodesk", "Revit", "Addins", year, "revit_mcp_plugin", "mcp-port.txt");
    if (existsSync(portFile)) {
      try {
        const port = parseInt(readFileSync(portFile, "utf-8").trim(), 10);
        if (port >= 8080 && port <= 8089) return port;
      } catch { /* ignore, try next */ }
    }
  }
  return 8080;
}

/**
 * Attempt a single connection to Revit and execute the operation.
 * Throws on connection failure or command error.
 */
async function attemptConnection<T>(
  port: number,
  operation: (client: RevitClientConnection) => Promise<T>,
  timeoutMs: number
): Promise<T> {
  const revitClient = new RevitClientConnection("localhost", port);
  revitClient.defaultTimeout = timeoutMs;

  try {
    // Connect to Revit client
    if (!revitClient.isConnected) {
      await new Promise<void>((resolve, reject) => {
        // Cleared on every outcome: previously the 5 s timer was left running
        // after a successful connect, holding the event loop open for 5 s.
        let connectTimer: ReturnType<typeof setTimeout> | undefined;
        const settle = () => {
          clearTimeout(connectTimer);
          revitClient.socket.removeListener("connect", onConnect);
          revitClient.socket.removeListener("error", onError);
        };

        const onConnect = () => {
          settle();
          resolve();
        };

        const onError = (error: any) => {
          settle();
          reject(new Error("Connect to Revit client failed"));
        };

        revitClient.socket.on("connect", onConnect);
        revitClient.socket.on("error", onError);

        revitClient.connect();

        connectTimer = setTimeout(() => {
          settle();
          reject(new Error("Connection to Revit client timed out"));
        }, CONNECT_TIMEOUT_MS);
      });
    }

    // Execute operation
    return await operation(revitClient);
  } finally {
    // Disconnect
    revitClient.disconnect();
  }
}

/**
 * Connect to the Revit client and execute an operation.
 * Retries on connection failure with exponential backoff.
 * Does NOT retry on command timeout (the command already ran for the full duration).
 * @param operation Function to execute once connected
 * @param timeoutMs Command timeout in milliseconds (default 120000 = 2 min)
 * @returns The operation result
 */
export async function withRevitConnection<T>(
  operation: (client: RevitClientConnection) => Promise<T>,
  timeoutMs: number = 120000
): Promise<T> {
  // Wait for any pending connection to complete before starting a new one
  const previousMutex = connectionMutex;
  let releaseMutex: () => void;
  connectionMutex = new Promise<void>((resolve) => {
    releaseMutex = resolve;
  });
  await previousMutex;

  const port = readPortFromFile();

  try {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        return await attemptConnection(port, operation, timeoutMs);
      } catch (error: any) {
        const msg = error?.message || "";
        const isConnectionError =
          msg.includes("Connect to Revit client failed") ||
          msg.includes("Connection to Revit client timed out");

        // Only retry on connection failures, not on command timeouts or other errors
        if (!isConnectionError || attempt >= MAX_RETRIES - 1) {
          throw error;
        }

        // Wait with backoff before retrying
        await new Promise<void>((resolve) =>
          setTimeout(resolve, BACKOFF_MS[attempt])
        );
      }
    }

    // Should never reach here, but just in case
    throw new Error(
      "Cannot connect to Revit after 3 attempts. Make sure Revit is open and MCP Switch is active (green indicator)."
    );
  } finally {
    // Release the mutex so the next request can proceed
    releaseMutex!();
  }
}
