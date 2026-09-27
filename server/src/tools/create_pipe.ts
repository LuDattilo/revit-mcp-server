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

export function registerCreatePipeTool(server: McpServer) {
  server.tool(
    "create_pipe",
    "Create straight pipes (Pipe.Create) between start and end points in mm. All pipes are created in one transaction named 'create_pipe' and the batch is all-or-nothing: if any pipe fails, nothing is kept and the error names the failing index. Returns per pipe: elementId, typeName, systemName, systemClassification, levelName, size, diameter_mm (actual, may snap to the nearest size in the pipe type's routing preferences), length_mm, start_mm/end_mm (internal).\n\nTIPS:\n- systemTypeName is a piping system type (e.g. 'Domestic Cold Water', 'Sanitary'); get names from get_mep_systems or the project browser.\n- Z values are absolute elevations (internal or shared), not offsets from the level.",
    {
      pipes: z
        .array(
          z.object({
            start_mm: pointMmSchema.describe("Start point (mm)"),
            end_mm: pointMmSchema.describe("End point (mm)"),
            diameter_mm: z.number().positive().describe("Nominal diameter in mm"),
            systemTypeName: z.string().describe("Piping system type name"),
            pipeTypeName: z
              .string()
              .optional()
              .describe("Pipe type name (default: first pipe type)"),
            levelName: z.string().describe("Reference level name"),
          })
        )
        .min(1)
        .describe("Pipes to create"),
      coordinateSystem: coordinateSystemSchema.optional().default("internal"),
      dryRun: dryRunSchema,
    },
    async (args) => {
      const params = definedOnly(args);
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_pipe", params);
        }, 150000);
        return rawToolResponse("create_pipe", response);
      } catch (error) {
        return rawToolError("create_pipe", `Create pipe failed: ${errorMessage(error)}`);
      }
    }
  );
}
