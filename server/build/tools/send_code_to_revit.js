import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { withRevitConnection } from "../utils/ConnectionManager.js";
import { rawToolResponse, rawToolError } from "../utils/compactTool.js";
export function registerSendCodeToRevitTool(server) {
    server.tool("send_code_to_revit", "Execute custom C# code in Revit for advanced operations.", {
        code: z
            .string()
            .describe("The C# code to execute in Revit."),
        parameters: z
            .array(z.string())
            .optional()
            .describe("Optional execution parameters that will be passed to your code"),
        transactionMode: z
            .enum(["auto", "none"])
            .default("auto")
            .describe("Transaction mode: 'auto' (default) wraps code in a Revit Transaction; 'none' lets the code manage its own transactions"),
    }, async (args, extra) => {
        const params = {
            code: args.code,
            parameters: args.parameters || [],
            transactionMode: args.transactionMode,
        };
        try {
            const response = await withRevitConnection(async (revitClient) => {
                return await revitClient.sendCommand("send_code_to_revit", params);
            });
            return rawToolResponse("send_code_to_revit", response);
        }
        catch (error) {
            return rawToolError("send_code_to_revit", `Code execution failed: ${errorMessage(error)}`);
        }
    });
}
