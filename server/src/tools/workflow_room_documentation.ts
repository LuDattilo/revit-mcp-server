import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";
import { addSuggestions, suggestIf } from "../utils/suggestions.js";

export function registerWorkflowRoomDocumentationTool(server: McpServer) {
  server.tool(
    "workflow_room_documentation",
    `Document all rooms in one call: collect room data (number, name, area, volume, level, department), optionally create callout section views from room bounding boxes, and tag all rooms in the active view.

GUIDANCE:
- "Document all rooms on Level 1": levelName="Level 1"
- "Just collect room data without creating views": createSections=false
- "Document rooms with 500mm offset for sections": offset=500
- Use this instead of calling export_room_data + create_callout_from_rooms + tag_all_rooms separately`,
    {
      levelName: z.string().optional()
        .describe("Filter rooms by level name. If omitted, all rooms in the model are included."),
      createSections: z.boolean().optional().default(true)
        .describe("Create callout section views from each room's bounding box. Default true."),
      offset: z.number().optional().default(300)
        .describe("Offset in mm for section view boundaries beyond the room bounding box. Default 300."),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("workflow_room_documentation", {
            levelName: args.levelName ?? "",
            createSections: args.createSections ?? true,
            offset: args.offset ?? 300,
          });
        });

        const data = typeof response === 'object' ? (response as any)?.data ?? response : response;
        const roomCount = data?.roomCount ?? 0;
        const viewsCreated = data?.viewsCreated ?? 0;
        const enriched = addSuggestions(response, [
          suggestIf(roomCount > 0, "Create a room schedule", "Organize room data into a formal schedule view"),
          suggestIf(roomCount > 0, "Export room data to Excel", "Save room information for external review"),
          suggestIf(viewsCreated > 0, "Place the new room views on sheets", "Created views need to be placed on documentation sheets"),
        ]);

        return { content: [{ type: "text" as const, text: JSON.stringify(enriched, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: `Workflow room documentation failed: ${errorMessage(error)}` }], isError: true };
      }
    }
  );
}
