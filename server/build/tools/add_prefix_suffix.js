import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { withRevitConnection } from "../utils/ConnectionManager.js";
export function registerAddPrefixSuffixTool(server) {
    server.tool("add_prefix_suffix", "Add prefix and/or suffix to existing parameter values without overwriting. At least one of prefix or suffix must be provided.\n\nGUIDANCE:\n- Add prefix: parameterName, prefix=\"PRE-\"\n- Add suffix: parameterName, suffix=\"-SUF\"\n- Add both: parameterName, prefix=\"A\", suffix=\"Z\", separator=\"_\"\n- Filter by category: categories=[\"Walls\",\"Doors\"]\n- Filter by value: filterValue=\"keyword\" to only modify matching elements\n- Preview with dryRun=true before committing changes\n\nTIPS:\n- Use separator to control spacing between prefix/suffix and original value\n- skipEmpty=true (default) avoids modifying empty values\n- Use scope to limit to active_view or selection", {
        parameterName: z.string().describe("Name of the parameter to modify."),
        prefix: z.string().optional().describe("Prefix to prepend to existing value."),
        suffix: z.string().optional().describe("Suffix to append to existing value."),
        separator: z.string().optional().default("").describe("Separator between prefix/suffix and existing value. Default: empty string."),
        categories: z.array(z.string()).optional().describe("Filter by Revit category names (e.g. ['Walls', 'Doors']). If omitted, all elements with the parameter."),
        scope: z.enum(["whole_model", "active_view", "selection"]).optional().default("whole_model").describe("Scope: whole_model, active_view, or selection. Default: whole_model."),
        skipEmpty: z.boolean().optional().default(true).describe("Skip elements with empty parameter value. Default: true."),
        filterValue: z.string().optional().describe("Only modify elements whose parameter value contains this text."),
        dryRun: z.boolean().optional().default(true).describe("If true (default), preview changes without applying. Set to false to execute."),
    }, async (args, extra) => {
        try {
            const response = await withRevitConnection(async (revitClient) => {
                return await revitClient.sendCommand("add_prefix_suffix", {
                    parameterName: args.parameterName,
                    prefix: args.prefix ?? "",
                    suffix: args.suffix ?? "",
                    separator: args.separator ?? "",
                    categories: args.categories ?? [],
                    scope: args.scope ?? "whole_model",
                    skipEmpty: args.skipEmpty ?? true,
                    filterValue: args.filterValue ?? "",
                    dryRun: args.dryRun ?? true,
                });
            });
            return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
        }
        catch (error) {
            return { content: [{ type: "text", text: `Add prefix/suffix failed: ${errorMessage(error)}` }], isError: true };
        }
    });
}
