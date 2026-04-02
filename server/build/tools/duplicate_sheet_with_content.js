import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { withRevitConnection } from "../utils/ConnectionManager.js";
export function registerDuplicateSheetWithContentTool(server) {
    server.tool("duplicate_sheet_with_content", "Duplicate a sheet including all annotations and detail items.", {
        sheetId: z.number().describe("ID of the source sheet to duplicate."),
        copies: z.number().optional().describe("Number of copies to create. Default: 1."),
        duplicateViews: z.boolean().optional().describe("Duplicate placed views with detailing. Default: true."),
        keepLegends: z.boolean().optional().describe("Place legends on new sheets. Default: true."),
        keepSchedules: z.boolean().optional().describe("Place schedules on new sheets. Default: true."),
        copyRevisions: z.boolean().optional().describe("Copy revision assignments. Default: false."),
        sheetNumberPrefix: z.string().optional().describe("Prefix for new sheet numbers."),
        sheetNumberSuffix: z.string().optional().describe("Suffix for new sheet numbers."),
    }, async (args, extra) => {
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
            return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
        }
        catch (error) {
            return { content: [{ type: "text", text: `Duplicate sheet failed: ${errorMessage(error)}` }], isError: true };
        }
    });
}
