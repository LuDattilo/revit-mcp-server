import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";
import { rawToolResponse, rawToolError } from "../utils/compactTool.js";

export function registerSendCodeToRevitTool(server: McpServer) {
  server.tool(
    "send_code_to_revit",
    "Execute custom C# code in Revit. Your code runs inside a static method with signature: `public static object Execute(Document document, object[] parameters)`. Available variables: `document` (Autodesk.Revit.DB.Document — the active document), `parameters` (object[] — optional args). Auto-imported namespaces: System, System.Linq, Autodesk.Revit.DB, Autodesk.Revit.UI, System.Collections.Generic. Use `return` to send results back. In 'auto' mode your code runs inside a Transaction; use 'none' to manage transactions yourself.",
    {
      code: z
        .string()
        .describe("C# code to execute. Use `document` to access the active Revit Document. Use `return` to send results back. Example: `var walls = new FilteredElementCollector(document).OfClass(typeof(Wall)).GetElementCount(); return \"Walls: \" + walls;`"),
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

        return rawToolResponse("send_code_to_revit", response);
      } catch (error) {
        return rawToolError("send_code_to_revit", `Code execution failed: ${
                errorMessage(error)
              }`);
      }
    }
  );
}
