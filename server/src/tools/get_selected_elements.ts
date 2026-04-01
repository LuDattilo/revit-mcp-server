import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerGetSelectedElementsTool(server: McpServer) {
  server.tool(
    "get_selected_elements",
    "Get elements currently selected in Revit. You can limit the number of returned elements.\n\nGUIDANCE:\n- Get IDs of manually selected elements in Revit UI\n- Use as starting point for batch operations (modify, delete, copy)\n- Select elements in Revit first, then call this tool\n\nTIPS:\n- Returns empty if nothing is selected in Revit\n- Use the returned IDs with modify_element, delete_element, copy_elements\n- For programmatic selection, use ai_element_filter instead",
    {
      limit: z
        .number()
        .optional()
        .describe("Maximum number of elements to return"),
    },
    async (args, extra) => {
      const params = {
        limit: args.limit || 100,
      };

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("get_selected_elements", params);
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
              text: `get selected elements failed: ${
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
