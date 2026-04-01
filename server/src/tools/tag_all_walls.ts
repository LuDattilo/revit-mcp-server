import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerTagAllWallsTool(server: McpServer) {
  server.tool(
    "tag_all_walls",
    "Create tags for all walls in the current active view. Tags will be placed at the middle point of each wall.\n\nGUIDANCE:\n- Tag all walls in active view: call with no parameters\n- Tags show wall type information by default\n- Run after creating walls to annotate the drawing\n\nTIPS:\n- Only tags walls visible in the current view\n- Tags require a wall tag family loaded in the project\n- Use batch_rename to update tag text formatting",
    {
      useLeader: z
        .boolean()
        .optional()
        .default(false)
        .describe("Whether to use a leader line when creating the tags"),
      tagTypeId: z
        .string()
        .optional()
        .describe("The ID of the specific wall tag family type to use. If not provided, the default wall tag type will be used"),
    },
    async (args, extra) => {
      const params = args;
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("tag_walls", params);
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
              text: `Wall tagging failed: ${
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