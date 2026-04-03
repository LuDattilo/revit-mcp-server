import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";
import { toolResponse, toolError, setToolName } from "../utils/compactTool.js";

export function registerGetSharedParametersTool(server: McpServer) {
  server.tool(
    "get_shared_parameters",
    "List shared parameters and their category bindings.",
    {
      categoryFilter: z
        .string()
        .optional()
        .describe("Optional category name filter."),
    },
    async (args, extra) => {
      setToolName("get_shared_parameters");
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("get_shared_parameters", {
            categoryFilter: args.categoryFilter,
          });
        });

        return toolResponse(response);
      } catch (error) {
        return toolError(`Get shared parameters failed: ${errorMessage(error)}`);
      }
    }
  );
}
