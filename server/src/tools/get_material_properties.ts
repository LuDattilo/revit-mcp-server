import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerGetMaterialPropertiesTool(server: McpServer) {
  server.tool(
    "get_material_properties",
    "Get detailed physical, structural, and thermal properties of a specific Revit material. Provide either materialId or materialName.\n\nGUIDANCE:\n- Detailed info: structural, thermal, and appearance properties\n- Compare materials: call for multiple materialIds\n- Use get_materials first to find the materialId\n\nTIPS:\n- Not all materials have structural/thermal properties defined\n- Appearance properties include color, transparency, texture info\n- Use for material specification documentation",
    {
      materialId: z
        .number()
        .optional()
        .describe("The Revit element ID of the material"),
      materialName: z
        .string()
        .optional()
        .describe(
          "The name of the material to look up (case-insensitive exact match, used if materialId is not provided)"
        ),
    },
    async (args, extra) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("get_material_properties", {
            ...args,
          });
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Get material properties failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
