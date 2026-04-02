import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { withRevitConnection } from "../utils/ConnectionManager.js";
export function registerApplyViewTemplateTool(server) {
    server.tool("apply_view_template", "Apply or remove a view template on one or more views.", {
        action: z
            .enum(["list", "apply", "remove"])
            .optional()
            .describe("Action: list templates, apply to views, or remove from views (default: list)"),
        viewIds: z
            .array(z.number())
            .optional()
            .describe("View IDs to apply/remove template (required for apply/remove)"),
        templateId: z
            .number()
            .optional()
            .describe("Template view ID to apply"),
        templateName: z
            .string()
            .optional()
            .describe("Template name to search for (used if templateId not provided)"),
    }, async (args, extra) => {
        const params = {
            action: args.action ?? "list",
            viewIds: args.viewIds ?? [],
            templateId: args.templateId ?? 0,
            templateName: args.templateName ?? "",
        };
        try {
            const response = await withRevitConnection(async (revitClient) => {
                return await revitClient.sendCommand("apply_view_template", params);
            });
            return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
        }
        catch (error) {
            return { content: [{ type: "text", text: `View template operation failed: ${errorMessage(error)}` }], isError: true };
        }
    });
}
