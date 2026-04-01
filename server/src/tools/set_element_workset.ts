import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerSetElementWorksetTool(server: McpServer) {
  server.tool(
    "set_element_workset",
    "Move elements to a different workset by setting their workset parameter. Project must be workshared.\n\nGUIDANCE:\n- Move elements to workset: provide elementIds and target worksetName\n- Organize by discipline: move MEP elements to MEP workset, etc.\n- Use get_worksets first to see available worksets\n\nTIPS:\n- Only works in workshared projects\n- Target workset must be open and editable\n- Use ai_element_filter to find elements by category for bulk workset assignment",
    {
      requests: z
        .array(
          z.object({
            elementId: z.number().describe("Revit element ID"),
            worksetName: z
              .string()
              .describe("Name of the target workset to move the element to"),
          })
        )
        .describe("Array of workset assignment requests"),
    },
    async (args, extra) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("set_element_workset", {
            requests: args.requests,
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
              text: `Set element workset failed: ${
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
