import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { withRevitConnection } from "../utils/ConnectionManager.js";
export function registerGetElementParametersTool(server) {
    server.tool("get_element_parameters", "Get all parameters (instance and type) of one or more Revit elements by their IDs. Returns parameter names, values, storage types, and whether they are read-only or shared.\n\nGUIDANCE:\n- Inspect single element: provide elementId to see all instance + type parameters\n- Discover parameter names: useful before export_elements_data or set_element_parameters\n- Check current values before modifying with set_element_parameters\n\nTIPS:\n- Returns both instance and type parameters with current values\n- Parameter names from this tool can be used in set_element_parameters, export_elements_data, create_schedule\n- Read-only parameters are marked — these cannot be modified", {
        elementIds: z
            .array(z.number())
            .describe("Array of Revit element IDs to get parameters for"),
        includeTypeParameters: z
            .boolean()
            .optional()
            .describe("Include type parameters in addition to instance parameters (default: true)"),
    }, async (args, extra) => {
        const params = {
            elementIds: args.elementIds,
            includeTypeParameters: args.includeTypeParameters ?? true,
        };
        try {
            const response = await withRevitConnection(async (revitClient) => {
                return await revitClient.sendCommand("get_element_parameters", params);
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
                        text: `Get element parameters failed: ${errorMessage(error)}`,
                    },
                ],
                isError: true,
            };
        }
    });
}
