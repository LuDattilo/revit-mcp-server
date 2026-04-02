import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { withRevitConnection } from "../utils/ConnectionManager.js";
export function registerGetProjectInfoTool(server) {
    server.tool("get_project_info", "Get comprehensive project information from the active Revit document, including project metadata, phases, worksets, Revit links, and levels.\n\nGUIDANCE:\n- Project overview: returns project name, address, levels, phases, worksets, links\n- Check levels before creating views or placing elements\n- Verify worksets and phases for proper element organization\n\nTIPS:\n- Call this first in a new project to understand structure\n- Level names are needed for create_view, create_level, and element placement\n- Phase information is important for renovation/phasing workflows", {
        includePhases: z
            .boolean()
            .optional()
            .describe("Include project phases (default: true)"),
        includeWorksets: z
            .boolean()
            .optional()
            .describe("Include workset information (default: true)"),
        includeLinks: z
            .boolean()
            .optional()
            .describe("Include Revit link information (default: true)"),
        includeLevels: z
            .boolean()
            .optional()
            .describe("Include level information (default: true)"),
    }, async (args, extra) => {
        const params = {
            includePhases: args.includePhases ?? true,
            includeWorksets: args.includeWorksets ?? true,
            includeLinks: args.includeLinks ?? true,
            includeLevels: args.includeLevels ?? true,
        };
        try {
            const response = await withRevitConnection(async (revitClient) => {
                return await revitClient.sendCommand("get_project_info", params);
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
                        text: `Get project info failed: ${errorMessage(error)}`,
                    },
                ],
                isError: true,
            };
        }
    });
}
