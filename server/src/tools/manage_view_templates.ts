import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerManageViewTemplatesTool(server: McpServer) {
  server.tool(
    "manage_view_templates",
    `List, duplicate, delete, or rename view templates in the Revit project.

GUIDANCE:
- "List all view templates": action="list"
- "List floor plan templates": action="list", filterViewType="FloorPlan"
- "Duplicate template 12345": action="duplicate", templateIds=[12345], newName="My Copy"
- "Delete templates": action="delete", templateIds=[12345, 12346]
- "Rename template": action="rename", templateIds=[12345], newName="New Name"
- "Replace 'Draft' with 'Final' in all template names": action="batch_rename", findText="Draft", replaceText="Final"`,
    {
      action: z.enum(["list", "duplicate", "delete", "rename", "batch_rename"])
        .describe("Operation to perform."),
      templateIds: z.array(z.number()).optional()
        .describe("Template element IDs (required for duplicate/delete/rename)."),
      newName: z.string().optional()
        .describe("New name for duplicate or rename operations."),
      findText: z.string().optional()
        .describe("Text to find (for batch_rename)."),
      replaceText: z.string().optional()
        .describe("Replacement text (for batch_rename)."),
      filterViewType: z.string().optional()
        .describe("Filter by view type when listing (e.g. 'FloorPlan', 'Section', 'ThreeD')."),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("manage_view_templates", {
            action: args.action,
            templateIds: args.templateIds ?? [],
            newName: args.newName ?? "",
            findText: args.findText ?? "",
            replaceText: args.replaceText ?? "",
            filterViewType: args.filterViewType ?? "",
          });
        });
        return { content: [{ type: "text" as const, text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: `Manage view templates failed: ${errorMessage(error)}` }], isError: true };
      }
    }
  );
}
