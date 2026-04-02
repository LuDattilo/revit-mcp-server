import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { withRevitConnection } from "../utils/ConnectionManager.js";
export function registerTransferParametersTool(server) {
    server.tool("transfer_parameters", "Copy parameter values between elements of different categories.", {
        sourceElementId: z.number().describe("ID of the source element to copy parameters from."),
        targetElementIds: z.array(z.number()).describe("IDs of target elements to copy parameters to."),
        parameterNames: z.array(z.string()).optional().describe("Specific parameter names to transfer."),
        includeType: z.boolean().optional().describe("Also transfer type parameter values. Default: false."),
        dryRun: z.boolean().optional().default(true).describe("Preview changes without applying. Default: true. Set to false to execute."),
    }, async (args, extra) => {
        try {
            const response = await withRevitConnection(async (revitClient) => {
                return await revitClient.sendCommand("transfer_parameters", {
                    sourceElementId: args.sourceElementId,
                    targetElementIds: args.targetElementIds,
                    parameterNames: args.parameterNames ?? [],
                    includeType: args.includeType ?? false,
                    dryRun: args.dryRun ?? true,
                });
            });
            return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
        }
        catch (error) {
            return { content: [{ type: "text", text: `Transfer parameters failed: ${errorMessage(error)}` }], isError: true };
        }
    });
}
