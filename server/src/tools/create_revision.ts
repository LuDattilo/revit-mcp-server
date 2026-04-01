import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateRevisionTool(server: McpServer) {
  server.tool(
    "create_revision",
    "Manage project revisions: list all revisions, create a new revision, or add the latest revision to sheets. Essential for documentation tracking and issue management.\n\nGUIDANCE:\n- List revisions: action=\"list\" to see existing revisions\n- New revision: action=\"create\", description=\"Updated floor plan\", date=\"2024-01-15\"\n- Add to sheets: action=\"addToSheets\", revisionId and sheetIds\n\nTIPS:\n- Revisions track document changes for construction documentation\n- Each revision gets a unique sequence number\n- Add revisions to sheets before issuing/printing",
    {
      action: z
        .enum(["list", "create", "add_to_sheets"])
        .optional()
        .describe("Action: list revisions, create new, or add latest revision to sheets (default: list)"),
      date: z.string().optional().describe("Revision date string (for create)"),
      description: z.string().optional().describe("Revision description (for create)"),
      issuedBy: z.string().optional().describe("Issued by name (for create)"),
      issuedTo: z.string().optional().describe("Issued to name (for create)"),
      sheetIds: z
        .array(z.number())
        .optional()
        .describe("Sheet IDs to add revision to (for add_to_sheets)"),
    },
    async (args, extra) => {
      const params = {
        action: args.action ?? "list",
        date: args.date ?? "",
        description: args.description ?? "",
        issuedBy: args.issuedBy ?? "",
        issuedTo: args.issuedTo ?? "",
        sheetIds: args.sheetIds ?? [],
      };

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_revision", params);
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Revision operation failed: ${errorMessage(error)}` }], isError: true };
      }
    }
  );
}
