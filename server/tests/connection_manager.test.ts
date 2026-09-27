import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { readPortFromFile, withRevitConnection } from "../src/utils/ConnectionManager.js";
import { startFakeRevit, unusedPort, type FakeRevitServer } from "./helpers/fakeRevit.js";

const appData = process.env.APPDATA!; // temp dir, see tests/setup.ts
const addins = join(appData, "Autodesk", "Revit", "Addins");

function writePortFile(year: string, content: string) {
  const dir = join(addins, year, "revit_mcp_plugin");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "mcp-port.txt"), content);
}

let fake: FakeRevitServer | undefined;

beforeEach(() => {
  rmSync(addins, { recursive: true, force: true });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  await fake?.close();
  fake = undefined;
});

describe("port discovery (readPortFromFile)", () => {
  it("falls back to 8080 when no plugin has written mcp-port.txt", () => {
    expect(readPortFromFile()).toBe(8080);
  });

  it("reads the port the plugin slid to (8080 busy -> 8081..8089)", () => {
    writePortFile("2027", "8083");
    expect(readPortFromFile()).toBe(8083);
  });

  it("tolerates whitespace / trailing newline", () => {
    writePortFile("2027", "  8081\r\n");
    expect(readPortFromFile()).toBe(8081);
  });

  it("scans newest Revit year first", () => {
    writePortFile("2025", "8085");
    writePortFile("2027", "8087");
    expect(readPortFromFile()).toBe(8087);
  });

  it("skips files outside the plugin's 8080-8089 range or unparseable, trying older years", () => {
    writePortFile("2027", "9999");
    writePortFile("2026", "garbage");
    writePortFile("2025", "8082");
    expect(readPortFromFile()).toBe(8082);
  });

  it("returns 8080 when every port file is invalid", () => {
    writePortFile("2027", "80");
    expect(readPortFromFile()).toBe(8080);
  });

  it("REVIT_MCP_PORT overrides the port file", () => {
    writePortFile("2027", "8083");
    vi.stubEnv("REVIT_MCP_PORT", "54321");
    expect(readPortFromFile()).toBe(54321);
  });

  it("ignores an invalid REVIT_MCP_PORT", () => {
    writePortFile("2027", "8084");
    vi.stubEnv("REVIT_MCP_PORT", "not-a-port");
    expect(readPortFromFile()).toBe(8084);
    vi.stubEnv("REVIT_MCP_PORT", "70000");
    expect(readPortFromFile()).toBe(8084);
  });
});

describe("withRevitConnection against a fake plugin socket", () => {
  it("round-trips a command and closes the connection afterwards", async () => {
    fake = await startFakeRevit();
    vi.stubEnv("REVIT_MCP_PORT", String(fake.port));

    const result = await withRevitConnection((c) => c.sendCommand("get_project_info", { includeLevels: true }));

    expect(result).toEqual({ echo: "get_project_info", params: { includeLevels: true } });
    expect(fake.connectionCount).toBe(1);
    await vi.waitFor(() => expect(fake!.maxConcurrentConnections).toBe(1));
  });

  it("follows mcp-port.txt to the port the plugin slid to", async () => {
    // Mirror SocketService.FindAvailablePort: first free port in 8080-8089.
    for (let p = 8080; p <= 8089 && !fake; p++) {
      try {
        fake = await startFakeRevit(undefined, p);
      } catch {
        /* busy (e.g. a real Revit on 8080) - slide to the next one */
      }
    }
    if (!fake) return expect.soft(fake, "no free port in 8080-8089 on this machine").toBeDefined();
    writePortFile("2027", String(fake.port));

    const result = await withRevitConnection((c) => c.sendCommand("say_hello", {}));

    expect(result.echo).toBe("say_hello");
    expect(fake.connectionCount).toBe(1);
  });

  it("uses the caller's timeout for commands and does not retry a command timeout", async () => {
    fake = await startFakeRevit(() => {
      /* never answer */
    });
    vi.stubEnv("REVIT_MCP_PORT", String(fake.port));

    await expect(withRevitConnection((c) => c.sendCommand("export_ifc", {}), 200)).rejects.toThrow(
      /Command 'export_ifc' timed out/
    );
    expect(fake.connectionCount).toBe(1);
  });

  it("propagates a Revit error without retrying", async () => {
    fake = await startFakeRevit((req, socket) => {
      socket.write(JSON.stringify({ jsonrpc: "2.0", id: req.id, error: { message: "No active document" } }) + "\n");
    });
    vi.stubEnv("REVIT_MCP_PORT", String(fake.port));

    await expect(withRevitConnection((c) => c.sendCommand("get_warnings", {}))).rejects.toThrow("No active document");
    expect(fake.connectionCount).toBe(1);
  });

  it("retries a refused connection with backoff, then reports it", async () => {
    vi.stubEnv("REVIT_MCP_PORT", String(await unusedPort()));
    const started = Date.now();

    await expect(withRevitConnection((c) => c.sendCommand("x", {}))).rejects.toThrow("Connect to Revit client failed");
    // 3 attempts separated by 1 s + 2 s of backoff.
    expect(Date.now() - started).toBeGreaterThanOrEqual(2900);
  });

  it("succeeds when Revit starts listening during the retry backoff", async () => {
    const port = await unusedPort();
    vi.stubEnv("REVIT_MCP_PORT", String(port));
    setTimeout(async () => {
      fake = await startFakeRevit(undefined, port);
    }, 300);

    const result = await withRevitConnection((c) => c.sendCommand("say_hello", {}));
    expect(result.echo).toBe("say_hello");
  });

  it("serialises concurrent calls: one connection at a time, each answered correctly", async () => {
    fake = await startFakeRevit((req, socket) => {
      // Answer slowly so overlapping connections would be observable.
      setTimeout(() => {
        socket.write(JSON.stringify({ jsonrpc: "2.0", id: req.id, result: req.params.n }) + "\n");
      }, 30);
    });
    vi.stubEnv("REVIT_MCP_PORT", String(fake.port));

    const results = await Promise.all(
      [1, 2, 3, 4, 5].map((n) => withRevitConnection((c) => c.sendCommand("n", { n })))
    );

    expect(results).toEqual([1, 2, 3, 4, 5]);
    expect(fake.connectionCount).toBe(5);
    expect(fake.maxConcurrentConnections).toBe(1);
    expect(fake.requests.map((r) => r.params.n)).toEqual([1, 2, 3, 4, 5]);
  });

  it("releases the mutex after a failure so later calls still run", async () => {
    fake = await startFakeRevit();
    vi.stubEnv("REVIT_MCP_PORT", String(fake.port));

    await expect(
      withRevitConnection(async () => {
        throw new Error("operation blew up");
      })
    ).rejects.toThrow("operation blew up");
    await expect(withRevitConnection((c) => c.sendCommand("after", {}))).resolves.toMatchObject({ echo: "after" });
  });

  it("does not leave the 5 s connect-timeout timer running after a successful call", async () => {
    fake = await startFakeRevit();
    vi.stubEnv("REVIT_MCP_PORT", String(fake.port));
    const timers = () => process.getActiveResourcesInfo().filter((r) => r === "Timeout").length;

    const before = timers();
    await withRevitConnection((c) => c.sendCommand("x", {}));
    expect(timers()).toBeLessThanOrEqual(before);
  });
});

