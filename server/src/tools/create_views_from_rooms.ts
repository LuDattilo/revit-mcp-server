import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateViewsFromRoomsTool(server: McpServer) {
  server.tool(
    "create_views_from_rooms",
    "Automatically create Callout, Section, or Elevation views from rooms. Each room gets views fitted to its boundary with configurable offset. Supports custom naming patterns with {RoomNumber}, {RoomName}, {Level} placeholders.\n\nGUIDANCE:\n- Callout views: viewType=\"callout\" — creates cropped plan views per room\n- Section views: viewType=\"section\" — creates sections through each room\n- Elevation views: viewType=\"elevation\" — creates 4 interior elevations per room\n- All rooms: set allRooms=true or provide specific roomIds\n\nTIPS:\n- Use export_room_data first to see available rooms and their IDs\n- Naming pattern supports: {RoomNumber}, {RoomName}, {Level} placeholders\n- Apply view templates after creation with apply_view_template\n- Created views can be placed on sheets with place_viewport",
    {
      roomIds: z.array(z.number()).optional().describe("Room IDs to create views for. If omitted, processes all placed rooms."),
      allRooms: z.boolean().optional().describe("Process all rooms. Default: true when no roomIds specified."),
      viewType: z.enum(["callout", "section", "elevation"]).optional().describe("Type of view to create. 'elevation' creates 4 views (N/E/S/W). Default: callout."),
      offsetMm: z.number().optional().describe("Offset buffer around room boundary in mm. Default: 500."),
      scale: z.number().optional().describe("View scale (e.g. 50 for 1:50). Default: 50."),
      detailLevel: z.enum(["Coarse", "Medium", "Fine"]).optional().describe("Detail level. Default: Medium."),
      viewTemplateName: z.string().optional().describe("Name of view template to apply."),
      namingPattern: z.string().optional().describe("Naming pattern with placeholders: {RoomNumber}, {RoomName}, {Level}. Default: '{RoomNumber} - {RoomName}'."),
    },
    async (args, extra) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_views_from_rooms", {
            roomIds: args.roomIds ?? [],
            allRooms: args.allRooms ?? (args.roomIds === undefined || args.roomIds.length === 0),
            viewType: args.viewType ?? "callout",
            offsetMm: args.offsetMm ?? 500,
            scale: args.scale ?? 50,
            detailLevel: args.detailLevel ?? "Medium",
            viewTemplateName: args.viewTemplateName ?? "",
            namingPattern: args.namingPattern ?? "{RoomNumber} - {RoomName}",
          });
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Create views from rooms failed: ${errorMessage(error)}` }], isError: true };
      }
    }
  );
}
