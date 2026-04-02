import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { withRevitConnection } from "../utils/ConnectionManager.js";
export function registerExportFamiliesTool(server) {
    server.tool("export_families", "Export family .rfa files from the current Revit model to a folder on disk.\n\nGUIDANCE:\n- Exports editable (non-system) families as .rfa files\n- Can filter by category names\n- Optionally groups exported files into subfolders by category\n- Skips system families that cannot be edited/exported\n\nTIPS:\n- Output directory must be writable\n- Use categories filter to export only specific family types\n- Set overwrite=true to replace existing .rfa files\n- groupByCategory creates a subfolder per category for organization", {
        outputDirectory: z
            .string()
            .describe("Folder path to export .rfa files"),
        categories: z
            .array(z.string())
            .optional()
            .describe("Filter by category names (e.g. ['Doors', 'Windows']). If omitted, exports all editable families."),
        groupByCategory: z
            .boolean()
            .optional()
            .default(true)
            .describe("Create subfolders per category (default: true)"),
        overwrite: z
            .boolean()
            .optional()
            .default(false)
            .describe("Overwrite existing .rfa files (default: false)"),
    }, async (args, extra) => {
        const params = {
            outputDirectory: args.outputDirectory,
            categories: args.categories ?? [],
            groupByCategory: args.groupByCategory ?? true,
            overwrite: args.overwrite ?? false,
        };
        try {
            const response = await withRevitConnection(async (revitClient) => {
                return await revitClient.sendCommand("export_families", params);
            });
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(response, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Export families failed: ${errorMessage(error)}`,
                    },
                ],
                isError: true,
            };
        }
    });
}
