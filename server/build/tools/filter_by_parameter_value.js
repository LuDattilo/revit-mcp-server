import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { withRevitConnection } from "../utils/ConnectionManager.js";
export function registerFilterByParameterValueTool(server) {
    server.tool("filter_by_parameter_value", "A deterministic Revit element filter that finds elements matching exact parameter value conditions. Unlike AI-based filtering, this tool applies precise condition matching (equals, contains, greater_than, etc.) directly on parameter values. Use this when you need to filter elements by a specific parameter with a known condition — for example, find all walls where 'Mark' contains 'EXT', or all doors where 'Fire Rating' equals '60min'. Supports both instance and type parameters, multiple categories, and scoping to the whole model, active view, or current selection.", {
        categories: z
            .array(z.string())
            .describe("Revit categories to filter, e.g. ['OST_Walls', 'OST_Doors']"),
        parameterName: z
            .string()
            .describe("Parameter name to filter on"),
        condition: z.enum([
            "equals",
            "not_equals",
            "contains",
            "not_contains",
            "begins_with",
            "not_begins_with",
            "ends_with",
            "not_ends_with",
            "greater_than",
            "less_than",
            "is_empty",
            "is_not_empty",
        ]),
        value: z
            .string()
            .optional()
            .describe("Value to compare against. Not required for is_empty/is_not_empty"),
        caseSensitive: z.boolean().optional().default(false),
        scope: z
            .enum(["whole_model", "active_view", "selection"])
            .optional()
            .default("whole_model"),
        parameterType: z
            .enum(["instance", "type", "both"])
            .optional()
            .default("both"),
        returnParameters: z
            .array(z.string())
            .optional()
            .describe("Additional parameters to return for each matched element"),
    }, async (args, extra) => {
        const params = args;
        try {
            const response = await withRevitConnection(async (revitClient) => {
                return await revitClient.sendCommand("filter_by_parameter_value", params);
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
                        text: `Filter by parameter value failed: ${errorMessage(error)}`,
                    },
                ],
                isError: true,
            };
        }
    });
}
