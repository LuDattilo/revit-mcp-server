import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCadLinkCleanupTool(server: McpServer) {
  server.tool(
    "cad_link_cleanup",
    "Audit and clean up CAD imports and links in the model. List all CAD files (imports and links), identify bloat, and optionally delete them. Models often accumulate forgotten CAD imports that increase file size.\n\nGUIDANCE:\n- Audit CAD imports: action=\"list\" to see all CAD files in the model\n- Delete specific: action=\"delete\", provide CAD link IDs to remove\n- Full cleanup: action=\"deleteAll\" to remove all CAD imports\n\nTIPS:\n- CAD imports increase file size and can cause performance issues\n- List first to review before deleting\n- check_model_health includes CAD import count in health score\n- Consider linking CAD files instead of importing",
    {
      action: z
        .enum(["list", "delete"])
        .optional()
        .describe("Action: list all CAD imports/links, or delete them (default: list)"),
      deleteImports: z
        .boolean()
        .optional()
        .describe("Delete CAD imports (embedded files) when action is delete"),
      deleteLinks: z
        .boolean()
        .optional()
        .describe("Delete CAD links (referenced files) when action is delete"),
      elementIds: z
        .array(z.number())
        .optional()
        .describe("Specific CAD element IDs to delete (overrides deleteImports/deleteLinks flags)"),
    },
    async (args, extra) => {
      const params = {
        action: args.action ?? "list",
        deleteImports: args.deleteImports ?? false,
        deleteLinks: args.deleteLinks ?? false,
        elementIds: args.elementIds ?? [],
      };

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("cad_link_cleanup", params);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `CAD cleanup failed: ${errorMessage(error)}` }], isError: true };
      }
    }
  );
}
