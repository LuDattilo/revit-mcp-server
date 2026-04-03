import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";
import { toolResponse, toolError, setToolName } from "../utils/compactTool.js";

export function registerGetMaterialsTool(server: McpServer) {
  server.tool(
    "get_materials",
    "List materials in the project, optionally filtered by class.",
    {
      materialClass: z
        .string()
        .optional()
        .describe("Filter materials by class (case-insensitive exact match, e."),
      nameFilter: z
        .string()
        .optional()
        .describe(
          "Filter materials whose name contains this substring (case-insensitive)"
        ),
    },
    async (args, extra) => {
      setToolName("get_materials");
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("get_materials", { materialClass: args.materialClass, nameFilter: args.nameFilter });
        });

        return toolResponse(response);
      } catch (error) {
        return toolError(`Get materials failed: ${errorMessage(error)}`);
      }
    }
  );
}
