import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { withRevitConnection } from "../utils/ConnectionManager.js";
export function registerCreateColorLegendTool(server) {
    server.tool("create_color_legend", `Colorize elements by parameter value in the active (or specified) view and optionally create a legend view documenting the color scheme.

GUIDANCE:
- Color rooms by department: parameterName="Department", categories=["Rooms"], colorScheme="auto"
- Gradient by area (blue=small, red=large): parameterName="Area", categories=["Rooms"], colorScheme="gradient"
- Custom brand colors: colorScheme="custom", customColors=[{value:"Office",r:0,g:120,b:255},{value:"Storage",r:255,g:165,b:0}]
- Color walls by type: parameterName="Type Name", categories=["Walls"], colorScheme="auto"
- Always create a visual legend for documentation: createLegendView=true

TIPS:
- "auto" generates visually distinct hues for each unique value — best for categorical data
- "gradient" produces a blue-to-red ramp; works best with numeric parameters (Area, Height, etc.)
- "custom" lets you assign exact RGB colors per value; unspecified values get auto colors
- Use targetViewId to colorize a background view without switching the active view
- Run place_viewport after creation to add the legend to a sheet`, {
        parameterName: z.string().describe("Name of the parameter to group and colorize by (e.g. 'Department', 'Level', 'Area', 'Type Name')."),
        categories: z.array(z.string()).optional().describe("Element categories to include. Supported: Rooms, Walls, Floors, Ceilings, Doors, Windows, Columns, StructuralColumns, StructuralFraming, Furniture, FurnitureSystems, MechanicalEquipment, Roofs, Areas, Spaces, Pipes, Ducts, GenericModels. Default: Rooms."),
        colorScheme: z.enum(["auto", "gradient", "custom"]).optional().describe("'auto' = distinct hues per value (default). 'gradient' = blue-to-red ramp for numeric values. 'custom' = use customColors mapping."),
        customColors: z.array(z.object({
            value: z.string().describe("Parameter value string to match."),
            r: z.number().int().min(0).max(255).describe("Red channel 0-255."),
            g: z.number().int().min(0).max(255).describe("Green channel 0-255."),
            b: z.number().int().min(0).max(255).describe("Blue channel 0-255."),
        })).optional().describe("Custom color mappings used when colorScheme='custom'. Unspecified values receive auto-generated colors."),
        createLegendView: z.boolean().optional().describe("Create a Legend view showing color swatches and values. Default: true."),
        legendTitle: z.string().optional().describe("Title text for the legend view. Default: 'Color Legend'."),
        targetViewId: z.number().optional().describe("Element ID of the view to apply overrides in. If omitted, uses the active view."),
    }, async (args, extra) => {
        try {
            const response = await withRevitConnection(async (revitClient) => {
                return await revitClient.sendCommand("create_color_legend", {
                    parameterName: args.parameterName,
                    categories: args.categories ?? ["Rooms"],
                    colorScheme: args.colorScheme ?? "auto",
                    customColors: args.customColors ?? [],
                    createLegendView: args.createLegendView ?? true,
                    legendTitle: args.legendTitle ?? "Color Legend",
                    targetViewId: args.targetViewId ?? 0,
                });
            });
            return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
        }
        catch (error) {
            return { content: [{ type: "text", text: `Create color legend failed: ${errorMessage(error)}` }], isError: true };
        }
    });
}
