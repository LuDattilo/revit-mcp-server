import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerLoadFamilyTool(server: McpServer) {
  server.tool(
    "load_family",
    "Load a .rfa family, list loaded families, or duplicate a type.",
    {
      action: z
        .enum(["load", "list", "duplicate_type"])
        .describe("'load', 'list', or 'duplicate_type'."),
      familyPath: z
        .string()
        .optional()
        .describe("Full path to .rfa file (required for 'load' action)"),
      categoryFilter: z
        .string()
        .optional()
        .describe(
          "Filter families by category name (for 'list' action, case-insensitive)"
        ),
      sourceTypeId: z
        .number()
        .optional()
        .describe("Source family type ID to duplicate (for 'duplicate_type' action)"),
      newTypeName: z
        .string()
        .optional()
        .describe("Name for the new duplicated type (for 'duplicate_type' action)"),
    },
    async (args, extra) => {
      const params = {
        action: args.action,
        familyPath: args.familyPath ?? "",
        categoryFilter: args.categoryFilter ?? "",
        sourceTypeId: args.sourceTypeId ?? 0,
        newTypeName: args.newTypeName ?? "",
      };

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("load_family", params);
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
              text: `Load family failed: ${
                errorMessage(error)
              }`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
