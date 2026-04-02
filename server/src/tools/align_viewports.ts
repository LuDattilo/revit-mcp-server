import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerAlignViewportsTool(server: McpServer) {
  server.tool(
    "align_viewports",
    "Align viewports across sheets by placement or model coordinates.",
    {
      sourceViewportId: z.number().describe("ID of the reference viewport to align to."),
      targetViewportIds: z.array(z.number()).describe("IDs of viewports to align."),
      alignMode: z.enum(["placement", "coordinates"]).optional().describe("'placement' (sheet position) or 'coordinates' (model). Default: placement."),
    },
    async (args, extra) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("align_viewports", {
            sourceViewportId: args.sourceViewportId,
            targetViewportIds: args.targetViewportIds,
            alignMode: args.alignMode ?? "placement",
          });
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Align viewports failed: ${errorMessage(error)}` }], isError: true };
      }
    }
  );
}
