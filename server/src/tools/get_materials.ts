import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";
import { toolResponse, toolError } from "../utils/compactTool.js";

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
      fields: z
        .array(z.string())
        .optional()
        .describe("Return only these fields per material (e.g. ['name', 'id', 'materialClass']). Omit to return all."),
    },
    async (args, extra) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("get_materials", { materialClass: args.materialClass, nameFilter: args.nameFilter });
        });

        return toolResponse(response, args);
      } catch (error) {
        return toolError(`Get materials failed: ${errorMessage(error)}`);
      }
    }
  );
}
