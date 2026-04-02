import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { withRevitConnection } from "../utils/ConnectionManager.js";
export function registerLoadFamilyTool(server) {
    server.tool("load_family", "Load a Revit family (.rfa) file into the current project, or list loaded families by category. Can also duplicate existing family types with new parameter values.\n\nGUIDANCE:\n- Load from file: action=\"load\", filePath=\"C:/path/to/family.rfa\"\n- List loaded: action=\"list\" to see all loaded families\n- Duplicate type: action=\"duplicate\", familyName, sourceTypeName, newTypeName\n\nTIPS:\n- File path must be accessible from the Revit machine\n- Loading overwrites existing family if names match\n- Use get_available_family_types to verify loading was successful\n- .rfa files only — use manage_links for .rvt files", {
        action: z
            .enum(["load", "list", "duplicate_type"])
            .describe("Action: 'load' to load a .rfa file, 'list' to list loaded families, 'duplicate_type' to duplicate an existing type"),
        familyPath: z
            .string()
            .optional()
            .describe("Full path to .rfa file (required for 'load' action)"),
        categoryFilter: z
            .string()
            .optional()
            .describe("Filter families by category name (for 'list' action, case-insensitive)"),
        sourceTypeId: z
            .number()
            .optional()
            .describe("Source family type ID to duplicate (for 'duplicate_type' action)"),
        newTypeName: z
            .string()
            .optional()
            .describe("Name for the new duplicated type (for 'duplicate_type' action)"),
    }, async (args, extra) => {
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
        }
        catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Load family failed: ${errorMessage(error)}`,
                    },
                ],
                isError: true,
            };
        }
    });
}
