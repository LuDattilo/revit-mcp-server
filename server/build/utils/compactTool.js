import { compactResponse } from "./responseCompactor.js";
import { logTokenUsage } from "./tokenLogger.js";
// Track current tool name per call (set by wrapToolResponse)
let _currentToolName = "unknown";
/** Set the tool name for logging. Call at the start of each tool handler. */
export function setToolName(name) {
    _currentToolName = name;
}
/**
 * Standard tool response wrapper with compaction and token logging.
 * Use in place of the raw JSON.stringify return in every tool.
 */
export function toolResponse(response, args) {
    let result = response;
    const compacted = compactResponse(result, {
        compact: args?.compact ?? false,
        stripNulls: true,
        maxArrayItems: 100,
    });
    const text = JSON.stringify(compacted, null, 2);
    logTokenUsage(_currentToolName, text, false);
    return {
        content: [{ type: "text", text }],
    };
}
export function toolError(message) {
    logTokenUsage(_currentToolName, message, true);
    return {
        content: [{ type: "text", text: message }],
        isError: true,
    };
}
/**
 * Drop-in replacement for tools that use raw JSON.stringify.
 * Logs token usage and returns the standard MCP response format.
 */
export function rawToolResponse(toolName, response) {
    const text = JSON.stringify(response, null, 2);
    logTokenUsage(toolName, text, false);
    return {
        content: [{ type: "text", text }],
    };
}
export function rawToolError(toolName, message) {
    logTokenUsage(toolName, message, true);
    return {
        content: [{ type: "text", text: message }],
        isError: true,
    };
}
