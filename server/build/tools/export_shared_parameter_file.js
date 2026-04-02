import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { withRevitConnection } from "../utils/ConnectionManager.js";
export function registerExportSharedParameterFileTool(server) {
    server.tool("export_shared_parameter_file", "Export the shared parameter file contents as structured data.", {
        filePath: z.string().optional()
            .describe("Output .txt path. Default: Desktop/SharedParameters_<timestamp>.txt"),
    }, async (args) => {
        try {
            const response = await withRevitConnection(async (revitClient) => {
                return await revitClient.sendCommand("export_shared_parameter_file", {
                    filePath: args.filePath ?? "",
                });
            });
            return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
        }
        catch (error) {
            return { content: [{ type: "text", text: `Export shared parameter file failed: ${errorMessage(error)}` }], isError: true };
        }
    });
}
