import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";
import { rawToolResponse, rawToolError } from "../utils/compactTool.js";
import {
  coordinateSystemSchema,
  definedOnly,
  dryRunSchema,
  pointMmSchema,
} from "../utils/siteMepSchemas.js";

export function registerCreateToposolidTool(server: McpServer) {
  server.tool(
    "create_toposolid",
    "Create a toposolid (Revit 2024+) from survey points using Toposolid.Create (points-based overload). Points are (x,y,z) in mm; the top surface is triangulated through them and the outline is their convex hull. Runs in one transaction named 'create_toposolid'. Returns elementId, pointCount (slab-shape vertices), boundingBox_mm (internal coordinates), type and level.\n\nTIPS:\n- Use coordinateSystem='shared' to pass surveyed E/N/elevation directly.\n- 'name' is stored in the toposolid's Comments parameter (toposolids have no Name).\n- Use dryRun=true to validate without keeping the element.",
    {
      points_mm: z
        .array(pointMmSchema)
        .min(3)
        .describe("Surface points in mm (at least 3, no two with the same x,y)"),
      coordinateSystem: coordinateSystemSchema.optional().default("internal"),
      toposolidTypeName: z
        .string()
        .optional()
        .describe("Toposolid type name (default: first toposolid type in the project)"),
      levelName: z
        .string()
        .optional()
        .describe("Level to host the toposolid (default: the level closest to elevation 0)"),
      name: z
        .string()
        .optional()
        .describe("Optional label, written to the Comments parameter"),
      dryRun: dryRunSchema,
    },
    async (args) => {
      const params = definedOnly(args);
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_toposolid", params);
        }, 150000);
        return rawToolResponse("create_toposolid", response);
      } catch (error) {
        return rawToolError(
          "create_toposolid",
          `Create toposolid failed: ${errorMessage(error)}`
        );
      }
    }
  );
}
