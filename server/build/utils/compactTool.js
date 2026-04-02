import { compactResponse } from "./responseCompactor.js";
/**
 * Standard tool response wrapper with compaction.
 * Use in place of the raw JSON.stringify return in every tool.
 */
export function toolResponse(response, args) {
    const compacted = compactResponse(response, {
        compact: args?.compact ?? false,
        stripNulls: true,
        maxArrayItems: 100,
    });
    return {
        content: [{ type: "text", text: JSON.stringify(compacted, null, 2) }],
    };
}
export function toolError(message) {
    return {
        content: [{ type: "text", text: message }],
        isError: true,
    };
}
