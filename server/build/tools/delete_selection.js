import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { withRevitConnection } from "../utils/ConnectionManager.js";
export function registerDeleteSelectionTool(server) {
    server.tool("delete_selection", "Delete a saved selection from the Revit document by name.\n\nGUIDANCE:\n- Remove a previously saved selection that is no longer needed\n- Use load_selection without a name first to list available selections\n\nTIPS:\n- This only deletes the saved selection definition, not the elements themselves\n- Use delete_element to delete actual model elements", {
        name: z
            .string()
            .describe("Name of the saved selection to delete"),
    }, async (args, extra) => {
        const params = {
            name: args.name,
        };
        try {
            const response = await withRevitConnection(async (revitClient) => {
                return await revitClient.sendCommand("delete_selection", params);
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
                        text: `delete selection failed: ${errorMessage(error)}`,
                    },
                ],
                isError: true,
            };
        }
    });
}
