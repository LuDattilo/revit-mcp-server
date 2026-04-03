import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";
import { toolResponse, toolError, setToolName } from "../utils/compactTool.js";

export function registerGetMaterialPropertiesTool(server: McpServer) {
  server.tool(
    "get_material_properties",
    "Get detailed physical/thermal properties of a material.",
    {
      materialId: z
        .number()
        .optional()
        .describe("The Revit element ID of the material"),
      materialName: z
        .string()
        .optional()
        .describe("Material name (case-insensitive). Used if materialId not provided."),
    },
    async (args, extra) => {
      setToolName("get_material_properties");
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("get_material_properties", {
            materialId: args.materialId,
            materialName: args.materialName,
          });
        });

        return toolResponse(response);
      } catch (error) {
        return toolError(`Get material properties failed: ${errorMessage(error)}`);
      }
    }
  );
}
