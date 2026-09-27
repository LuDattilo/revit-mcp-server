/**
 * Table-driven contract tests for every registered MCP tool, without Revit.
 *
 * withRevitConnection is replaced by a fake that hands each handler a fake client
 * recording sendCommand(method, params). For each tool we check:
 *   1. a fixture exists (tests/fixtures/toolFixtures.ts) - new tools fail loudly here;
 *   2. schema-generated inputs (all fields / required-only) are accepted, the handler
 *      sends exactly one command with the expected name, the command exists in the
 *      plugin's command.json, and every input field reaches the params;
 *   3. invalid inputs (missing required fields, wrong types) are rejected by the
 *      schema through a real MCP client, and never reach Revit;
 *   4. Revit errors, connection failures and odd responses produce an MCP error
 *      result (isError) instead of a rejected promise.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { withRevitConnection } from "../src/utils/ConnectionManager.js";
import { getDatabase } from "../src/database/db.js";
import { storeProject } from "../src/database/service.js";
import {
  registerAllTools,
  commandJsonNames,
  commandSetCommandNames,
  type RegisteredToolInfo,
} from "./helpers/toolHarness.js";
import { sampleShape, isOptional, wrongValueFor } from "./helpers/zodSample.js";
import { TOOL_FIXTURES, CLIENT_SIDE_FIELDS, type ToolFixture } from "./fixtures/toolFixtures.js";

vi.mock("../src/utils/ConnectionManager.js", () => ({ withRevitConnection: vi.fn() }));
vi.mock("../src/utils/tokenLogger.js", () => ({ logTokenUsage: vi.fn() }));

interface SentCommand {
  method: string;
  params: any;
  timeoutMs: number | undefined;
}

type FakeBehaviour =
  | { kind: "respond"; value: unknown }
  | { kind: "revit-error"; message: string }
  | { kind: "connect-fail"; message: string };

let sent: SentCommand[] = [];
let behaviour: FakeBehaviour = { kind: "respond", value: { success: true } };

function installFake() {
  vi.mocked(withRevitConnection).mockImplementation(async (operation: any, timeoutMs?: number) => {
    if (behaviour.kind === "connect-fail") throw new Error(behaviour.message);
    const fakeClient = {
      sendCommand: async (method: string, params: any = {}) => {
        // Snapshot params so later mutation by the handler cannot mask a bug.
        sent.push({ method, params: structuredClone(params), timeoutMs });
        if (behaviour.kind === "revit-error") throw new Error(behaviour.message);
        return behaviour.kind === "respond" ? structuredClone(behaviour.value) : undefined;
      },
    };
    return operation(fakeClient);
  });
}

const reg = await registerAllTools();
const toolNames = [...reg.tools.keys()].sort();
const pluginCommands = new Set(commandJsonNames());
let client: Client;

beforeAll(async () => {
  await getDatabase(); // local sql.js tools need an initialised store (temp HOME, see setup.ts)
  // store_room_data requires its project to exist; seed the one its generated input names
  // so the result does not depend on store_project_data having run first.
  const roomTool = reg.tools.get("store_room_data");
  if (roomTool) {
    const { project_name } = sampleShape(shapeOf(roomTool), "min") as { project_name?: string };
    if (project_name) storeProject({ project_name });
  }
  client = new Client({ name: "contract-test", version: "test" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await reg.server.connect(serverTransport);
  await client.connect(clientTransport);
});

afterAll(async () => {
  await client?.close();
  await reg.server.close();
});

beforeEach(() => {
  sent = [];
  behaviour = { kind: "respond", value: { success: true } };
  installFake();
});

function fixtureFor(name: string): ToolFixture {
  const f = TOOL_FIXTURES[name];
  if (!f) {
    throw new Error(
      `No contract fixture for tool '${name}'. Add \`${name}: {},\` to ` +
        `server/tests/fixtures/toolFixtures.ts (plus command/renamed/notForwarded ` +
        `if the handler deviates from the defaults).`
    );
  }
  return f;
}

function shapeOf(tool: RegisteredToolInfo): Record<string, any> {
  return tool.inputSchema?.shape ?? {};
}

async function invoke(tool: RegisteredToolInfo, input: Record<string, unknown>) {
  const parsed = tool.inputSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(
      `Generated input for '${tool.name}' does not satisfy its own schema: ` +
        `${JSON.stringify(parsed.error.issues)}. Provide \`input\` in its fixture.`
    );
  }
  const result = await tool.handler(parsed.data, {});
  return { args: parsed.data as Record<string, unknown>, result };
}

function expectMcpResult(result: any) {
  expect(result, "handler must return a CallToolResult").toBeTypeOf("object");
  expect(Array.isArray(result.content)).toBe(true);
  expect(result.content.length).toBeGreaterThan(0);
  expect(result.content[0].type).toBe("text");
  expect(typeof result.content[0].text).toBe("string");
}

/** Every top-level input field must reach the params (under its own or renamed key). */
function expectPassThrough(name: string, fixture: ToolFixture, args: Record<string, unknown>, params: any) {
  const skip = new Set([...(fixture.notForwarded ?? []), ...CLIENT_SIDE_FIELDS]);
  const missing: string[] = [];
  for (const [key, value] of Object.entries(args)) {
    if (skip.has(key) || value === undefined) continue;
    const target = fixture.renamed?.[key] ?? key;
    if (!containsKeyWithValue(params, target, value)) missing.push(key);
  }
  expect(
    missing,
    `${name}: input fields not forwarded to Revit params: ${missing.join(", ")}. ` +
      `If intentional, list them in the fixture's notForwarded/renamed.`
  ).toEqual([]);
}

function containsKeyWithValue(obj: any, key: string, value: unknown): boolean {
  if (obj === null || typeof obj !== "object") return false;
  if (!Array.isArray(obj) && key in obj && JSON.stringify(obj[key]) === JSON.stringify(value)) return true;
  return Object.values(obj).some((v) => containsKeyWithValue(v, key, value));
}

describe("fixture table", () => {
  it("has an entry for every registered tool", () => {
    const missing = toolNames.filter((n) => !(n in TOOL_FIXTURES));
    expect(
      missing,
      `Tools without a contract fixture (add \`name: {},\` to tests/fixtures/toolFixtures.ts): ${missing.join(", ")}`
    ).toEqual([]);
  });

  it("has no entries for tools that no longer exist", () => {
    const stale = Object.keys(TOOL_FIXTURES).filter((n) => !reg.tools.has(n));
    expect(stale, `Stale fixtures: ${stale.join(", ")}`).toEqual([]);
  });

  it("declares only commands that the Revit plugin's command.json registers", () => {
    const unknown = toolNames
      .map((n) => [n, TOOL_FIXTURES[n]] as const)
      .filter(([, f]) => f && !f.local)
      .map(([n, f]) => f!.command ?? n)
      .filter((cmd) => !pluginCommands.has(cmd));
    expect(unknown, `commands missing from command.json: ${unknown.join(", ")}`).toEqual([]);
  });

  it("command.json matches the CommandName of the C# commands in commandset/", () => {
    const implemented = new Set(commandSetCommandNames());
    const notImplemented = [...pluginCommands].filter((c) => !implemented.has(c));
    const notListed = [...implemented].filter((c) => !pluginCommands.has(c));
    expect(notImplemented, `command.json entries with no C# command: ${notImplemented.join(", ")}`).toEqual([]);
    expect(notListed, `C# commands missing from command.json: ${notListed.join(", ")}`).toEqual([]);
  });

  it("every command in command.json is reachable from some MCP tool", () => {
    // Commands the plugin registers on purpose without a Node tool go here.
    const PLUGIN_ONLY_COMMANDS: string[] = [];
    const used = new Set(
      toolNames.filter((n) => TOOL_FIXTURES[n] && !TOOL_FIXTURES[n].local).map((n) => TOOL_FIXTURES[n].command ?? n)
    );
    const orphans = [...pluginCommands].filter((c) => !used.has(c) && !PLUGIN_ONLY_COMMANDS.includes(c));
    expect(orphans, `command.json commands no tool sends: ${orphans.join(", ")}`).toEqual([]);
  });
});

describe.each(toolNames)("tool %s", (name) => {
  const tool = reg.tools.get(name)!;

  it("sends the expected command with all fields passed through (all fields populated)", async () => {
    const fixture = fixtureFor(name);
    const input = fixture.input ?? sampleShape(shapeOf(tool), "full");
    const { args, result } = await invoke(tool, input);
    expectMcpResult(result);

    if (fixture.local) {
      expect(sent, `${name} is local but called Revit`).toEqual([]);
      expect(result.isError, result.content[0].text).toBeFalsy();
      return;
    }

    expect(result.isError, result.content[0].text).toBeFalsy();
    expect(sent.map((s) => s.method)).toEqual([fixture.command ?? name]);
    const [{ params, timeoutMs }] = sent;
    expect(params).toBeTypeOf("object");
    expectPassThrough(name, fixture, args, params);
    if (fixture.fixedParams) expect(params).toMatchObject(fixture.fixedParams);
    if (timeoutMs !== undefined) {
      expect(timeoutMs).toBeGreaterThan(0);
      expect(timeoutMs).toBeLessThanOrEqual(fixture.maxTimeoutMs ?? 10 * 60 * 1000);
    }
  });

  it("accepts the minimal (required-only) input", async () => {
    const fixture = fixtureFor(name);
    const { args, result } = await invoke(tool, sampleShape(shapeOf(tool), "min"));
    expectMcpResult(result);
    expect(result.isError, result.content[0].text).toBeFalsy();
    if (fixture.local) return;
    expect(sent.map((s) => s.method)).toEqual([fixture.command ?? name]);
    expectPassThrough(name, fixture, args, sent[0].params);
    if (fixture.fixedParams) expect(sent[0].params).toMatchObject(fixture.fixedParams);
  });

  it("rejects invalid input through the MCP protocol without reaching Revit", async () => {
    fixtureFor(name);
    const shape = shapeOf(tool);
    const valid = sampleShape(shape, "full");
    const cases: Array<[string, Record<string, unknown>]> = [];

    const required = Object.entries(shape).filter(([, s]) => !isOptional(s as any));
    if (required.length > 0) cases.push(["all arguments missing", {}]);
    for (const [key, s] of Object.entries(shape)) {
      const wrong = wrongValueFor(s as any);
      if (wrong !== undefined) cases.push([`${key}=${JSON.stringify(wrong)}`, { ...valid, [key]: wrong }]);
    }

    for (const [label, args] of cases) {
      const result: any = await client.callTool({ name, arguments: args });
      expect(result.isError, `${name} accepted invalid input (${label})`).toBe(true);
      expect(result.content[0].text, label).toMatch(/Input validation error/);
    }
    expect(sent, `${name} reached Revit with invalid input`).toEqual([]);
  });

  it("turns a Revit command error into an MCP error result", async () => {
    const fixture = fixtureFor(name);
    if (fixture.local) return;
    behaviour = { kind: "revit-error", message: "boom-from-revit" };
    const { result } = await invoke(tool, fixture.input ?? sampleShape(shapeOf(tool), "full"));
    expectMcpResult(result);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("boom-from-revit");
  });

  it("turns a connection failure into an MCP error result", async () => {
    const fixture = fixtureFor(name);
    if (fixture.local) return;
    behaviour = { kind: "connect-fail", message: "Connect to Revit client failed" };
    const { result } = await invoke(tool, fixture.input ?? sampleShape(shapeOf(tool), "min"));
    expectMcpResult(result);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Connect to Revit client failed");
  });

  it.each([
    ["null", null],
    ["no result at all (undefined)", undefined],
    ["a bare string", "plain text"],
    ["an empty object", {}],
    ["an unexpected array", [1, 2, 3]],
  ])("returns a result (never throws) when Revit responds with %s", async (_label, value) => {
    const fixture = fixtureFor(name);
    behaviour = { kind: "respond", value };
    const { result } = await invoke(tool, fixture.input ?? sampleShape(shapeOf(tool), "min"));
    expectMcpResult(result);
  });
});
