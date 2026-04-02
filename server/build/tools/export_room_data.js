import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { withRevitConnection } from "../utils/ConnectionManager.js";
export function registerExportRoomDataTool(server) {
    server.tool("export_room_data", "Export all room data from the current Revit project. Returns detailed information about each room including name, number, level, area, volume, perimeter, department, and more. Useful for generating room schedules, space analysis, and facility management data.\n\nGUIDANCE:\n- Get all rooms: returns name, number, area, volume, level, department, boundaries\n- Use room data for space analysis, area calculations, or BIM validation\n- Room boundaries can be used with create_floor to auto-generate floors\n\nTIPS:\n- Only returns placed rooms with valid area > 0\n- Area and volume are in the project's display units\n- Combine with create_views_from_rooms to auto-create room views\n- Use get_elements_in_spatial_volume to find what's inside each room", {
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
    }, async (args, extra) => {
        const params = {
            includeUnplacedRooms: args.includeUnplacedRooms ?? false,
            includeNotEnclosedRooms: args.includeNotEnclosedRooms ?? false,
        };
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
        }
        catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Export room data failed: ${errorMessage(error)}`,
                    },
                ],
                isError: true,
            };
        }
    });
}
