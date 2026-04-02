import { errorMessage } from "../utils/errorUtils.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";
export function registerGetCurrentViewInfoTool(server) {
    server.tool("get_current_view_info", "Get details about the active view (type, scale, crop, etc.).", {}, async (args, extra) => {
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
        }
        catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `get current view info failed: ${errorMessage(error)}`,
                    },
                ],
                isError: true,
            };
        }
    });
}
