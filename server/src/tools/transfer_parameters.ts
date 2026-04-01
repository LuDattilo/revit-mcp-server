import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerTransferParametersTool(server: McpServer) {
  server.tool(
    "transfer_parameters",
    "Transfer (copy) parameter values from a source element to multiple target elements. Can transfer all matching writable parameters or a specified subset. Optionally includes type parameters. Supports dry-run preview.\n\nGUIDANCE:\n- Copy params from source to targets: sourceId, targetIds, parameterNames\n- Selective transfer: specify only the parameter names you want to copy\n- Batch standardization: copy one element's parameters to many similar elements\n\nTIPS:\n- Use get_element_parameters on source to see available parameters\n- Only writable parameters can be transferred\n- Source and targets should be same category for best results\n- Use match_element_properties for type-level matching instead",
    {
      sourceElementId: z.number().describe("ID of the source element to copy parameters from."),
      targetElementIds: z.array(z.number()).describe("IDs of target elements to copy parameters to."),
      parameterNames: z.array(z.string()).optional().describe("Specific parameter names to transfer. If omitted, transfers all matching writable parameters."),
      includeType: z.boolean().optional().describe("Also transfer type parameter values. Default: false."),
      dryRun: z.boolean().optional().default(true).describe("Preview changes without applying. Default: true. Set to false to execute."),
    },
    async (args, extra) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("transfer_parameters", {
            sourceElementId: args.sourceElementId,
            targetElementIds: args.targetElementIds,
            parameterNames: args.parameterNames ?? [],
            includeType: args.includeType ?? false,
            dryRun: args.dryRun ?? true,
          });
        });
        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Transfer parameters failed: ${errorMessage(error)}` }], isError: true };
      }
    }
  );
}
