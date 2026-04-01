import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerAlignViewportsTool(server: McpServer) {
  server.tool(
    "align_viewports",
    "Align viewports on sheets to match a reference viewport position. Use a source viewport as reference and align multiple target viewports to the same position. Supports alignment by sheet placement or model coordinates. Inspired by DiRoots ViewAligner.\n\nGUIDANCE:\n- Align to reference: pick a referenceViewportId, then align other viewports to match\n- Cross-sheet alignment: align same view type across multiple sheets\n- Consistent layouts: ensure floor plans align on all sheets\n\nTIPS:\n- Reference viewport position is preserved, others move to match\n- Works across different sheets\n- Use after batch_create_sheets + place_viewport for consistent sheet sets\n- Aligns by viewport center point",
    {
      sourceViewportId: z.number().describe("ID of the reference viewport to align to."),
      targetViewportIds: z.array(z.number()).describe("IDs of viewports to align."),
      alignMode: z.enum(["placement", "coordinates"]).optional().describe("Alignment mode: 'placement' matches position on sheet, 'coordinates' matches model coordinates. Default: placement."),
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
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }], isError: true };
      } catch (error) {
        return { content: [{ type: "text", text: `Align viewports failed: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    }
  );
}
