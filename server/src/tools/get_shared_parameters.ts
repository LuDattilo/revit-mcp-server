import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerGetSharedParametersTool(server: McpServer) {
  server.tool(
    "get_shared_parameters",
    "List all project parameters (shared and non-shared) bound to categories in the current Revit project. Can filter by category name.\n\nGUIDANCE:\n- List all project parameters: shows shared and non-shared params with bindings\n- Audit parameters: check which categories each parameter is bound to\n- Use before add_shared_parameter to avoid duplicates\n\nTIPS:\n- Shows both shared parameters and project parameters\n- Binding info tells you which categories the parameter appears on\n- Use manage_project_parameters for CRUD operations on project parameters",
    {
      categoryFilter: z
        .string()
        .optional()
        .describe(
          "Optional category name filter. Returns only parameters bound to categories whose name contains this string (case-insensitive)."
        ),
    },
    async (args, extra) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("get_shared_parameters", {
            categoryFilter: args.categoryFilter,
          });
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
              text: `Get shared parameters failed: ${
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
