import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateElevationsFromRoomsTool(server: McpServer) {
  server.tool(
    "create_elevations_from_rooms",
    "Create interior elevation or section views from rooms. Each room gets elevation views for selected directions (north/south/east/west) fitted to its boundary with configurable offset. Supports custom naming patterns with {RoomName}, {RoomNumber}, {Direction}, {Level} placeholders.\n\nGUIDANCE:\n- Creates interior elevations looking inward at each room wall\n- Default: all 4 directions per room. Use 'directions' to limit.\n- viewType='section' creates section cuts instead of elevations\n- Use export_room_data first to see available rooms and their IDs\n- Apply view templates via viewTemplateId parameter\n- Created views can be placed on sheets with place_viewport",
    {
      roomIds: z.array(z.number()).optional().describe("Specific room IDs to create elevations for. If omitted, processes all placed rooms."),
      viewType: z.enum(["elevation", "section"]).optional().describe("Type of view to create. Default: elevation."),
      directions: z.array(z.enum(["north", "south", "east", "west"])).optional().describe("Which directions to create elevations for. Default: all four directions."),
      scale: z.number().optional().describe("View scale (e.g. 50 for 1:50). Default: 50."),
      offset: z.number().optional().describe("Offset from room boundary in mm. Default: 300."),
      viewTemplateId: z.number().optional().describe("Element ID of view template to apply."),
      namingPattern: z.string().optional().describe("Naming pattern with placeholders: {RoomName}, {RoomNumber}, {Direction}, {Level}. Default: '{RoomName} - {Direction}'."),
    },
    async (args, extra) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_elevations_from_rooms", {
            roomIds: args.roomIds ?? [],
            viewType: args.viewType ?? "elevation",
            directions: args.directions ?? ["north", "south", "east", "west"],
            scale: args.scale ?? 50,
            offset: args.offset ?? 300,
            viewTemplateId: args.viewTemplateId ?? -1,
            namingPattern: args.namingPattern ?? "{RoomName} - {Direction}",
          });
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Create elevations from rooms failed: ${errorMessage(error)}` }], isError: true };
      }
    }
  );
}
