import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerColorElementsTool(server: McpServer) {
  server.tool(
      "color_elements",
      "Color elements in the current view based on a category and parameter value. Each unique parameter value gets assigned a distinct color.\n\nGUIDANCE:\n- Color by parameter: provide parameterName and elements are colored by value\n- Custom color: provide specific RGB values for element overrides\n- Reset colors: use override_graphics with reset option to clear\n\nTIPS:\n- Colors are view-specific overrides, not permanent\n- Use create_color_legend for automated color-by-parameter with legend\n- Combine with ai_element_filter to color specific element subsets",
      {
        categoryName: z
            .string()
            .describe("The name of the Revit category to color (e.g., 'Walls', 'Doors', 'Rooms')"),
        parameterName: z
            .string()
            .describe("The name of the parameter to use for grouping and coloring elements"),
        useGradient: z
            .boolean()
            .optional()
            .default(false)
            .describe("Whether to use a gradient color scheme instead of random colors"),
        customColors: z
            .array(
                z.object({
                  r: z.number().int().min(0).max(255),
                  g: z.number().int().min(0).max(255),
                  b: z.number().int().min(0).max(255),
                })
            )
            .optional()
            .describe("Optional array of custom RGB colors to use for specific parameter values"),
      },
      async (args, extra) => {
        const params = args;
        try {
          const response = await withRevitConnection(async (revitClient) => {
            return await revitClient.sendCommand("color_splash", params);
          });

          // Format the response into a more user-friendly output
          if (response.success) {
            const coloredGroups = response.results || [];

            let resultText = `Successfully colored ${response.totalElements} elements across ${response.coloredGroups} groups.\n\n`;
            resultText += "Parameter Value Groups:\n";

            coloredGroups.forEach((group: any) => {
              const rgb = group.color;
              resultText += `- "${group.parameterValue}": ${group.count} elements colored with RGB(${rgb.r}, ${rgb.g}, ${rgb.b})\n`;
            });

            return {
              content: [
                {
                  type: "text",
                  text: resultText,
                },
              ],
            };
          } else {
            return {
              content: [
                {
                  type: "text",
                  text: `Color operation failed: ${response.message}`,
                },
              ],
            };
          }
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Color operation failed: ${
                    error instanceof Error ? error.message : String(error)
                }`,
              },
            ],
          isError: true,
          };
        }
      }
  );
}