import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerGetWorksetsTool(server: McpServer) {
  server.tool(
    "get_worksets",
    "List all worksets in the current Revit project with their properties. Returns workset name, kind, open/editable status, and owner.\n\nGUIDANCE:\n- List all worksets: returns names, IDs, open/editable status\n- Check before set_element_workset to see available worksets\n- Only available in workshared projects\n\nTIPS:\n- User worksets control element organization in large projects\n- Elements can only be moved to open, editable worksets\n- Use set_element_workset to organize elements by discipline/area",
    {
      includeSystemWorksets: z
        .boolean()
        .optional()
        .describe(
          "Include system worksets such as Family Workset, Project Standards, and Views workset (default: false)"
        ),
    },
    async (args, extra) => {
      const params = {
        includeSystemWorksets: args.includeSystemWorksets ?? false,
      };

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("get_worksets", params);
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
              text: `Get worksets failed: ${
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
