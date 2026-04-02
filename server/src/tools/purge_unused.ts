import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerPurgeUnusedTool(server: McpServer) {
  server.tool(
    "purge_unused",
    "Find and remove unused families, types, and materials.",
    {
      dryRun: z
        .boolean()
        .optional()
        .describe("If true (default), only reports what would be purged without deleting."),
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
                errorMessage(error)
              }`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
