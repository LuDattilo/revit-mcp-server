import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerManageProjectParametersTool(server: McpServer) {
  server.tool(
    "manage_project_parameters",
    `Manage project parameters (CRUD): list, create, delete, or modify category bindings. Inspired by DiRoots ParaManager.

GUIDANCE for common workflows:
- List all parameters first to see what exists: action="list"
- Create a text instance parameter on Walls: action="create", parameterName="MyParam", dataType="Text", categories=["Walls"], isInstance=true
- Add more categories to an existing parameter: action="modify", parameterName="MyParam", categories=["Doors","Windows"]
- Remove an unused parameter: action="delete", parameterName="MyParam"

TIPS:
- isInstance=true means per-element values; isInstance=false means per-type values (shared by all instances of a type)
- groupUnder controls which group the parameter appears under in the Properties panel
- Common groups: "PG_IDENTITY_DATA", "PG_TEXT", "PG_GENERAL", "PG_CONSTRAINTS", "PG_DATA", "PG_GEOMETRY"
- action="modify" always merges new categories with existing ones — it never removes existing bindings
- dataType options: "Text", "Integer", "Number", "Length", "Area", "Volume", "YesNo", "URL"
- Category names must match Revit's display names exactly (e.g. "Walls", "Doors", "Floors", "Generic Models")`,
    {
      action: z
        .enum(["list", "create", "delete", "modify"])
        .describe(
          'Operation to perform. "list" returns all project parameters with bindings. "create" adds a new parameter. "delete" removes a parameter by name. "modify" adds category bindings to an existing parameter.'
        ),
      parameterName: z
        .string()
        .optional()
        .describe(
          'Name of the project parameter. Required for create, delete, and modify. Case-insensitive match for delete and modify.'
        ),
      dataType: z
        .enum(["Text", "Integer", "Number", "Length", "Area", "Volume", "YesNo", "URL"])
        .optional()
        .default("Text")
        .describe('Parameter data type. Only used for action="create". Default: "Text".'),
      groupUnder: z
        .string()
        .optional()
        .default("PG_IDENTITY_DATA")
        .describe(
          'BuiltInParameterGroup name controlling which section the parameter appears under in Properties. Only used for action="create". Examples: "PG_IDENTITY_DATA", "PG_TEXT", "PG_GENERAL", "PG_CONSTRAINTS". Default: "PG_IDENTITY_DATA".'
        ),
      isInstance: z
        .boolean()
        .optional()
        .default(true)
        .describe(
          'If true (default), creates an instance parameter (per-element). If false, creates a type parameter (per-type). Only used for action="create".'
        ),
      categories: z
        .array(z.string())
        .optional()
        .describe(
          'List of Revit category names to bind the parameter to (e.g. ["Walls", "Floors"]). Required for create and modify. Names must match Revit display names exactly.'
        ),
      isShared: z
        .boolean()
        .optional()
        .default(false)
        .describe(
          "Reserved for future use. Currently all parameters are created as project parameters. Default: false."
        ),
    },
    async (args, extra) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("manage_project_parameters", {
            action: args.action,
            parameterName: args.parameterName ?? "",
            dataType: args.dataType ?? "Text",
            groupUnder: args.groupUnder ?? "PG_IDENTITY_DATA",
            isInstance: args.isInstance ?? true,
            categories: args.categories ?? [],
            isShared: args.isShared ?? false,
          });
        });
        return {
          content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Manage project parameters failed: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
