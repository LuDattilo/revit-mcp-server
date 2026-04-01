import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateViewFilterTool(server: McpServer) {
  server.tool(
    "create_view_filter",
    "Create or apply a view filter to control element visibility and graphics overrides in views. Can create parameter-based filters and apply them to views with color/pattern overrides.\n\nGUIDANCE:\n- Hide elements by parameter: action=\"create\", parameterName=\"Level\", value=\"Level 1\", filterRule=\"equals\"\n- Color by type: create filter + apply with override_graphics\n- List existing: action=\"list\" to see all view filters\n\nTIPS:\n- Filters affect element visibility/graphics in the views they're applied to\n- Use apply after create: action=\"apply\" with filterId and viewId\n- Combine with override_graphics for color-coded views\n- Use create_color_legend for automated color-by-parameter workflows",
    {
      action: z
        .enum(["create", "apply", "list"])
        .describe(
          "Action: 'create' a new filter, 'apply' existing filter to view, 'list' all filters"
        ),
      filterName: z
        .string()
        .optional()
        .describe("Name for the new filter or name of existing filter to apply"),
      categoryNames: z
        .array(z.string())
        .optional()
        .describe(
          "Category names to filter (e.g. ['Walls', 'Floors']). Required for 'create'."
        ),
      parameterName: z
        .string()
        .optional()
        .describe("Parameter name to filter by (for 'create')"),
      filterRule: z
        .enum([
          "Equals",
          "DoesNotEqual",
          "IsGreaterThan",
          "IsLessThan",
          "Contains",
          "DoesNotContain",
          "BeginsWith",
          "EndsWith",
          "HasValue",
          "HasNoValue",
        ])
        .optional()
        .describe("Filter rule type (for 'create')"),
      filterValue: z
        .string()
        .optional()
        .describe("Value to filter against (for 'create')"),
      viewId: z
        .number()
        .optional()
        .describe("View ID to apply the filter to (for 'apply', default: active view)"),
      colorR: z.number().optional().describe("Override color Red 0-255"),
      colorG: z.number().optional().describe("Override color Green 0-255"),
      colorB: z.number().optional().describe("Override color Blue 0-255"),
      isVisible: z
        .boolean()
        .optional()
        .describe("Whether filtered elements are visible (default: true)"),
    },
    async (args, extra) => {
      const params = {
        action: args.action,
        filterName: args.filterName ?? "",
        categoryNames: args.categoryNames ?? [],
        parameterName: args.parameterName ?? "",
        filterRule: args.filterRule ?? "",
        filterValue: args.filterValue ?? "",
        viewId: args.viewId ?? 0,
        colorR: args.colorR ?? -1,
        colorG: args.colorG ?? -1,
        colorB: args.colorB ?? -1,
        isVisible: args.isVisible ?? true,
      };

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_view_filter", params);
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
              text: `Create view filter failed: ${
                errorMessage(error)
              }`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
