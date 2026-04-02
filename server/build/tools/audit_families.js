import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { withRevitConnection } from "../utils/ConnectionManager.js";
export function registerAuditFamiliesTool(server) {
    server.tool("audit_families", "Comprehensive family audit: health score, unused families, in-place families, instance counts per family/type, category breakdown, and cleanup recommendations.\n\nGUIDANCE:\n- Full audit: call with no parameters for comprehensive family analysis\n- Filter by category: categoryFilter=\"Doors\" to audit only specific category\n- Include unused: includeUnused=true (default) shows families with zero instances\n\nTIPS:\n- Health score factors: unused families, in-place families, CAD imports\n- Recommendations include specific cleanup actions\n- Use purge_unused to remove families flagged as unused\n- Category breakdown shows which areas need most attention", {
        includeUnused: z.boolean().optional().describe("Include unused families in results. Default: true."),
        categoryFilter: z.string().optional().describe("Filter families by category name (e.g. 'Doors'). If omitted, audits all categories."),
    }, async (args, extra) => {
        try {
            const response = await withRevitConnection(async (revitClient) => {
                return await revitClient.sendCommand("audit_families", {
                    includeUnused: args.includeUnused ?? true,
                    categoryFilter: args.categoryFilter ?? "",
                });
            });
            return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
        }
        catch (error) {
            return { content: [{ type: "text", text: `Audit families failed: ${errorMessage(error)}` }], isError: true };
        }
    });
}
