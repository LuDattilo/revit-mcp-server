import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { withRevitConnection } from "../utils/ConnectionManager.js";
export function registerSetElementParametersTool(server) {
    server.tool("set_element_parameters", "Set a parameter value on one or more elements.", {
        requests: z
            .array(z.object({
            elementId: z.number().describe("Revit element ID"),
            parameterName: z
                .string()
                .describe("Name of the parameter to set"),
            value: z
                .union([z.string(), z.number(), z.boolean()])
                .describe("Value to set."),
        }))
            .describe("Array of parameter set requests"),
    }, async (args, extra) => {
        try {
            const response = await withRevitConnection(async (revitClient) => {
                return await revitClient.sendCommand("set_element_parameters", {
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
                        text: `Set element parameters failed: ${errorMessage(error)}`,
                    },
                ],
                isError: true,
            };
        }
    });
}
