import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { withRevitConnection } from "../utils/ConnectionManager.js";
export function registerMatchElementPropertiesTool(server) {
    server.tool("match_element_properties", "Copy parameter values from a source element to target elements.", {
        sourceElementId: z
            .number()
            .describe("Source element ID to copy parameter values from"),
        targetElementIds: z
            .array(z.number())
            .describe("Target element IDs to copy parameter values to"),
        parameterNames: z
            .array(z.string())
            .optional()
            .describe("Parameter names to copy. Default: all writable params."),
        includeTypeParameters: z
            .boolean()
            .optional()
            .describe("Also copy type parameters (default: false, instance only)"),
    }, async (args, extra) => {
        const params = {
            sourceElementId: args.sourceElementId,
            targetElementIds: args.targetElementIds,
            parameterNames: args.parameterNames ?? [],
            includeTypeParameters: args.includeTypeParameters ?? false,
        };
        try {
            const response = await withRevitConnection(async (revitClient) => {
                return await revitClient.sendCommand("match_element_properties", params);
            });
            return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
        }
        catch (error) {
            return { content: [{ type: "text", text: `Match properties failed: ${errorMessage(error)}` }], isError: true };
        }
    });
}
