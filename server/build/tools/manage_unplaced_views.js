import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { withRevitConnection } from "../utils/ConnectionManager.js";
export function registerManageUnplacedViewsTool(server) {
    server.tool("manage_unplaced_views", "Identify and optionally delete views that are not placed on any sheet. Defaults to list-only mode for safety.\n\nGUIDANCE:\n- List unplaced views: action=\"list\" (default, always safe)\n- Delete with preview: action=\"delete\", dryRun=true (default) shows what would be deleted\n- Delete for real: action=\"delete\", dryRun=false — DESTRUCTIVE, cannot be undone\n\nTIPS:\n- Always preview before deleting — dryRun defaults to true for safety\n- Use viewTypes filter to target specific view kinds (FloorPlan, Section, etc.)\n- Use filterName to match views by name pattern\n- View templates and system browser views are always excluded\n- Sheets themselves are never deleted by this tool", {
        action: z
            .enum(["list", "delete"])
            .optional()
            .default("list")
            .describe("Action to perform. 'list' only reports unplaced views (safe). 'delete' removes them (defaults to dryRun preview)."),
        viewTypes: z
            .array(z.enum([
            "FloorPlan",
            "CeilingPlan",
            "Section",
            "Elevation",
            "ThreeDimensional",
            "DraftingView",
            "Legend",
            "AreaPlan",
            "StructuralPlan",
            "Detail",
            "Rendering",
            "Walkthrough",
        ]))
            .optional()
            .describe("Filter by view types. If omitted, all view types are included."),
        filterName: z
            .string()
            .optional()
            .describe("Only include views whose name contains this text (case-insensitive)."),
        excludeNames: z
            .array(z.string())
            .optional()
            .describe("Exclude views whose name contains any of these strings."),
        dryRun: z
            .boolean()
            .optional()
            .default(true)
            .describe("For delete action: if true (default), only previews what would be deleted without actually deleting. Set to false to actually delete."),
        maxResults: z
            .number()
            .optional()
            .default(500)
            .describe("Maximum number of views to return in the response."),
    }, async (args, extra) => {
        const params = {
            action: args.action ?? "list",
            viewTypes: args.viewTypes ?? [],
            filterName: args.filterName ?? "",
            excludeNames: args.excludeNames ?? [],
            dryRun: args.dryRun ?? true,
            maxResults: args.maxResults ?? 500,
        };
        try {
            const response = await withRevitConnection(async (revitClient) => {
                return await revitClient.sendCommand("manage_unplaced_views", params);
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
                        text: `Manage unplaced views failed: ${errorMessage(error)}`,
                    },
                ],
                isError: true,
            };
        }
    });
}
