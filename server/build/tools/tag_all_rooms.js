import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { withRevitConnection } from "../utils/ConnectionManager.js";
export function registerTagAllRoomsTool(server) {
    server.tool("tag_all_rooms", "Create tags for all rooms in the current active view. Tags will be placed at the center point of each room, displaying the room name and number.\n\nGUIDANCE:\n- Tag all rooms in active view: call with no parameters\n- Tags show room name and number\n- Run after create_room to annotate placed rooms\n\nTIPS:\n- Only tags rooms in the current plan view\n- Rooms must be placed first (use create_room)\n- Tags require a room tag family loaded in the project\n- Reposition tags manually in Revit if overlapping", {
        useLeader: z
            .boolean()
            .optional()
            .default(false)
            .describe("Whether to use a leader line when creating the tags"),
        tagTypeId: z
            .string()
            .optional()
            .describe("The ID of the specific room tag family type to use. If not provided, the default room tag type will be used"),
        roomIds: z
            .array(z.number())
            .optional()
            .describe("Optional array of specific room element IDs to tag. If not provided, all rooms in the current view will be tagged"),
    }, async (args, extra) => {
        const params = args;
        try {
            const response = await withRevitConnection(async (revitClient) => {
                return await revitClient.sendCommand("tag_rooms", params);
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
                        text: `Room tagging failed: ${errorMessage(error)}`,
                    },
                ],
                isError: true,
            };
        }
    });
}
