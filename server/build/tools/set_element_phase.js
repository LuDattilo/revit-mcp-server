import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { withRevitConnection } from "../utils/ConnectionManager.js";
export function registerSetElementPhaseTool(server) {
    server.tool("set_element_phase", "Assign created/demolished phase to elements.", {
        requests: z
            .array(z.object({
            elementId: z.number().describe("Revit element ID"),
            createdPhaseId: z
                .number()
                .optional()
                .describe("Phase ID to set as the created phase for the element"),
            demolishedPhaseId: z
                .number()
                .optional()
                .describe("Phase ID to set as the demolished phase for the element"),
        }))
            .describe("Array of phase assignment requests."),
    }, async (args, extra) => {
        try {
            const response = await withRevitConnection(async (revitClient) => {
                return await revitClient.sendCommand("set_element_phase", {
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
                        text: `Set element phase failed: ${errorMessage(error)}`,
                    },
                ],
                isError: true,
            };
        }
    });
}
