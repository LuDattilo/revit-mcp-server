import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCheckFamilyHealthTool(server: McpServer) {
  server.tool(
    "check_family_health",
    "Analyze loaded families for file size, import issues, and naming.",
    {
      categories: z.array(z.string()).optional().describe("Filter by category names (e.g. ['Doors', 'Windows'])."),
      includeSystemFamilies: z.boolean().optional().default(false).describe("Include system (non-editable) families. Default: false."),
      includeFileSize: z.boolean().optional().default(false).describe("Measure family file sizes by temporarily opening each family document."),
      sortBy: z.enum(["name", "size", "instance_count"]).optional().default("size").describe("Sort results by: name, size, or instance_count. Default: size."),
    },
    async (args, extra) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("check_family_health", {
            categories: args.categories ?? [],
            includeSystemFamilies: args.includeSystemFamilies ?? false,
            includeFileSize: args.includeFileSize ?? false,
            sortBy: args.sortBy ?? "size",
          });
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Check family health failed: ${errorMessage(error)}` }], isError: true };
      }
    }
  );
}
