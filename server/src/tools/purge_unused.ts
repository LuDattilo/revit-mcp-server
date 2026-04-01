import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerPurgeUnusedTool(server: McpServer) {
  server.tool(
    "purge_unused",
    "Identify and optionally remove unused families, family types, materials, and other elements that bloat the Revit model. Use dryRun=true (default) to preview what would be purged without actually deleting anything.\n\nGUIDANCE:\n- List purgeable items: dryRun=true to preview without deleting\n- Purge all: dryRun=false to actually delete unused items\n- Category filter: specify categories to only purge specific types\n\nTIPS:\n- Always run with dryRun=true first to review what will be deleted\n- Reduces file size by removing unused families, types, and materials\n- Use audit_families for a detailed family-level analysis first\n- Cannot be undone — save before purging",
    {
      dryRun: z
        .boolean()
        .optional()
        .describe(
          "If true (default), only reports what would be purged without deleting. Set to false to actually purge."
        ),
      maxElements: z
        .number()
        .optional()
        .describe("Maximum number of elements to purge in one operation (default: 500)"),
    },
    async (args, extra) => {
      const params = {
        dryRun: args.dryRun ?? true,
        maxElements: args.maxElements ?? 500,
      };

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("purge_unused", params);
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Purge unused failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
