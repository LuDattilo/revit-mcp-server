import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerSaveSelectionTool(server: McpServer) {
  server.tool(
    "save_selection",
    "Save a named selection of elements in Revit using SelectionFilterElement (native Saved Selection).\n\nGUIDANCE:\n- Save current Revit UI selection by name for later reuse\n- Optionally specify explicit element IDs instead of using current selection\n- Use overwrite=true to replace an existing saved selection\n\nTIPS:\n- Saved selections persist in the Revit document\n- Use load_selection to recall saved selections later\n- Use delete_selection to remove saved selections",
    {
      name: z
        .string()
        .describe("Name for the saved selection"),
      elementIds: z
        .array(z.number())
        .optional()
        .describe("Specific element IDs to save. If omitted, saves current Revit selection"),
      overwrite: z
        .boolean()
        .optional()
        .default(false)
        .describe("If true, overwrite an existing selection with the same name"),
    },
    async (args, extra) => {
      const params = {
        name: args.name,
        elementIds: args.elementIds,
        overwrite: args.overwrite ?? false,
      };

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("save_selection", params);
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
              text: `save selection failed: ${
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
