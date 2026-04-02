import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { withRevitConnection } from "../utils/ConnectionManager.js";
export function registerTagAllWallsTool(server) {
    server.tool("tag_all_walls", "Tag walls in the current view with wall tags.", {
        useLeader: z
            .boolean()
            .optional()
            .default(false)
            .describe("Whether to use a leader line when creating the tags"),
        tagTypeId: z
            .string()
            .optional()
            .describe("The ID of the specific wall tag family type to use."),
    }, async (args, extra) => {
        const params = args;
        try {
            const response = await withRevitConnection(async (revitClient) => {
                return await revitClient.sendCommand("tag_walls", params);
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
                        text: `Wall tagging failed: ${errorMessage(error)}`,
                    },
                ],
                isError: true,
            };
        }
    });
}
