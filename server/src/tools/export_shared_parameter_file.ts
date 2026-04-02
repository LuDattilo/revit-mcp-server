import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerExportSharedParameterFileTool(server: McpServer) {
  server.tool(
    "export_shared_parameter_file",
    `Export project shared parameters to a standard Revit shared parameter file (.txt).

GUIDANCE:
- "Export shared parameters": uses default Desktop path
- "Export shared parameters to C:/params.txt": filePath="C:/params.txt"`,
    {
      filePath: z.string().optional()
        .describe("Output .txt path. Default: Desktop/SharedParameters_<timestamp>.txt"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("export_shared_parameter_file", {
            filePath: args.filePath ?? "",
          });
        });
        return { content: [{ type: "text" as const, text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: `Export shared parameter file failed: ${errorMessage(error)}` }], isError: true };
      }
    }
  );
}
