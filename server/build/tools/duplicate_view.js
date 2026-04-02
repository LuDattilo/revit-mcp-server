import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { withRevitConnection } from "../utils/ConnectionManager.js";
export function registerDuplicateViewTool(server) {
    server.tool("duplicate_view", "Duplicate one or more views with options: independent copy, dependent (linked to parent), or with detailing (copies annotations). Supports custom name prefix/suffix.\n\nGUIDANCE:\n- Independent copy: duplicateType=\"independent\" — separate crop/annotations\n- Dependent copy: duplicateType=\"dependent\" — synced with parent view\n- With detailing: duplicateType=\"withDetailing\" — copies annotations too\n\nTIPS:\n- Independent views are fully separate from the original\n- Dependent views stay linked — changes to one affect the other\n- Use apply_view_template after duplicating for consistent standards\n- Use batch_rename to organize duplicated view names", {
        viewIds: z
            .array(z.number())
            .describe("View IDs to duplicate"),
        duplicateOption: z
            .enum(["duplicate", "dependent", "withDetailing"])
            .optional()
            .describe("Duplication mode: duplicate (independent), dependent (linked), withDetailing (copies annotations)"),
        newNamePrefix: z
            .string()
            .optional()
            .describe("Prefix for the new view name"),
        newNameSuffix: z
            .string()
            .optional()
            .describe("Suffix for the new view name"),
    }, async (args, extra) => {
        const params = {
            viewIds: args.viewIds,
            duplicateOption: args.duplicateOption ?? "duplicate",
            newNamePrefix: args.newNamePrefix ?? "",
            newNameSuffix: args.newNameSuffix ?? "",
        };
        try {
            const response = await withRevitConnection(async (revitClient) => {
                return await revitClient.sendCommand("duplicate_view", params);
            });
            return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
        }
        catch (error) {
            return { content: [{ type: "text", text: `Duplicate view failed: ${errorMessage(error)}` }], isError: true };
        }
    });
}
