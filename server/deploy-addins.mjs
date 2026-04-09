/**
 * Post-build step: copies server build + tool-schemas to all Revit Addins folders (2023-2027).
 * Runs automatically as part of `npm run build`.
 */
import { cpSync, existsSync } from "fs";
import { join } from "path";

const APPDATA = process.env.APPDATA || "";
const YEARS = ["2023", "2024", "2025", "2026", "2027"];
const ADDINS_BASE = join(APPDATA, "Autodesk", "Revit", "Addins");
const RELATIVE_PATH = join("revit_mcp_plugin", "Commands", "RevitMCPCommandSet");

const SOURCE_BUILD = join(import.meta.dirname, "build", "index.js");
const SOURCE_WASM = join(import.meta.dirname, "build", "sql-wasm.wasm");
const SOURCE_SCHEMAS = join(import.meta.dirname, "..", "tool-schemas.txt");

let deployed = 0;

for (const year of YEARS) {
  const targetDir = join(ADDINS_BASE, year, RELATIVE_PATH);
  if (!existsSync(targetDir)) continue;

  const targetBuildDir = join(targetDir, "server", "build");
  if (!existsSync(targetBuildDir)) continue;

  try {
    cpSync(SOURCE_BUILD, join(targetBuildDir, "index.js"));
    if (existsSync(SOURCE_WASM)) {
      cpSync(SOURCE_WASM, join(targetBuildDir, "sql-wasm.wasm"));
    }
    if (existsSync(SOURCE_SCHEMAS)) {
      cpSync(SOURCE_SCHEMAS, join(targetDir, "tool-schemas.txt"));
    }
    deployed++;
    console.error(`Deployed to Revit ${year} addins`);
  } catch (err) {
    console.error(`Warning: Could not deploy to Revit ${year}: ${err.message}`);
  }
}

if (deployed === 0) {
  console.error("No Revit addins folders found — skipping deploy");
} else {
  console.error(`Deployed server build to ${deployed} Revit version(s)`);
}
