import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { withRevitConnection } from "../utils/ConnectionManager.js";
export function registerGetSelectedElementsTool(server) {
    server.tool("get_selected_elements", "Get info about currently selected elements in Revit.", {
        limit: z
            .number()
            .optional()
            .describe("Maximum number of elements to return"),
    }, async (args, extra) => {
        const params = {
            limit: args.limit || 100,
        };
        try {
            const response = await withRevitConnection(async (revitClient) => {
                return await revitClient.sendCommand("get_selected_elements", params);
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
                        text: `get selected elements failed: ${errorMessage(error)}`,
                    },
                ],
                isError: true,
            };
        }
    });
}
