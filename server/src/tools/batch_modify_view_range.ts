import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerBatchModifyViewRangeTool(server: McpServer) {
  server.tool(
    "batch_modify_view_range",
    "Batch modify View Range settings (Top, Cut Plane, Bottom, View Depth offsets) on multiple plan views at once. Only specified offsets are changed; others remain unchanged.\n\nGUIDANCE:\n- Set cut plane: modify cut plane height for multiple plan views at once\n- Adjust bottom: change bottom clip offset for views\n- Standardize: apply same view range settings across all floor plans\n\nTIPS:\n- View range only applies to plan views (floor plans, ceiling plans)\n- Heights are relative to the associated level\n- Use get_current_view_info to check current view range settings\n- Changes affect element visibility in plan views",
    {
      viewIds: z.array(z.number()).describe("IDs of plan views to modify."),
      topOffsetMm: z.number().optional().describe("Top clip plane offset from level in mm."),
      cutPlaneOffsetMm: z.number().optional().describe("Cut plane offset from level in mm (typically 1200mm)."),
      bottomOffsetMm: z.number().optional().describe("Bottom clip plane offset from level in mm."),
      viewDepthOffsetMm: z.number().optional().describe("View depth plane offset from level in mm."),
    },
    async (args, extra) => {
      try {
        const params: any = { viewIds: args.viewIds };
        if (args.topOffsetMm !== undefined) params.topOffsetMm = args.topOffsetMm;
        if (args.cutPlaneOffsetMm !== undefined) params.cutPlaneOffsetMm = args.cutPlaneOffsetMm;
        if (args.bottomOffsetMm !== undefined) params.bottomOffsetMm = args.bottomOffsetMm;
        if (args.viewDepthOffsetMm !== undefined) params.viewDepthOffsetMm = args.viewDepthOffsetMm;

        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("batch_modify_view_range", params);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Batch modify view range failed: ${errorMessage(error)}` }], isError: true };
      }
    }
  );
}
