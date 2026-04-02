import { errorMessage } from "../utils/errorUtils.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";
export function registerCheckModelHealthTool(server) {
    server.tool("check_model_health", "Comprehensive BIM model health audit. Returns a health score (0-100), grade (A-F), and detailed breakdown: warnings count and top 10 types, in-place families, imported CAD, unplaced rooms, unused views, detail lines. Includes actionable recommendations. Use this to assess model quality before delivery or identify cleanup priorities.\n\nGUIDANCE:\n- Full audit: call with no parameters for comprehensive model health check\n- Returns health score (0-100), grade (A-F), and specific recommendations\n- Run periodically during model development for quality assurance\n\nTIPS:\n- Score includes: warnings count, unused families, CAD imports, in-place families\n- Use audit_families for detailed family-level health analysis\n- Use get_warnings for the full list of Revit warnings\n- Address high-impact issues (score deductions > 10 points) first", {}, async (args, extra) => {
        try {
            const response = await withRevitConnection(async (revitClient) => {
                return await revitClient.sendCommand("check_model_health", {});
            });
            return {
                content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Check model health failed: ${errorMessage(error)}`,
                    },
                ],
                isError: true,
            };
        }
    });
}
