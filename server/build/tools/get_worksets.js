import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { withRevitConnection } from "../utils/ConnectionManager.js";
export function registerGetWorksetsTool(server) {
    server.tool("get_worksets", "List worksets with element counts and open/close status.", {
        includeSystemWorksets: z
            .boolean()
            .optional()
            .describe("Include system worksets. Default: false."),
    }, async (args, extra) => {
        const params = {
            includeSystemWorksets: args.includeSystemWorksets ?? false,
        };
        try {
            const response = await withRevitConnection(async (revitClient) => {
                return await revitClient.sendCommand("get_worksets", params);
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
                        text: `Get worksets failed: ${errorMessage(error)}`,
                    },
                ],
                isError: true,
            };
        }
    });
}
