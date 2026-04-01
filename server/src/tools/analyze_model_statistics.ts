import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerAnalyzeModelStatisticsTool(server: McpServer) {
  server.tool(
    "analyze_model_statistics",
    "Analyze model complexity with element counts. Returns detailed statistics about the Revit model including total element counts, total types, total families, views, sheets, counts by category (with type/family breakdown), and level-by-level element distribution. Useful for model auditing, performance analysis, and understanding model composition.\n\nGUIDANCE:\n- Model overview: element counts by category, type, family, and level\n- Quality check: identify categories with unexpected element counts\n- Pre-audit: run before check_model_health for a quick complexity assessment\n\nTIPS:\n- Useful for understanding model scope before detailed operations\n- Compare counts across levels to check consistency\n- Large element counts may indicate modeling issues",
    {
      includeDetailedTypes: z
        .boolean()
        .optional()
        .default(true)
        .describe("Whether to include detailed breakdown by family and type within each category. Defaults to true."),
    },
    async (args, extra) => {
      const params = {
        includeDetailedTypes: args.includeDetailedTypes ?? true,
      };

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("analyze_model_statistics", params);
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
              text: `Analyze model statistics failed: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
