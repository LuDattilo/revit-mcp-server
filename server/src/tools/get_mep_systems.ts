import { errorMessage } from "../utils/errorUtils.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";
import { rawToolResponse, rawToolError } from "../utils/compactTool.js";

export function registerGetMepSystemsTool(server: McpServer) {
  server.tool(
    "get_mep_systems",
    "List piping and mechanical (duct) systems: elementId, name, domain ('piping'|'mechanical'), classification, systemClassificationEnum, systemTypeName, elementCount (all network members), curveCount (pipes/ducts), fittingCount, otherCount, totalLength_mm (sum of pipe/duct lengths), isEmpty.",
    {},
    async () => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("get_mep_systems", {});
        }, 150000);
        return rawToolResponse("get_mep_systems", response);
      } catch (error) {
        return rawToolError(
          "get_mep_systems",
          `Get MEP systems failed: ${errorMessage(error)}`
        );
      }
    }
  );
}
