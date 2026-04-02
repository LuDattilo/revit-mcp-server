import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";
import { addSuggestions, suggestIf } from "../utils/suggestions.js";

export function registerWorkflowSheetSetTool(server: McpServer) {
  server.tool(
    "workflow_sheet_set",
    `Create a set of sheets with title blocks in one call. Provide sheet numbers and names, and optionally specify a title block family name.

GUIDANCE:
- "Create 3 architectural sheets": sheets=[{number:"A101",name:"Floor Plan"},{number:"A102",name:"Elevations"},{number:"A103",name:"Sections"}]
- "Create sheets with a specific title block": titleBlockName="A1 Metric"
- After creating sheets, use place_viewport and align_viewports to add and arrange views`,
    {
      sheets: z.array(z.object({
        number: z.string().describe("Sheet number (e.g. 'A101')."),
        name: z.string().describe("Sheet name/title (e.g. 'Floor Plan - Level 1')."),
      })).describe("Array of sheet definitions with number and name."),
      titleBlockName: z.string().optional()
        .describe("Title block family or type name. If omitted, the first available title block is used."),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("workflow_sheet_set", {
            sheets: args.sheets,
            titleBlockName: args.titleBlockName ?? "",
          });
        });

        const data = typeof response === 'object' ? (response as any)?.data ?? response : response;
        const sheetsCreated = data?.sheetsCreated ?? 0;
        const enriched = addSuggestions(response, [
          suggestIf(sheetsCreated > 0, "Place views on the new sheets", "Sheets are empty — add viewports to populate them"),
          suggestIf(sheetsCreated > 0, "Align viewports", "Ensure consistent viewport placement across sheets"),
          suggestIf(sheetsCreated > 0, "Export sheets to PDF", "Generate deliverable documents from the new sheet set"),
        ]);

        return { content: [{ type: "text" as const, text: JSON.stringify(enriched, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: `Workflow sheet set failed: ${errorMessage(error)}` }], isError: true };
      }
    }
  );
}
