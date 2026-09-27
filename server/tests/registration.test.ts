import { beforeAll, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  registerAllTools,
  namesListedInRegisterTs,
  toolSourceFiles,
  readRepoFile,
  type RegistrationResult,
} from "./helpers/toolHarness.js";
// @ts-expect-error - plain .mjs module shared with generate-tool-schemas.mjs
import { formatToolSchemasTxt, formatToolSchemasJson } from "../tool-schema-format.mjs";

vi.mock("../src/utils/tokenLogger.js", () => ({ logTokenUsage: vi.fn() }));

const REGEN_HINT =
  "Regenerate with: cd server && node esbuild.config.mjs && node generate-tool-schemas.mjs " +
  "(do NOT use `npm run build` locally: it also deploys into the live Revit add-in folder).";

let reg: RegistrationResult;
let listedTools: any[];

beforeAll(async () => {
  reg = await registerAllTools();

  const client = new Client({ name: "registration-test", version: "test" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await reg.server.connect(serverTransport);
  await client.connect(clientTransport);
  listedTools = (await client.listTools()).tools;
  await client.close();
  await reg.server.close();
});

describe("tool registration against a real McpServer", () => {
  it("registerTools reports no registration errors or modules without a register function", () => {
    expect(reg.registrationErrors).toEqual([]);
  });

  it("registers every tool exactly once (no duplicate server.tool calls)", () => {
    const counts = new Map<string, number>();
    for (const n of reg.toolCalls) counts.set(n, (counts.get(n) ?? 0) + 1);
    const dupes = [...counts].filter(([, c]) => c > 1).map(([n]) => n);
    expect(dupes, `tools registered more than once: ${dupes.join(", ")}`).toEqual([]);
    expect(reg.tools.size).toBe(reg.toolCalls.length);
  });

  it("register.ts list has unique names and matches what actually registers", () => {
    const listed = namesListedInRegisterTs();
    expect(new Set(listed).size, "duplicate entry in register.ts").toBe(listed.length);
    expect([...reg.tools.keys()].sort()).toEqual([...listed].sort());
  });

  it("every src/tools/*.ts module is wired into register.ts (and vice versa)", () => {
    expect(toolSourceFiles().sort()).toEqual(namesListedInRegisterTs().sort());
  });

  it("tool names are snake_case and within MCP's 64-char limit", () => {
    for (const name of reg.tools.keys()) {
      expect(name, name).toMatch(/^[a-z][a-z0-9_]{0,63}$/);
    }
  });

  it("every tool has a non-empty description and an object input schema over tools/list", () => {
    expect(listedTools.length).toBe(reg.tools.size);
    for (const t of listedTools) {
      expect(t.description?.trim().length, `${t.name} has no description`).toBeGreaterThan(0);
      expect(t.inputSchema?.type, `${t.name} input schema`).toBe("object");
    }
  });
});

describe("generated schema files match the live registration (server <-> plugin drift)", () => {
  it("plugin/tool_schemas.json is up to date", () => {
    const committed = readRepoFile("plugin/tool_schemas.json");
    // Compare parsed JSON: key order inside zod-to-json-schema output (e.g. where
    // "$schema" lands for an empty shape) differs between module graphs and is
    // not meaningful drift.
    const generated = JSON.parse(formatToolSchemasJson(listedTools));
    const parsed = JSON.parse(committed);
    let equal = true;
    try {
      expect(parsed).toEqual(generated);
    } catch {
      equal = false;
    }
    if (!equal) {
      const committedNames = parsed.map((t: any) => t.name);
      const liveNames = listedTools.map((t) => t.name);
      const missing = liveNames.filter((n) => !committedNames.includes(n));
      const stale = committedNames.filter((n: string) => !liveNames.includes(n));
      expect.fail(
        `plugin/tool_schemas.json is out of date.\n` +
          `  tools missing from file: ${missing.join(", ") || "(none)"}\n` +
          `  tools only in file:      ${stale.join(", ") || "(none)"}\n` +
          `  (if both are empty a description or parameter changed)\n${REGEN_HINT}`
      );
    }
  });

  it("tool-schemas.txt is up to date", () => {
    const committed = readRepoFile("tool-schemas.txt");
    const generated: string = formatToolSchemasTxt(listedTools);
    if (committed !== generated) {
      const c = new Set(committed.trim().split("\n"));
      const g = new Set(generated.trim().split("\n"));
      const onlyLive = [...g].filter((l) => !c.has(l));
      const onlyFile = [...c].filter((l) => !g.has(l));
      expect.fail(
        `tool-schemas.txt is out of date.\n  live: ${onlyLive.join("\n        ")}\n  file: ${onlyFile.join("\n        ")}\n${REGEN_HINT}`
      );
    }
  });
});
