import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { withRevitConnection } from "../utils/ConnectionManager.js";
export function registerExportScheduleTool(server) {
    server.tool("export_schedule", "Export a schedule view to CSV/TSV/TXT.", {
        scheduleId: z
            .number()
            .describe("The element ID of the schedule to export"),
        exportPath: z
            .string()
            .optional()
            .describe("File path for the exported schedule."),
        delimiter: z
            .enum(["Tab", "Comma", "Space", "Semicolon"])
            .optional()
            .describe("Field delimiter for the exported file (default: Tab)"),
        includeHeaders: z
            .boolean()
            .optional()
            .describe("Whether to include column headers in the export (default: true)"),
    }, async (args, extra) => {
        try {
            const response = await withRevitConnection(async (revitClient) => {
                return await revitClient.sendCommand("export_schedule", args);
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
                        text: `Export schedule failed: ${errorMessage(error)}`,
                    },
                ],
                isError: true,
            };
        }
    });
}
