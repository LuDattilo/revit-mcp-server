import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";
import { addSuggestions } from "../utils/suggestions.js";

export function registerWorkflowDataRoundtripTool(server: McpServer) {
  server.tool(
    "workflow_data_roundtrip",
    `Export elements to Excel for a roundtrip edit-and-reimport workflow. Creates a color-coded .xlsx file with ElementId, Category, Family, Type, and parameter columns.

Column colors: GREEN = editable instance parameter, YELLOW = type parameter, RED = read-only.
Returns the file path and step-by-step instructions for the roundtrip workflow.

GUIDANCE:
- "Export doors for editing and reimport": categories=["Doors"]
- "Roundtrip walls with Mark and Width": categories=["Walls"], parameterNames=["Mark","Width"]
- "Export everything with type parameters": includeTypeParameters=true
- When done editing, ask me to import the file back`,
    {
      categories: z.array(z.string()).optional()
        .describe("Category names to export (e.g. 'Walls', 'Doors'). Empty = all categories."),
      parameterNames: z.array(z.string()).optional()
        .describe("Parameter names to include. Empty = all discovered parameters."),
      includeTypeParameters: z.boolean().optional().default(false)
        .describe("Include type-level parameters (shown in yellow columns)."),
      filePath: z.string().optional()
        .describe("Output .xlsx path. Default: Desktop/RevitRoundtrip_<timestamp>.xlsx"),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("workflow_data_roundtrip", {
            categories: args.categories ?? [],
            parameterNames: args.parameterNames ?? [],
            includeTypeParameters: args.includeTypeParameters ?? false,
            filePath: args.filePath ?? "",
          });
        });

        const data = typeof response === 'object' ? response : {} as any;
        const filePath = (data as any).filePath ?? "";

        const enriched = addSuggestions(response, [
          { prompt: `When you're done editing, ask me to import ${filePath} back into Revit`, reason: "Excel roundtrip: edit the file then re-import using sync_csv_parameters or import_table" },
        ]);

        return { content: [{ type: "text" as const, text: JSON.stringify(enriched, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: `Workflow data roundtrip failed: ${errorMessage(error)}` }], isError: true };
      }
    }
  );
}
