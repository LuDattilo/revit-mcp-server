import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerDuplicateViewTool(server: McpServer) {
  server.tool(
    "duplicate_view",
    "Duplicate a view (independent, dependent, or with detailing).",
    {
      viewIds: z
        .array(z.number())
        .describe("View IDs to duplicate"),
      duplicateOption: z
        .enum(["duplicate", "dependent", "withDetailing"])
        .optional()
        .describe("'duplicate', 'dependent', or 'withDetailing'."),
      newNamePrefix: z
        .string()
        .optional()
        .describe("Prefix for the new view name"),
      newNameSuffix: z
        .string()
        .optional()
        .describe("Suffix for the new view name"),
    },
    async (args, extra) => {
      const params = {
        viewIds: args.viewIds,
        duplicateOption: args.duplicateOption ?? "duplicate",
        newNamePrefix: args.newNamePrefix ?? "",
        newNameSuffix: args.newNameSuffix ?? "",
      };

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("duplicate_view", params);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Duplicate view failed: ${errorMessage(error)}` }], isError: true };
      }
    }
  );
}
