import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerDuplicateSheetWithViewsTool(server: McpServer) {
  server.tool(
    "duplicate_sheet_with_views",
    "Duplicate a sheet with its views, legends, and schedules. Views can be duplicated or shared.\n\nGUIDANCE:\n- Duplicate sheet with views: provide sheetId\n- Views can be duplicated with different options: Duplicate, DuplicateWithDetailing, DuplicateAsDependent\n- Legends and schedules can be shared across sheets without duplication\n- Use newSheetNumberPrefix to organize new sheet numbers\n\nTIPS:\n- DuplicateWithDetailing preserves annotations and detail items\n- DuplicateAsDependent creates dependent views synced with the original\n- Legends can always be placed on multiple sheets\n- Schedules are shared by reference, not duplicated",
    {
      sheetId: z.number().describe("ElementId of the source sheet to duplicate."),
      copies: z.number().optional().default(1).describe("Number of copies to create. Default: 1."),
      duplicateViews: z.boolean().optional().default(true).describe("Duplicate placed views (not just reference them). Default: true."),
      keepLegends: z.boolean().optional().default(true).describe("Keep legend views on new sheets. Default: true."),
      keepSchedules: z.boolean().optional().default(true).describe("Keep schedules on new sheets. Default: true."),
      newSheetNumberPrefix: z.string().optional().describe("Prefix for new sheet numbers."),
      viewDuplicateOption: z.enum(["Duplicate", "DuplicateWithDetailing", "DuplicateAsDependent"]).optional().default("DuplicateWithDetailing").describe("How to duplicate views: Duplicate, DuplicateWithDetailing, or DuplicateAsDependent. Default: DuplicateWithDetailing."),
    },
    async (args, extra) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("duplicate_sheet_with_views", {
            sheetId: args.sheetId,
            copies: args.copies ?? 1,
            duplicateViews: args.duplicateViews ?? true,
            keepLegends: args.keepLegends ?? true,
            keepSchedules: args.keepSchedules ?? true,
            newSheetNumberPrefix: args.newSheetNumberPrefix ?? "",
            viewDuplicateOption: args.viewDuplicateOption ?? "DuplicateWithDetailing",
          });
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Duplicate sheet with views failed: ${errorMessage(error)}` }], isError: true };
      }
    }
  );
}
