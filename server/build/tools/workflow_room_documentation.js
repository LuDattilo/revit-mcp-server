import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { withRevitConnection } from "../utils/ConnectionManager.js";
import { addSuggestions, suggestIf } from "../utils/suggestions.js";
export function registerWorkflowRoomDocumentationTool(server) {
    server.tool("workflow_room_documentation", "Auto-generate room documentation: plans, sections, schedules.", {
        levelName: z.string().optional()
            .describe("Filter rooms by level name. If omitted, all rooms in the model are included."),
        createSections: z.boolean().optional().default(true)
            .describe("Create callout section views from each room's bounding box. Default true."),
        offset: z.number().optional().default(300)
            .describe("Section view boundary offset in mm. Default: 300."),
    }, async (args) => {
        try {
            const response = await withRevitConnection(async (revitClient) => {
                return await revitClient.sendCommand("workflow_room_documentation", {
                    levelName: args.levelName ?? "",
                    createSections: args.createSections ?? true,
                    offset: args.offset ?? 300,
                });
            });
            const data = typeof response === 'object' ? response?.data ?? response : response;
            const roomCount = data?.roomCount ?? 0;
            const viewsCreated = data?.viewsCreated ?? 0;
            const enriched = addSuggestions(response, [
                suggestIf(roomCount > 0, "Create a room schedule", "Organize room data into a formal schedule view"),
                suggestIf(roomCount > 0, "Export room data to Excel", "Save room information for external review"),
                suggestIf(viewsCreated > 0, "Place the new room views on sheets", "Created views need to be placed on documentation sheets"),
            ]);
            return { content: [{ type: "text", text: JSON.stringify(enriched, null, 2) }] };
        }
        catch (error) {
            return { content: [{ type: "text", text: `Workflow room documentation failed: ${errorMessage(error)}` }], isError: true };
        }
    });
}
