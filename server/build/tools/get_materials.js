import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { withRevitConnection } from "../utils/ConnectionManager.js";
export function registerGetMaterialsTool(server) {
    server.tool("get_materials", "List all materials in the current Revit project with their basic properties including color, transparency, and asset availability. Can filter by material class or name.\n\nGUIDANCE:\n- List all materials: returns names, colors, transparency, category\n- Find material by name for use in element creation or modification\n- Material audit: check which materials are used vs unused\n\nTIPS:\n- Use get_material_properties with a specific materialId for detailed info\n- Material IDs can be used with set_element_parameters\n- Combine with get_material_quantities for cost estimation", {
        materialClass: z
            .string()
            .optional()
            .describe("Filter materials by class (case-insensitive exact match, e.g. 'Metal', 'Concrete', 'Wood')"),
        nameFilter: z
            .string()
            .optional()
            .describe("Filter materials whose name contains this substring (case-insensitive)"),
    }, async (args, extra) => {
        try {
            const response = await withRevitConnection(async (revitClient) => {
                return await revitClient.sendCommand("get_materials", { ...args });
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
                        text: `Get materials failed: ${errorMessage(error)}`,
                    },
                ],
                isError: true,
            };
        }
    });
}
