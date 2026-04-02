import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { withRevitConnection } from "../utils/ConnectionManager.js";
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
    }, async (args, extra) => {
        try {
            const response = await withRevitConnection(async (revitClient) => {
                return await revitClient.sendCommand("get_material_properties", {
                    ...args,
                });
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
                        text: `Get material properties failed: ${errorMessage(error)}`,
                    },
                ],
                isError: true,
            };
        }
    });
}
