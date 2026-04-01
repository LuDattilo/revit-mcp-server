import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerDuplicateSheetWithContentTool(server: McpServer) {
  server.tool(
    "duplicate_sheet_with_content",
    "Duplicate a Revit sheet with all its content: title block, views (duplicated with detailing), legends, and schedules in their exact positions. Create multiple copies. Inspired by DiRoots SheetGen.\n\nGUIDANCE:\n- Duplicate sheet with all content: provide sourceSheetId\n- New sheet number: provide newSheetNumber and newSheetName\n- Copies: views (as dependent), legends, schedules in exact positions\n\nTIPS:\n- Views are duplicated as dependent copies (synced with originals)\n- Sheet number must be unique in the project\n- Use batch_create_sheets for creating empty sheets instead\n- Use align_viewports after to fine-tune viewport positions",
    {
      sheetId: z.number().describe("ID of the source sheet to duplicate."),
      copies: z.number().optional().describe("Number of copies to create. Default: 1."),
      duplicateViews: z.boolean().optional().describe("Duplicate placed views with detailing. Default: true."),
      keepLegends: z.boolean().optional().describe("Place legends on new sheets. Default: true."),
      keepSchedules: z.boolean().optional().describe("Place schedules on new sheets. Default: true."),
      copyRevisions: z.boolean().optional().describe("Copy revision assignments. Default: false."),
      sheetNumberPrefix: z.string().optional().describe("Prefix for new sheet numbers."),
      sheetNumberSuffix: z.string().optional().describe("Suffix for new sheet numbers."),
    },
    async (args, extra) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("duplicate_sheet_with_content", {
            sheetId: args.sheetId,
            copies: args.copies ?? 1,
            duplicateViews: args.duplicateViews ?? true,
            keepLegends: args.keepLegends ?? true,
            keepSchedules: args.keepSchedules ?? true,
            copyRevisions: args.copyRevisions ?? false,
            sheetNumberPrefix: args.sheetNumberPrefix ?? "",
            sheetNumberSuffix: args.sheetNumberSuffix ?? "",
          });
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }], isError: true };
      } catch (error) {
        return { content: [{ type: "text", text: `Duplicate sheet failed: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    }
  );
}
