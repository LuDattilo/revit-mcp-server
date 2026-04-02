import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { withRevitConnection } from "../utils/ConnectionManager.js";
export function registerClearParameterValuesTool(server) {
    server.tool("clear_parameter_values", "Clear (empty) parameter values across multiple elements. String parameters are set to empty string, numeric to 0, ElementId to InvalidElementId.", {
        parameterName: z.string().describe("Parameter to clear."),
        categories: z.array(z.string()).optional().describe("Filter by categories (e.g. ['Walls', 'Doors'])."),
        scope: z.enum(["whole_model", "active_view", "selection"]).optional().default("whole_model").describe("Scope of elements to target."),
        filterValue: z.string().optional().describe("Only clear elements whose parameter contains this value."),
        parameterType: z.enum(["instance", "type"]).optional().default("instance").describe("Whether to clear instance or type parameter."),
        dryRun: z.boolean().optional().default(true).describe("If true (default), preview changes without applying. Set to false to execute."),
    }, async (args, extra) => {
        try {
            const response = await withRevitConnection(async (revitClient) => {
                return await revitClient.sendCommand("clear_parameter_values", {
                    parameterName: args.parameterName,
                    categories: args.categories ?? [],
                    scope: args.scope ?? "whole_model",
                    filterValue: args.filterValue ?? "",
                    parameterType: args.parameterType ?? "instance",
                    dryRun: args.dryRun ?? true,
                });
            });
            return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
        }
        catch (error) {
            return { content: [{ type: "text", text: `Clear parameter values failed: ${errorMessage(error)}` }], isError: true };
        }
    });
}
