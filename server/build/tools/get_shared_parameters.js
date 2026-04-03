import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { withRevitConnection } from "../utils/ConnectionManager.js";
import { toolResponse, toolError } from "../utils/compactTool.js";
export function registerGetSharedParametersTool(server) {
    server.tool("get_shared_parameters", "List shared parameters and their category bindings.", {
        categoryFilter: z
            .string()
            .optional()
            .describe("Optional category name filter."),
        fields: z
            .array(z.string())
            .optional()
            .describe("Return only these fields per parameter (e.g. ['name', 'group', 'categories']). Omit to return all."),
    }, async (args, extra) => {
        try {
            const response = await withRevitConnection(async (revitClient) => {
                return await revitClient.sendCommand("get_shared_parameters", {
                    categoryFilter: args.categoryFilter,
                });
            });
            return toolResponse(response, args);
        }
        catch (error) {
            return toolError(`Get shared parameters failed: ${errorMessage(error)}`);
        }
    });
}
