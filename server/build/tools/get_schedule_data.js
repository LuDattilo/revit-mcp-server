import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { withRevitConnection } from "../utils/ConnectionManager.js";
import { toolResponse, toolError } from "../utils/compactTool.js";
export function registerGetScheduleDataTool(server) {
    server.tool("get_schedule_data", "Read data from an existing schedule view.", {
        scheduleId: z
            .number()
            .optional()
            .describe("Schedule element ID. If omitted or 0, lists all schedules in the project."),
        maxRows: z
            .number()
            .optional()
            .describe("Maximum rows to return (default: 500)"),
        fields: z
            .array(z.string())
            .optional()
            .describe("Return only these fields per row. Omit to return all columns."),
    }, async (args, extra) => {
        const params = {
            scheduleId: args.scheduleId ?? 0,
            maxRows: args.maxRows ?? 500,
        };
        try {
            const response = await withRevitConnection(async (revitClient) => {
                return await revitClient.sendCommand("get_schedule_data", params);
            });
            return toolResponse(response, args);
        }
        catch (error) {
            return toolError(`Get schedule data failed: ${errorMessage(error)}`);
        }
    });
}
