import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerDeleteElementTool(server: McpServer) {
  server.tool(
    "delete_element",
    "Delete one or more elements from the Revit model by their element IDs.\n\nGUIDANCE:\n- Delete by ID: provide elementIds array to remove specific elements\n- Delete selected: use get_selected_elements first to get IDs, then delete\n- Batch cleanup: combine with ai_element_filter to find and delete unwanted elements\n\nTIPS:\n- IRREVERSIBLE in the current session — use with caution\n- Delete will fail for elements with dependencies (hosted elements, etc.)\n- Consider hiding elements instead if unsure about deletion\n- Always verify element IDs before deleting",
    {
      elementIds: z
        .array(z.string())
        .describe("The IDs of the elements to delete"),
    },
    async (args, extra) => {
      const params = {
        elementIds: args.elementIds,
      };

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("delete_element", params);
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
              text: `delete element failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
