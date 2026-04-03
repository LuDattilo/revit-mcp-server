import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { withRevitConnection } from "../utils/ConnectionManager.js";
import { toolResponse, toolError } from "../utils/compactTool.js";
export function registerGetMaterialPropertiesTool(server) {
    server.tool("get_material_properties", "Get detailed physical/thermal properties of a material.", {
        materialId: z
            .number()
            .optional()
            .describe("The Revit element ID of the material"),
        materialName: z
            .string()
            .optional()
            .describe("Material name (case-insensitive). Used if materialId not provided."),
        fields: z
            .array(z.string())
            .optional()
            .describe("Return only these fields (e.g. ['name', 'density', 'thermalConductivity']). Omit to return all."),
    }, async (args, extra) => {
        try {
            const response = await withRevitConnection(async (revitClient) => {
                return await revitClient.sendCommand("get_material_properties", {
                    materialId: args.materialId,
                    materialName: args.materialName,
                });
            });
            return toolResponse(response, args);
        }
        catch (error) {
            return toolError(`Get material properties failed: ${errorMessage(error)}`);
        }
    });
}
