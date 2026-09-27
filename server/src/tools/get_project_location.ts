import { errorMessage } from "../utils/errorUtils.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";
import { rawToolResponse, rawToolError } from "../utils/compactTool.js";

export function registerGetProjectLocationTool(server: McpServer) {
  server.tool(
    "get_project_location",
    "Get the project's georeferencing: active project location (site) name, survey point and project base point in shared coordinates (mm), angle to true north (deg), the internal->shared transform, and site latitude/longitude (deg).\n\nRETURNS: { activeLocationName, surveyPoint: {eastWest_mm, northSouth_mm, elevation_mm, internal_mm, clipped}, projectBasePoint: {eastWest_mm, northSouth_mm, elevation_mm, angleToTrueNorth_deg, internal_mm}, sharedTransform: {origin_mm:{x,y,z}, rotation_deg}, siteLatitude, siteLongitude, siteName, projectLocations }\n\nsharedTransform: shared = R(rotation_deg) * internal + origin_mm, i.e. origin_mm is the shared position of the internal origin.",
    {},
    async () => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("get_project_location", {});
        });
        return rawToolResponse("get_project_location", response);
      } catch (error) {
        return rawToolError(
          "get_project_location",
          `Get project location failed: ${errorMessage(error)}`
        );
      }
    }
  );
}
