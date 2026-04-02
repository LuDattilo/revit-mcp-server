import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { withRevitConnection } from "../utils/ConnectionManager.js";
export function registerSyncCsvParametersTool(server) {
    server.tool("sync_csv_parameters", "Import parameter values into Revit elements from structured data (like CSV/Excel). Each row specifies an element ID and parameter name-value pairs to set. Supports dry-run mode to preview changes before applying. No external software required — data is passed directly as JSON.\n\nGUIDANCE:\n- Update parameters from data: provide array of {elementId, parameters: {name: value}}\n- Dry run first: set dryRun=true to preview changes without modifying\n- Use with export_elements_data: export → modify data → sync back\n\nTIPS:\n- Always dry run first to verify parameter names and values\n- elementId is required for each element update\n- Parameter names must match exactly (case-sensitive, may be localized)\n- Use for bulk parameter updates from spreadsheet or AI-generated data", {
        data: z
            .array(z.object({
            elementId: z.number().describe("Revit element ID"),
            parameters: z
                .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
                .describe("Parameter name → value pairs to set"),
        }))
            .describe("Array of element update definitions"),
        dryRun: z
            .boolean()
            .optional()
            .default(true)
            .describe("If true (default), only preview changes without applying. Set to false to apply."),
    }, async (args, extra) => {
        try {
            const response = await withRevitConnection(async (revitClient) => {
                return await revitClient.sendCommand("sync_csv_parameters", args);
            });
            return {
                content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Sync CSV parameters failed: ${errorMessage(error)}`,
                    },
                ],
                isError: true,
            };
        }
    });
}
