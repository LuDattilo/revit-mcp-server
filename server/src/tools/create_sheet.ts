import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateSheetTool(server: McpServer) {
  server.tool(
    "create_sheet",
    "Create a new sheet in the Revit project with an optional title block. Returns the sheet ID, number, and name.\n\nGUIDANCE:\n- Standard sheet: provide sheetNumber=\"A101\", sheetName=\"Floor Plan\", titleBlockName\n- Use get_available_family_types with category \"Title Blocks\" to find title block names\n- After creating sheet, use place_viewport to add views\n\nTIPS:\n- Sheet numbers must be unique in the project\n- Use batch_create_sheets for multiple sheets at once\n- Use create_revision to add revision tracking to sheets",
    {
      sheetNumber: z
        .string()
        .optional()
        .describe("Sheet number (e.g. 'A101')"),
      sheetName: z.string().optional().describe("Sheet name"),
      titleBlockFamilyName: z
        .string()
        .optional()
        .describe(
          "Title block family name. If not specified, uses the first available title block"
        ),
      titleBlockTypeName: z
        .string()
        .optional()
        .describe("Title block type name within the family"),
      titleBlockTypeId: z
        .number()
        .optional()
        .describe("Title block type ID (alternative to family/type name)"),
    },
    async (args, extra) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_sheet", args);
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
              text: `Create sheet failed: ${
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
