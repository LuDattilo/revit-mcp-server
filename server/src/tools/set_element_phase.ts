import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerSetElementPhaseTool(server: McpServer) {
  server.tool(
    "set_element_phase",
    "Set the created and/or demolished phase on Revit elements. Use get_phases first to get valid phase IDs.\n\nGUIDANCE:\n- Set created phase: elementIds, createdPhase=\"New Construction\"\n- Set demolished phase: elementIds, demolishedPhase=\"Existing\"\n- Renovation workflow: mark existing elements as demolished, new as new construction\n\nTIPS:\n- Use get_phases first to see available phase names\n- Phase controls element visibility in phased views\n- Both createdPhase and demolishedPhase can be set in one call",
    {
      requests: z
        .array(
          z.object({
            elementId: z.number().describe("Revit element ID"),
            createdPhaseId: z
              .number()
              .optional()
              .describe("Phase ID to set as the created phase for the element"),
            demolishedPhaseId: z
              .number()
              .optional()
              .describe(
                "Phase ID to set as the demolished phase for the element"
              ),
          })
        )
        .describe(
          "Array of phase assignment requests. At least one of createdPhaseId or demolishedPhaseId must be provided per request."
        ),
    },
    async (args, extra) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("set_element_phase", {
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
              text: `Set element phase failed: ${
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
