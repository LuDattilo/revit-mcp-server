import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { withRevitConnection } from "../utils/ConnectionManager.js";
export function registerSetElementWorksetTool(server) {
    server.tool("set_element_workset", "Move elements to a different workset.", {
        requests: z
            .array(z.object({
            elementId: z.number().describe("Revit element ID"),
            worksetName: z
                .string()
                .describe("Name of the target workset to move the element to"),
        }))
            .describe("Array of workset assignment requests"),
    }, async (args, extra) => {
        try {
            const response = await withRevitConnection(async (revitClient) => {
                return await revitClient.sendCommand("set_element_workset", {
                    requests: args.requests,
                });
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
                        text: `Set element workset failed: ${errorMessage(error)}`,
                    },
                ],
                isError: true,
            };
        }
    });
}
