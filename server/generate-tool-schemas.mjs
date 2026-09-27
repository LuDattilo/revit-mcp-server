#!/usr/bin/env node
/**
 * Generates tool-schemas.txt from the MCP server's registered tools.
 * Cross-platform: uses spawn + stdin piping (no shell dependency).
 * Output: ../tool-schemas.txt (project root)
 */
import { spawn } from "child_process";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { formatToolSchemasTxt, formatToolSchemasJson } from "./tool-schema-format.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverEntry = join(__dirname, "build", "index.js");
const outputPath = join(__dirname, "..", "tool-schemas.txt");
const jsonOutputPath = join(__dirname, "..", "plugin", "tool_schemas.json");

const child = spawn(process.execPath, [serverEntry], {
  stdio: ["pipe", "pipe", "pipe"],
});

let stdout = "";
child.stdout.on("data", (chunk) => (stdout += chunk));

// MCP requires initialize handshake before tools/list
const initialize = JSON.stringify({
  jsonrpc: "2.0",
  id: 0,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "schema-gen", version: "1.0.0" },
  },
});

const toolsList = JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "tools/list",
  params: {},
});

child.stdin.write(initialize + "\n");
child.stdin.write(toolsList + "\n");
child.stdin.end();

child.on("close", () => {
  // stdout may contain multiple JSON-RPC responses (one per line or concatenated)
  const responses = stdout
    .split("\n")
    .filter((l) => l.trim().startsWith("{"))
    .map((l) => JSON.parse(l));

  const toolsResponse = responses.find(
    (r) => r.id === 1 && r.result?.tools
  );
  if (!toolsResponse) {
    console.error("Failed to get tools list from server");
    process.exit(1);
  }

  const tools = toolsResponse.result.tools;

  // Formatting lives in tool-schema-format.mjs so the vitest drift test can
  // compare the committed files against the live registration.
  writeFileSync(outputPath, formatToolSchemasTxt(tools));
  console.log(`Generated ${outputPath} with ${tools.length} tools`);

  // Also generate plugin/tool_schemas.json (full schema for Revit chat panel)
  writeFileSync(jsonOutputPath, formatToolSchemasJson(tools));
  console.log(`Generated ${jsonOutputPath} with ${tools.length} tools`);
});
