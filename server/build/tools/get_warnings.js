import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { withRevitConnection } from "../utils/ConnectionManager.js";
export function registerGetWarningsTool(server) {
    server.tool("get_warnings", "Get all warnings/errors in the current Revit model. Warnings indicate issues like duplicate elements, overlapping geometry, room separation problems, etc. Useful for model health auditing and quality control.\n\nGUIDANCE:\n- Model health check: returns all Revit warnings/errors\n- Quality audit: identify duplicate elements, overlapping geometry, etc.\n- Pre-submission review: fix warnings before model delivery\n\nTIPS:\n- Warnings don't prevent work but indicate potential issues\n- Common warnings: duplicate instances, room not enclosed, overlapping walls\n- Use check_model_health for a comprehensive scored audit\n- Fix high-severity warnings first", {
        severityFilter: z
            .enum(["All", "Warning", "Error"])
            .optional()
            .describe("Filter by severity level (default: All)"),
        maxWarnings: z
            .number()
            .optional()
            .describe("Maximum number of warnings to return (default: 500)"),
        categoryFilter: z
            .string()
            .optional()
            .describe("Filter warnings containing this text in the description (case-insensitive)"),
    }, async (args, extra) => {
        const params = {
            severityFilter: args.severityFilter ?? "All",
            maxWarnings: args.maxWarnings ?? 500,
            categoryFilter: args.categoryFilter ?? "",
        };
        try {
            const response = await withRevitConnection(async (revitClient) => {
                return await revitClient.sendCommand("get_warnings", params);
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
                        text: `Get warnings failed: ${errorMessage(error)}`,
                    },
                ],
                isError: true,
            };
        }
    });
}
