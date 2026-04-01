import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

const PointSchema = z.object({
  x: z.number().describe("X coordinate in mm"),
  y: z.number().describe("Y coordinate in mm"),
  z: z.number().describe("Z coordinate in mm"),
});

export function registerMeasureBetweenElementsTool(server: McpServer) {
  server.tool(
    "measure_between_elements",
    "Measure the distance between two elements, two points, or an element and a point. Returns distance in mm and meters, plus X/Y/Z deltas. Provide at least two references (elementId1/elementId2, point1/point2, or a mix). Essential for spatial analysis and layout verification.\n\nGUIDANCE:\n- Element to element: provide elementId1 and elementId2 for center-to-center distance\n- Point to point: provide point1={x,y,z} and point2={x,y,z} in mm\n- Mixed: one element ID + one point for flexible measurement\n\nTIPS:\n- All distances returned in mm\n- measureType options: \"center_to_center\", \"closest_point\", \"bounding_box\"\n- Use for clearance checks between elements\n- Combine with ai_element_filter to find elements to measure between",
    {
      elementId1: z.number().optional().describe("First element ID"),
      elementId2: z.number().optional().describe("Second element ID"),
      point1: PointSchema.optional().describe("First point in mm (alternative to elementId1)"),
      point2: PointSchema.optional().describe("Second point in mm (alternative to elementId2)"),
      measureType: z
        .enum(["center_to_center", "closest_points", "bounding_box"])
        .optional()
        .default("center_to_center")
        .describe("Measurement method (default: center_to_center)"),
    },
    async (args, extra) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("measure_between_elements", args);
        });
        return {
          content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Measure failed: ${errorMessage(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
