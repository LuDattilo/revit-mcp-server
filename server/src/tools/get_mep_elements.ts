import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";
import { rawToolResponse, rawToolError } from "../utils/compactTool.js";
import { definedOnly } from "../utils/siteMepSchemas.js";

export function registerGetMepElementsTool(server: McpServer) {
  server.tool(
    "get_mep_elements",
    "List pipes, ducts, fittings and accessories with their system and size. Pipes/ducts return elementId, category, typeName, systemName, systemTypeName, systemClassification, levelName, size, diameter_mm or width_mm/height_mm, length_mm, start_mm/end_mm; fittings/accessories return elementId, category, familyName, typeName, systemName, systemClassification, size, levelName, location_mm. All coordinates are internal, in mm.",
    {
      category: z
        .enum(["all", "pipes", "ducts", "fittings"])
        .optional()
        .describe("Which elements: all (default), pipes, ducts, or fittings (pipe/duct fittings and accessories)"),
      systemName: z
        .string()
        .optional()
        .describe("Only elements whose System Name equals this (case-insensitive)"),
      limit: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Maximum elements returned (default 500, max 10000); totalMatched reports the full count"),
    },
    async (args) => {
      const params = definedOnly(args);
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("get_mep_elements", params);
        }, 150000);
        return rawToolResponse("get_mep_elements", response);
      } catch (error) {
        return rawToolError(
          "get_mep_elements",
          `Get MEP elements failed: ${errorMessage(error)}`
        );
      }
    }
  );
}
