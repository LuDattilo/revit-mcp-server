import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "../../src/tools/register.js";

const here = dirname(fileURLToPath(import.meta.url));
export const SERVER_DIR = join(here, "..", "..");
export const REPO_DIR = join(SERVER_DIR, "..");
export const TOOLS_DIR = join(SERVER_DIR, "src", "tools");

export interface RegisteredToolInfo {
  name: string;
  inputSchema: any;
  handler: (args: any, extra: any) => Promise<any>;
}

export interface RegistrationResult {
  server: McpServer;
  /** Every name passed to server.tool / registerTool, in call order (duplicates kept). */
  toolCalls: string[];
  /** console.error lines emitted by registerTools that indicate a failure. */
  registrationErrors: string[];
  tools: Map<string, RegisteredToolInfo>;
}

/**
 * Creates a real McpServer, spies on every tool registration, and runs the
 * production registerTools() against it.
 */
export async function registerAllTools(): Promise<RegistrationResult> {
  const server = new McpServer({ name: "revit-mcp-test", version: "test" });
  const toolCalls: string[] = [];
  const registrationErrors: string[] = [];

  const originalTool = server.tool.bind(server) as (...a: any[]) => any;
  (server as any).tool = (...args: any[]) => {
    toolCalls.push(args[0]);
    return originalTool(...args);
  };
  const originalRegisterTool = server.registerTool.bind(server) as (...a: any[]) => any;
  (server as any).registerTool = (...args: any[]) => {
    toolCalls.push(args[0]);
    return originalRegisterTool(...args);
  };

  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    const line = args.map((a) => (a instanceof Error ? a.message : String(a))).join(" ");
    if (/^(Error registering tool|Warning: no register function)/.test(line)) {
      registrationErrors.push(line);
    }
  };
  try {
    await registerTools(server);
  } finally {
    console.error = originalConsoleError;
  }

  const tools = new Map<string, RegisteredToolInfo>();
  for (const [name, t] of Object.entries((server as any)._registeredTools as Record<string, any>)) {
    tools.set(name, { name, inputSchema: t.inputSchema, handler: t.handler });
  }
  return { server, toolCalls, registrationErrors, tools };
}

/** Tool names in the `modules` list of register.ts, parsed from source. */
export function namesListedInRegisterTs(): string[] {
  const src = readFileSync(join(TOOLS_DIR, "register.ts"), "utf-8");
  return [...src.matchAll(/\{\s*name:\s*"([a-z0-9_]+)"\s*,\s*module:/g)].map((m) => m[1]);
}

/** Tool module files in src/tools (everything except register.ts). */
export function toolSourceFiles(): string[] {
  return readdirSync(TOOLS_DIR)
    .filter((f) => f.endsWith(".ts") && f !== "register.ts")
    .map((f) => f.replace(/\.ts$/, ""));
}

/** Command names the Revit plugin's command set declares in command.json. */
export function commandJsonNames(): string[] {
  const json = JSON.parse(readFileSync(join(REPO_DIR, "command.json"), "utf-8"));
  return json.commands.map((c: any) => c.commandName);
}

/** `CommandName => "x"` values declared by the C# commands under commandset/. */
export function commandSetCommandNames(): string[] {
  const names: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "bin" && entry.name !== "obj") walk(p);
      } else if (entry.name.endsWith(".cs")) {
        const src = readFileSync(p, "utf-8");
        for (const m of src.matchAll(/CommandName\s*=>\s*"([a-z0-9_]+)"/g)) names.push(m[1]);
      }
    }
  };
  walk(join(REPO_DIR, "commandset"));
  return names;
}

export function readRepoFile(rel: string): string {
  return readFileSync(join(REPO_DIR, rel), "utf-8").replace(/\r\n/g, "\n");
}
