import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerLoadSelectionTool(server: McpServer) {
  server.tool(
    "load_selection",
    "Load a saved selection by name, or list all saved selections if no name is provided.\n\nGUIDANCE:\n- List all saved selections: call without a name\n- Load a specific selection: provide the name\n- Optionally select the elements in the current view\n\nTIPS:\n- Use save_selection to create named selections first\n- Returns element IDs that can be used with other tools\n- Set selectInView=false to get IDs without changing Revit UI selection",
    {
      name: z
        .string()
        .optional()
        .describe("Name of the saved selection to load. If omitted, lists all saved selections"),
      selectInView: z
        .boolean()
        .optional()
        .default(true)
        .describe("If true, select the elements in the current Revit view"),
    },
    async (args, extra) => {
      const params = {
        name: args.name,
        selectInView: args.selectInView ?? true,
      };

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("load_selection", params);
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
              text: `load selection failed: ${
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
