import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";
import { addSuggestions, suggestIf } from "../utils/suggestions.js";

export function registerWorkflowClashReviewTool(server: McpServer) {
  server.tool(
    "workflow_clash_review",
    `Detect clashes between two categories, isolate clashing elements, and create a section box — all in one call. Uses bounding-box intersection with optional tolerance.

GUIDANCE:
- "Check pipes vs ducts for clashes": categoryA="Pipes", categoryB="Ducts"
- "Find structural vs MEP conflicts with 50mm tolerance": categoryA="Structural Framing", categoryB="Mechanical Equipment", tolerance=50
- Use this instead of calling clash_detection + color_elements + section_box_from_selection separately`,
    {
      categoryA: z.string()
        .describe("First Revit category name to check (e.g. 'Walls', 'Pipes', 'Structural Framing')."),
      categoryB: z.string()
        .describe("Second Revit category name to check (e.g. 'Ducts', 'Mechanical Equipment')."),
      tolerance: z.number().optional().default(0)
        .describe("Tolerance in millimeters. Elements within this distance are considered clashing. Default 0."),
      createSectionBox: z.boolean().optional().default(true)
        .describe("If true and the active view is 3D, creates a section box around clashing elements."),
    },
    async (args) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("workflow_clash_review", {
            categoryA: args.categoryA,
            categoryB: args.categoryB,
            tolerance: args.tolerance ?? 0,
            createSectionBox: args.createSectionBox ?? true,
          });
        });

        const data = typeof response === 'object' ? response as any : {};
        const clashCount = data?.clashCount ?? 0;
        const enriched = addSuggestions(response, [
          suggestIf(clashCount > 0, "Export clashing elements to Excel", "Review and document detected clashes offline"),
          suggestIf(clashCount > 0, `Color the ${clashCount} clashing elements red for visibility`, "Highlight clashes visually in the model"),
          suggestIf(clashCount === 0, "Run a full model health audit", "No clashes found — verify overall model quality"),
        ]);

        return { content: [{ type: "text" as const, text: JSON.stringify(enriched, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: `Workflow clash review failed: ${errorMessage(error)}` }], isError: true };
      }
    }
  );
}
