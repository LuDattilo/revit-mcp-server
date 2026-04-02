import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerExportRoomDataTool(server: McpServer) {
  server.tool(
    "export_room_data",
    "Export room data from the current Revit project. Returns detailed information about each room including name, number, level, area, volume, perimeter, department, and more. Useful for generating room schedules, space analysis, and facility management data.\n\nOPTIMIZATION:\n- Use 'fields' to request only needed properties — dramatically reduces response tokens\n- Use 'maxResults' to limit rooms returned (default 100). Response includes truncated flag and totalCount.\n- Example: fields=['Name','Number','Area','Level'] returns ~70% fewer tokens per room\n\nGUIDANCE:\n- Get all rooms: returns name, number, area, volume, level, department, boundaries\n- Use room data for space analysis, area calculations, or BIM validation\n- Room boundaries can be used with create_floor to auto-generate floors\n\nTIPS:\n- Only returns placed rooms with valid area > 0\n- Area and volume are in the project's display units\n- Combine with create_views_from_rooms to auto-create room views\n- Use get_elements_in_spatial_volume to find what's inside each room",
    {
      includeUnplacedRooms: z
        .boolean()
        .optional()
        .default(false)
        .describe("Whether to include unplaced rooms (rooms not yet placed in the model). Defaults to false."),
      includeNotEnclosedRooms: z
        .boolean()
        .optional()
        .default(false)
        .describe("Whether to include rooms that are not fully enclosed. Defaults to false."),
      maxResults: z
        .number()
        .optional()
        .default(100)
        .describe("Maximum rooms to return. Default 100. Response includes truncated:true and totalCount when limited."),
      fields: z
        .array(z.string())
        .optional()
        .describe("Specific fields to include per room (e.g. ['Name','Number','Area','Level']). Omit for all fields. Available: Name, Number, Level, Area, Volume, Perimeter, UnboundedHeight, Department, Comments, Phase, Occupancy, Id, UniqueId."),
    },
    async (args, extra) => {
      const params: Record<string, unknown> = {
        includeUnplacedRooms: args.includeUnplacedRooms ?? false,
        includeNotEnclosedRooms: args.includeNotEnclosedRooms ?? false,
        maxResults: args.maxResults ?? 100,
      };
      if (args.fields && args.fields.length > 0) {
        params.fields = args.fields;
      }

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("export_room_data", params);
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
              text: `Export room data failed: ${
                errorMessage(error)
              }`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
