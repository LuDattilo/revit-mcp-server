import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";
import { rawToolResponse, rawToolError } from "../utils/compactTool.js";

export function registerGetToposolidsTool(server: McpServer) {
  server.tool(
    "get_toposolids",
    "List toposolids (Revit 2024+) with elementId, typeName, levelName, comments, pointCount (slab-shape vertex count), isSubDivision and boundingBox_mm. With includePoints=true also returns points_mm: the slab-shape vertex positions in mm, INTERNAL coordinates (convert with get_project_location's sharedTransform if you need shared).",
    {
      includePoints: z
        .boolean()
        .optional()
        .describe("Include slab-shape vertex points (mm, internal coordinates). Default false."),
    },
    async (args) => {
      const params = { includePoints: args.includePoints ?? false };
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("get_toposolids", params);
        }, 90000);
        return rawToolResponse("get_toposolids", response);
      } catch (error) {
        return rawToolError(
          "get_toposolids",
          `Get toposolids failed: ${errorMessage(error)}`
        );
      }
    }
  );
}
