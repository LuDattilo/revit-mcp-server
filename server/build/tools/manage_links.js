import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { withRevitConnection } from "../utils/ConnectionManager.js";
export function registerManageLinksTool(server) {
    server.tool("manage_links", "List, reload, unload, or remove linked Revit/CAD/IFC files.", {
        action: z
            .enum(["list", "reload", "unload"])
            .describe("Action: 'list' shows all links, 'reload' reloads a link, 'unload' unloads a link"),
        linkId: z
            .number()
            .optional()
            .describe("Link element ID (required for reload/unload actions)"),
    }, async (args, extra) => {
        const params = {
            action: args.action,
            linkId: args.linkId ?? 0,
        };
        try {
            const response = await withRevitConnection(async (revitClient) => {
                return await revitClient.sendCommand("manage_links", params);
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
                        text: `Manage links failed: ${errorMessage(error)}`,
                    },
                ],
                isError: true,
            };
        }
    });
}
