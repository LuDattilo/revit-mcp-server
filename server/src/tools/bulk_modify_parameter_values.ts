import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerBulkModifyParameterValuesTool(server: McpServer) {
  server.tool(
    "bulk_modify_parameter_values",
    "Bulk modify parameter values on multiple Revit elements. Operations: 'set' (set value), 'prefix' (add prefix), 'suffix' (add suffix), 'find_replace' (find & replace text), 'clear' (clear all values). Target elements by IDs or category name. Supports dry-run preview. Inspired by DiRoots OneParameter.\n\nGUIDANCE:\n- Set value on many elements: action=\"set\", parameterName, value, elementIds\n- Add prefix: action=\"prefix\", parameterName, value=\"PRE-\", elementIds\n- Find/replace: action=\"find_replace\", parameterName, findText, replaceText\n- Clear values: action=\"clear\", parameterName, elementIds\n\nTIPS:\n- Use ai_element_filter to get elementIds for specific criteria\n- Preview with dryRun=true before committing changes\n- Supports: set, prefix, suffix, find_replace, clear operations\n- For importing data from external sources, use sync_csv_parameters instead",
    {
      elementIds: z.array(z.number()).optional().describe("Element IDs to modify. If omitted, uses categoryName to find elements."),
      categoryName: z.string().optional().describe("Revit category name (e.g. 'Walls', 'Doors'). Used when elementIds not provided."),
      parameterName: z.string().describe("Name of the parameter to modify."),
      operation: z.enum(["set", "prefix", "suffix", "find_replace", "clear"]).describe("Operation: set=set value, prefix=add before, suffix=add after, find_replace=find&replace, clear=empty"),
      value: z.string().optional().describe("Value to set/prefix/suffix. Required for set, prefix, suffix operations."),
      findText: z.string().optional().describe("Text to find (for find_replace operation)."),
      replaceText: z.string().optional().describe("Replacement text (for find_replace operation)."),
      onlyEmpty: z.boolean().optional().describe("If true, only modify elements where parameter is currently empty. Default: false."),
      dryRun: z.boolean().optional().describe("If true, preview changes without applying. Default: false."),
    },
    async (args, extra) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("bulk_modify_parameter_values", {
            elementIds: args.elementIds ?? [],
            categoryName: args.categoryName ?? "",
            parameterName: args.parameterName,
            operation: args.operation,
            value: args.value ?? "",
            findText: args.findText ?? "",
            replaceText: args.replaceText ?? "",
            onlyEmpty: args.onlyEmpty ?? false,
            dryRun: args.dryRun ?? false,
          });
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }], isError: true };
      } catch (error) {
        return { content: [{ type: "text", text: `Bulk modify parameter values failed: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    }
  );
}
