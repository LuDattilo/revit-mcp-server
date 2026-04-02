import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerSaveSelectionTool(server: McpServer) {
  server.tool(
    "save_selection",
    "Save the current element selection with a name for later recall.",
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
