import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { withRevitConnection } from "../utils/ConnectionManager.js";
export function registerSectionBoxFromSelectionTool(server) {
    server.tool("section_box_from_selection", "Create a 3D view with Section Box fitted around selected elements or specified element IDs. Configurable offset buffer around elements. Can create a new 3D view or apply to current view. Optionally isolates elements.\n\nGUIDANCE:\n- Box around selected elements: provide elementIds to create a 3D section box view\n- Zoom to area: select elements in the area of interest, then create section box\n- Clash investigation: use after clash_detection to zoom into clash locations\n\nTIPS:\n- Creates a new 3D view with the section box fitted to selected elements\n- Use offsetMm to add margin around the elements (default: 500mm)\n- Combine with get_selected_elements to use Revit UI selection\n- Great for presentation views and coordination meetings", {
        elementIds: z
            .array(z.number())
            .optional()
            .describe("Element IDs to fit the section box around. If omitted, uses current Revit selection."),
        useCurrentSelection: z
            .boolean()
            .optional()
            .describe("If true, uses currently selected elements in Revit. Default: true when no elementIds provided."),
        offsetMm: z
            .number()
            .optional()
            .describe("Offset buffer in mm around the bounding box of elements. Default: 1000mm."),
        duplicateView: z
            .boolean()
            .optional()
            .describe("If true, creates a new 3D view. If false, applies to active 3D view. Default: true."),
        viewName: z
            .string()
            .optional()
            .describe("Name for the new 3D view (only if duplicateView=true)."),
        isolateElements: z
            .boolean()
            .optional()
            .describe("If true, temporarily isolates elements in the view. Default: false."),
    }, async (args, extra) => {
        try {
            const response = await withRevitConnection(async (revitClient) => {
                return await revitClient.sendCommand("section_box_from_selection", {
                    elementIds: args.elementIds ?? [],
                    useCurrentSelection: args.useCurrentSelection ?? (args.elementIds === undefined || args.elementIds.length === 0),
                    offsetMm: args.offsetMm ?? 1000,
                    duplicateView: args.duplicateView ?? true,
                    viewName: args.viewName ?? "",
                    isolateElements: args.isolateElements ?? false,
                });
            });
            return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
        }
        catch (error) {
            return {
                content: [{ type: "text", text: `Section box from selection failed: ${errorMessage(error)}` }],
            };
        }
    });
}
