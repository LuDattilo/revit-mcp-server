import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { withRevitConnection } from "../utils/ConnectionManager.js";
export function registerRenameFamiliesTool(server) {
    server.tool("rename_families", "Batch rename Revit families with prefix, suffix, or find-and-replace operations.\n\nGUIDANCE:\n- Add prefix: operation=\"prefix\", prefix=\"NEW_\"\n- Add suffix: operation=\"suffix\", suffix=\"_v2\"\n- Find and replace: operation=\"find_replace\", findText=\"old\", replaceText=\"new\"\n\nTIPS:\n- Preview changes first with dryRun=true before committing\n- Filter by categories to target specific family types\n- Use renameTypes=true to also rename family type names\n- Supports whole_model, active_view, or selection scope", {
        operation: z
            .enum(["prefix", "suffix", "find_replace"])
            .describe("Type of rename operation to perform"),
        prefix: z
            .string()
            .optional()
            .describe("Prefix to add (for \"prefix\" operation)"),
        suffix: z
            .string()
            .optional()
            .describe("Suffix to add (for \"suffix\" operation)"),
        findText: z
            .string()
            .optional()
            .describe("Text to find (for \"find_replace\" operation)"),
        replaceText: z
            .string()
            .optional()
            .describe("Replacement text (for \"find_replace\" operation)"),
        categories: z
            .array(z.string())
            .optional()
            .describe("Filter by categories (e.g. [\"Doors\", \"Windows\"])"),
        scope: z
            .enum(["whole_model", "active_view", "selection"])
            .optional()
            .default("whole_model")
            .describe("Scope of elements to consider"),
        renameTypes: z
            .boolean()
            .optional()
            .default(false)
            .describe("If true, also rename family type (FamilySymbol) names"),
        dryRun: z
            .boolean()
            .optional()
            .default(true)
            .describe("If true, only previews changes without applying. Set to false to apply."),
    }, async (args, extra) => {
        const params = {
            operation: args.operation,
            prefix: args.prefix ?? "",
            suffix: args.suffix ?? "",
            findText: args.findText ?? "",
            replaceText: args.replaceText ?? "",
            categories: args.categories ?? [],
            scope: args.scope ?? "whole_model",
            renameTypes: args.renameTypes ?? false,
            dryRun: args.dryRun ?? true,
        };
        try {
            const response = await withRevitConnection(async (revitClient) => {
                return await revitClient.sendCommand("rename_families", params);
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
                        text: `Rename families failed: ${errorMessage(error)}`,
                    },
                ],
                isError: true,
            };
        }
    });
}
