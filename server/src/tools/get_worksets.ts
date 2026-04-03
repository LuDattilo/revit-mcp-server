import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";
import { toolResponse, toolError } from "../utils/compactTool.js";

export function registerGetWorksetsTool(server: McpServer) {
  server.tool(
    "get_worksets",
    "List worksets with element counts and open/close status.",
    {
      includeSystemWorksets: z
        .boolean()
        .optional()
        .describe("Include system worksets. Default: false."),
      fields: z
        .array(z.string())
        .optional()
        .describe("Return only these fields per workset (e.g. ['name', 'isOpen']). Omit to return all."),
    },
    async (args, extra) => {
      const params = {
        includeSystemWorksets: args.includeSystemWorksets ?? false,
      };

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("get_worksets", params);
        });

        return toolResponse(response, args);
      } catch (error) {
        return toolError(`Get worksets failed: ${errorMessage(error)}`);
      }
    }
  );
}
