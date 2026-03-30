import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerGetCurrentViewInfoTool(server: McpServer) {
  server.tool(
    "get_current_view_info",
    "Get detailed information about the current active Revit view, including view type, name, scale, and other properties.\n\nGUIDANCE:\n- Check active view: returns view name, type, level, scale, and crop settings\n- Use before create_dimensions or create_text_note to understand view context\n- Verify view type before operations that require specific view types\n\nTIPS:\n- Some operations only work in plan views (e.g. tag_all_rooms)\n- Section/elevation views have different coordinate systems\n- Use create_view to switch to a different view type if needed",
    {},
    async (args, extra) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("get_current_view_info", {});
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
              text: `get current view info failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
