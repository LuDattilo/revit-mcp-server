import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerRenameViewsTool(server: McpServer) {
  server.tool(
    "rename_views",
    "Batch rename Revit views with prefix, suffix, or find-and-replace. Filter by view type or name pattern.\n\nGUIDANCE:\n- Add prefix: operation=\"prefix\", prefix=\"A-\"\n- Add suffix: operation=\"suffix\", suffix=\"_OLD\"\n- Find/replace: operation=\"find_replace\", findText=\"old\", replaceText=\"new\"\n- Filter by type: viewTypes=[\"FloorPlan\", \"Section\"]\n- Filter by name: filterName=\"Level\" to only rename views containing \"Level\"\n\nTIPS:\n- Preview changes first with dryRun=true (default) before committing\n- Combine viewTypes and filterName for precise targeting\n- View templates and system browser views are always excluded",
    {
      operation: z
        .enum(["prefix", "suffix", "find_replace"])
        .describe("Rename operation to apply"),
      prefix: z
        .string()
        .optional()
        .describe("Prefix to add to view names (required for prefix operation)"),
      suffix: z
        .string()
        .optional()
        .describe("Suffix to add to view names (required for suffix operation)"),
      findText: z
        .string()
        .optional()
        .describe("Text to find in view names (required for find_replace operation)"),
      replaceText: z
        .string()
        .optional()
        .describe("Replacement text (required for find_replace operation)"),
      viewTypes: z
        .array(
          z.enum([
            "FloorPlan",
            "CeilingPlan",
            "Section",
            "Elevation",
            "ThreeDimensional",
            "DraftingView",
            "Legend",
            "Schedule",
            "AreaPlan",
            "StructuralPlan",
          ])
        )
        .optional()
        .describe("Filter by view types. If omitted, all view types are included."),
      filterName: z
        .string()
        .optional()
        .describe("Only rename views whose name contains this text"),
      dryRun: z
        .boolean()
        .optional()
        .default(true)
        .describe(
          "If true (default), only previews changes without applying. Set to false to execute."
        ),
    },
    async (args, extra) => {
      const params = {
        operation: args.operation,
        prefix: args.prefix ?? "",
        suffix: args.suffix ?? "",
        findText: args.findText ?? "",
        replaceText: args.replaceText ?? "",
        viewTypes: args.viewTypes ?? [],
        filterName: args.filterName ?? "",
        dryRun: args.dryRun ?? true,
      };

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("rename_views", params);
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
              text: `Rename views failed: ${errorMessage(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
