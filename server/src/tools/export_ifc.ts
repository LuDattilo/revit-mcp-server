import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";
import { rawToolResponse, rawToolError } from "../utils/compactTool.js";
import { definedOnly } from "../utils/siteMepSchemas.js";

export function registerExportIfcTool(server: McpServer) {
  server.tool(
    "export_ifc",
    "Export the active model to an IFC file with Revit's built-in IFC exporter. outputFolder must already exist; '.ifc' is appended to fileName if missing; an existing file is overwritten. ifcVersion maps to Revit's IFCVersion: IFC2x3 -> IFC2x3CV2 (Coordination View 2.0), IFC4 -> IFC4RV (Reference View), IFC4x3 -> IFC4x3. useSharedCoordinates=true (default) places IfcSite at the shared coordinates; false uses the internal origin. viewName limits the export to elements visible in that view. The export runs inside a transaction named 'export_ifc' that is rolled back afterwards so the model is not modified. Returns path, sizeBytes, ifcVersion, viewName, fileExistedBefore.\n\nUse dryRun=true to validate the folder/view/version and see the target path without exporting.",
    {
      outputFolder: z.string().describe("Existing folder to write into (absolute path)"),
      fileName: z.string().describe("File name, e.g. 'site-model' or 'site-model.ifc'"),
      ifcVersion: z
        .enum(["IFC2x3", "IFC4", "IFC4x3"])
        .optional()
        .describe("IFC schema (default IFC4)"),
      viewName: z
        .string()
        .optional()
        .describe("Export only elements visible in this view (3D views preferred when names clash)"),
      exportBaseQuantities: z
        .boolean()
        .optional()
        .describe("Include IFC base quantities (default false)"),
      useSharedCoordinates: z
        .boolean()
        .optional()
        .describe("Place IfcSite at shared coordinates (default true); false = internal origin"),
      dryRun: z
        .boolean()
        .optional()
        .describe("If true, validate and return the planned path without exporting. Default false."),
    },
    async (args) => {
      const params = definedOnly(args);
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("export_ifc", params);
        }, 1860000);
        return rawToolResponse("export_ifc", response);
      } catch (error) {
        return rawToolError("export_ifc", `Export IFC failed: ${errorMessage(error)}`);
      }
    }
  );
}
