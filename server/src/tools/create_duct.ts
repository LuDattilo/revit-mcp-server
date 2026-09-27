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

export function registerCreateDuctTool(server: McpServer) {
  server.tool(
    "create_duct",
    "Create straight ducts (Duct.Create) between start and end points in mm. Give diameter_mm for a round duct, or width_mm + height_mm for a rectangular/oval duct. When ductTypeName is omitted, the first duct type with the matching shape is used. All ducts are created in one transaction named 'create_duct' and the batch is all-or-nothing. Returns per duct: elementId, typeName, systemName, systemClassification, levelName, size, width_mm/height_mm or diameter_mm, length_mm, start_mm/end_mm (internal).\n\nTIPS:\n- systemTypeName is a duct (mechanical) system type, e.g. 'Supply Air', 'Return Air', 'Exhaust Air'.\n- Z values are absolute elevations, not offsets from the level.",
    {
      ducts: z
        .array(
          z.object({
            start_mm: pointMmSchema.describe("Start point (mm)"),
            end_mm: pointMmSchema.describe("End point (mm)"),
            width_mm: z.number().positive().optional().describe("Width in mm (rectangular/oval)"),
            height_mm: z.number().positive().optional().describe("Height in mm (rectangular/oval)"),
            diameter_mm: z.number().positive().optional().describe("Diameter in mm (round)"),
            systemTypeName: z.string().describe("Duct system type name"),
            ductTypeName: z
              .string()
              .optional()
              .describe("Duct type name (default: first duct type of the matching shape)"),
            levelName: z.string().describe("Reference level name"),
          })
        )
        .min(1)
        .describe("Ducts to create"),
      coordinateSystem: coordinateSystemSchema.optional().default("internal"),
      dryRun: dryRunSchema,
    },
    async (args) => {
      const params = definedOnly(args);
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_duct", params);
        }, 150000);
        return rawToolResponse("create_duct", response);
      } catch (error) {
        return rawToolError("create_duct", `Create duct failed: ${errorMessage(error)}`);
      }
    }
  );
}
