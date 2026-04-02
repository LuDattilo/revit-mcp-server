import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { withRevitConnection } from "../utils/ConnectionManager.js";
export function registerSayHelloTool(server) {
    server.tool("say_hello", "Display a greeting dialog in Revit. Tests MCP connection.", {
        message: z
            .string()
            .optional()
            .describe("Optional custom message to display in the dialog. Defaults to 'Hello MCP!'"),
    }, async (args, extra) => {
        const params = args;
        try {
            const response = await withRevitConnection(async (revitClient) => {
                return await revitClient.sendCommand("say_hello", params);
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
                        text: `Say hello failed: ${errorMessage(error)}`,
                    },
                ],
                isError: true,
            };
        }
    });
}
