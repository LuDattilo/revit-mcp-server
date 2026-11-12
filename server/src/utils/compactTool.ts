import { compactResponse } from "./responseCompactor.js";
import { logTokenUsage } from "./tokenLogger.js";

/**
 * Standard tool response wrapper with compaction and token logging.
 * Use in place of the raw JSON.stringify return in every tool.
 */
export function toolResponse(toolName: string, response: any, args?: { compact?: boolean }) {
  let result = response;

  const compacted = compactResponse(result, {
    compact: args?.compact ?? false,
    stripNulls: true,
    maxArrayItems: 100,
  });
  // stripEmpty collapses null / {} / all-empty objects to undefined, and
  // JSON.stringify(undefined) is undefined - which would put `text: undefined` in
  // the MCP result and make the client reject it. Fall back to the raw value.
  const text = compacted === undefined ? JSON.stringify(response ?? null) : JSON.stringify(compacted);
  logTokenUsage(toolName, text, false);
  return {
    content: [{ type: "text" as const, text }],
  };
}

export function toolError(toolName: string, message: string) {
  logTokenUsage(toolName, message, true);
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}

/**
 * Drop-in replacement for tools that use raw JSON.stringify.
 * Logs token usage and returns the standard MCP response format.
 */
export function rawToolResponse(toolName: string, response: any) {
  // `?? null`: a command whose JSON-RPC reply has no `result` resolves to undefined.
  const text = JSON.stringify(response ?? null);
  logTokenUsage(toolName, text, false);
  return {
    content: [{ type: "text" as const, text }],
  };
}

export function rawToolError(toolName: string, message: string) {
  logTokenUsage(toolName, message, true);
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}
