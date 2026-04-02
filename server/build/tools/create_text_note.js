import { errorMessage } from "../utils/errorUtils.js";
import { z } from "zod";
import { withRevitConnection } from "../utils/ConnectionManager.js";
export function registerCreateTextNoteTool(server) {
    server.tool("create_text_note", "Create a text note in a view at specified coordinates.", {
        textNotes: z
            .array(z.object({
            text: z.string().describe("The text content"),
            position: z
                .object({
                x: z.number().describe("X position in mm"),
                y: z.number().describe("Y position in mm"),
                z: z.number().describe("Z position in mm"),
            })
                .describe("Position of the text note in mm"),
            viewId: z
                .number()
                .optional()
                .describe("View ID to place the text note in (default: active view)"),
            textNoteTypeId: z
                .number()
                .optional()
                .describe("Text note type ID (default: first available type)"),
            horizontalAlignment: z
                .enum(["Left", "Center", "Right"])
                .optional()
                .describe("Text alignment. Default: Left"),
            width: z
                .number()
                .optional()
                .describe("Text note width in mm (0 = auto width). Controls text wrapping"),
        }))
            .describe("Array of text notes to create"),
    }, async (args, extra) => {
        try {
            const response = await withRevitConnection(async (revitClient) => {
                return await revitClient.sendCommand("create_text_note", {
                    textNotes: args.textNotes,
                });
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
                        text: `Create text note failed: ${errorMessage(error)}`,
                    },
                ],
                isError: true,
            };
        }
    });
}
