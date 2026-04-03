import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerSendCodeToRevitTool(server: McpServer) {
  server.tool(
    "send_code_to_revit",
    "Execute custom C# code in Revit for advanced operations.",
    {
      code: z
        .string()
        .describe("The C# code to execute in Revit."),
      parameters: z
        .array(z.string())
        .optional()
        .describe(
          "Optional execution parameters that will be passed to your code"
        ),
      transactionMode: z
        .enum(["auto", "none"])
        .default("auto")
        .describe(
          "Transaction mode: 'auto' (default) wraps code in a Revit Transaction; 'none' lets the code manage its own transactions"
        ),
    },
    async (args, extra) => {
      const params = {
        code: args.code,
        parameters: args.parameters || [],
        transactionMode: args.transactionMode,
      };

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("send_code_to_revit", params);
        });

        return {
          content: [
            {
              type: "text",
              text: `Code execution successful!\nResult: ${JSON.stringify(
                response,
                null,
                2
              )}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Code execution failed: ${
                errorMessage(error)
              }`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
