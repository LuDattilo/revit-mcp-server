import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { withRevitConnection } from "../utils/ConnectionManager.js";
export function registerChangeElementTypeTool(server) {
    server.tool("change_element_type", "Batch swap family/element types on multiple elements at once. Useful for changing all doors from one type to another, swapping wall types, etc.\n\nGUIDANCE:\n- Swap door type: provide elementIds of doors and newTypeName to change to\n- Batch type change: provide multiple elementIds to change all at once\n- Use get_available_family_types to find exact target type name\n\nTIPS:\n- Elements must be same category as target type\n- Use ai_element_filter to find elements of specific type first\n- Type name must match exactly (case-sensitive)\n- Original element positions/parameters are preserved", {
        elementIds: z
            .array(z.number())
            .describe("Element IDs to change type for"),
        targetTypeId: z
            .number()
            .optional()
            .describe("Target type element ID to change to"),
        targetTypeName: z
            .string()
            .optional()
            .describe("Target type name to search for (used if targetTypeId not provided)"),
        targetFamilyName: z
            .string()
            .optional()
            .describe("Target family name to narrow type search"),
    }, async (args, extra) => {
        const params = {
            elementIds: args.elementIds,
            targetTypeId: args.targetTypeId ?? 0,
            targetTypeName: args.targetTypeName ?? "",
            targetFamilyName: args.targetFamilyName ?? "",
        };
        try {
            const response = await withRevitConnection(async (revitClient) => {
                return await revitClient.sendCommand("change_element_type", params);
            });
            return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
        }
        catch (error) {
            return { content: [{ type: "text", text: `Change element type failed: ${errorMessage(error)}` }], isError: true };
        }
    });
}
