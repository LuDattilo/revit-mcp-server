/**
 * Runs before every test file. Isolates everything that would otherwise touch the
 * developer's real machine state:
 *  - HOME / USERPROFILE -> temp dir, so database/db.ts writes ~/.mcp-revit/revit-data.db
 *    somewhere disposable instead of the user's real stored project/room data.
 *  - APPDATA -> temp dir, so ConnectionManager never reads the live Revit add-in's
 *    mcp-port.txt (tests that exercise port discovery create their own).
 */
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const root = mkdtempSync(join(tmpdir(), "revit-mcp-test-"));
process.env.HOME = join(root, "home");
process.env.USERPROFILE = join(root, "home");
process.env.APPDATA = join(root, "appdata");
process.env.REVIT_MCP_TEST_ROOT = root;
