import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";
import { rawToolResponse, rawToolError } from "../utils/compactTool.js";
import { definedOnly, dryRunSchema, pointMmSchema } from "../utils/siteMepSchemas.js";

export function registerSetSharedCoordinatesTool(server: McpServer) {
  server.tool(
    "set_shared_coordinates",
    "Set the shared coordinates of the active project location (ProjectLocation.SetProjectPosition) so that an internal point (default the internal origin 0,0,0) maps to the given East/West, North/South, elevation (mm) with the given angle to true north (deg). Equivalent to Revit's 'Specify Coordinates at Point'. Runs in one transaction named 'set_shared_coordinates'. Returns before/after snapshots (same shape as get_project_location) plus the shared coordinates of the internal point before and after.\n\nUse dryRun=true to preview.",
    {
      eastWest_mm: z.number().describe("Shared East/West coordinate (mm) the internal point should have"),
      northSouth_mm: z.number().describe("Shared North/South coordinate (mm) the internal point should have"),
      elevation_mm: z.number().describe("Shared elevation (mm) the internal point should have"),
      angleToTrueNorth_deg: z
        .number()
        .describe("Angle from project north to true north in degrees (Revit's 'Angle to True North')"),
      internalPoint_mm: pointMmSchema
        .optional()
        .describe("Internal-coordinate point (mm) to pin to the shared coordinates. Default {x:0,y:0,z:0}."),
      locationName: z
        .string()
        .optional()
        .describe("Optional: rename the active project location (site) to this name"),
      dryRun: dryRunSchema,
    },
    async (args) => {
      const params = definedOnly(args);
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("set_shared_coordinates", params);
        }, 60000);
        return rawToolResponse("set_shared_coordinates", response);
      } catch (error) {
        return rawToolError(
          "set_shared_coordinates",
          `Set shared coordinates failed: ${errorMessage(error)}`
        );
      }
    }
  );
}
