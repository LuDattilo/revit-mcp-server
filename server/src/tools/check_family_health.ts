import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCheckFamilyHealthTool(server: McpServer) {
  server.tool(
    "check_family_health",
    "Analyze the health and statistics of families in the model: file size, instance count, type count, and editability status.\n\nGUIDANCE:\n- Full scan: call with no parameters to analyze all loadable families\n- Filter by category: categories=[\"Doors\",\"Windows\"] to narrow scope\n- Include system families: includeSystemFamilies=true to include non-editable families\n- File size: set includeFileSize=true to measure family file sizes (expensive, opens each family temporarily)\n- Sort results by name, size, or instance_count\n\nTIPS:\n- Large instance counts may indicate overuse or redundancy\n- In-place families should be converted to loadable families when possible\n- Use sortBy=\"size\" with includeFileSize=true to find bloated families\n- Families with zero instances are candidates for purging",
    {
      categories: z.array(z.string()).optional().describe("Filter by category names (e.g. ['Doors', 'Windows']). If omitted, includes all categories."),
      includeSystemFamilies: z.boolean().optional().default(false).describe("Include system (non-editable) families. Default: false."),
      includeFileSize: z.boolean().optional().default(false).describe("Measure family file sizes by temporarily opening each family document. Expensive for large models. Default: false."),
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
