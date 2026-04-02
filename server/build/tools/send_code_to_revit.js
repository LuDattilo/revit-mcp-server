import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { withRevitConnection } from "../utils/ConnectionManager.js";
export function registerSendCodeToRevitTool(server) {
    server.tool("send_code_to_revit", "Execute custom C# code in Revit for advanced operations.", {
        code: z
            .string()
            .describe("The C# code to execute in Revit."),
        parameters: z
            .array(z.any())
            .optional()
            .describe("Optional execution parameters that will be passed to your code"),
    }, async (args, extra) => {
        const params = {
            code: args.code,
            parameters: args.parameters || [],
        };
        try {
            const response = await withRevitConnection(async (revitClient) => {
                return await revitClient.sendCommand("send_code_to_revit", params);
            });
            return {
                content: [
                    {
                        type: "text",
                        text: `Code execution successful!\nResult: ${JSON.stringify(response, null, 2)}`,
                    },
                ],
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Code execution failed: ${errorMessage(error)}`,
                    },
                ],
                isError: true,
            };
        }
    });
}
