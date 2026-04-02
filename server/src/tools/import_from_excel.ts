import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerImportFromExcelTool(server: McpServer) {
  server.tool(
    "import_from_excel",
    `Import parameter values from an Excel (.xlsx) file back into Revit elements.
The file must have an 'ElementId' column (use export_to_excel with includeElementId=true).
Read-only parameters and system columns (Category, Family, Type) are skipped.

GUIDANCE:
- Always use dryRun=true first to preview changes before applying.
- "Update parameters from Excel": filePath="C:/path/to/file.xlsx"
- Workflow: export_to_excel → edit in Excel → import_from_excel`,
    {
      filePath: z.string().describe("Full path to the .xlsx file to import."),
      sheetName: z.string().optional().describe("Worksheet name. Default: first sheet."),
      dryRun: z.boolean().optional().default(false)
        .describe("Preview changes without modifying the model. Always try this first."),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("import_from_excel", {
            filePath: args.filePath,
            sheetName: args.sheetName ?? "",
            dryRun: args.dryRun ?? false,
          });
        });
        return { content: [{ type: "text" as const, text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: `Import from Excel failed: ${errorMessage(error)}` }], isError: true };
      }
    }
  );
}
