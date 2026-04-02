import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { withRevitConnection } from "../utils/ConnectionManager.js";
export function registerGetMaterialsTool(server) {
    server.tool("get_materials", "List materials in the project, optionally filtered by class.", {
        materialClass: z
            .string()
            .optional()
            .describe("Filter materials by class (case-insensitive exact match, e."),
        nameFilter: z
            .string()
            .optional()
            .describe("Filter materials whose name contains this substring (case-insensitive)"),
    }, async (args, extra) => {
        try {
            const response = await withRevitConnection(async (revitClient) => {
                return await revitClient.sendCommand("get_materials", { ...args });
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
                        text: `Get materials failed: ${errorMessage(error)}`,
                    },
                ],
                isError: true,
            };
        }
    });
}
