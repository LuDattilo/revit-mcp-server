import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreatePlaceholderSheetsTool(server: McpServer) {
  server.tool(
    "create_placeholder_sheets",
    "Create, list, convert, or delete placeholder sheets. Placeholder sheets are sheet stubs without a title block that can be promoted to full sheets later.\n\nGUIDANCE:\n- create: provide sheets array with number and name for each placeholder\n- list: returns all placeholder sheets in the model\n- convert: provide sheetIds and titleBlockId to promote placeholders to real sheets\n- delete: provide sheetIds to remove placeholder sheets\n\nTIPS:\n- Use 'list' first to see existing placeholders before converting or deleting\n- Use get_available_family_types with \"Title Blocks\" to find title block IDs for convert\n- Converting a placeholder preserves its number and name",
    {
      action: z
        .enum(["create", "list", "convert", "delete"])
        .describe("Operation to perform"),
      sheets: z
        .array(
          z.object({
            number: z.string().describe("Sheet number (e.g. 'A-101')"),
            name: z.string().describe("Sheet name (e.g. 'Floor Plan - Level 1')"),
          })
        )
        .optional()
        .describe("Sheets to create (for 'create' action)"),
      sheetIds: z
        .array(z.number())
        .optional()
        .describe("Sheet element IDs (for 'convert' and 'delete' actions)"),
      titleBlockId: z
        .number()
        .optional()
        .describe("Title block type element ID (for 'convert' action)"),
    },
    async (args, extra) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_placeholder_sheets", args);
        });
        return {
          content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Create placeholder sheets failed: ${errorMessage(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
