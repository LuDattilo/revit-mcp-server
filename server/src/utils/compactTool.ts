import { compactResponse } from "./responseCompactor.js";

/**
 * Standard tool response wrapper with compaction.
 * Use in place of the raw JSON.stringify return in every tool.
 */
export function toolResponse(response: any, args?: { compact?: boolean }) {
  const compacted = compactResponse(response, {
    compact: args?.compact ?? false,
    stripNulls: true,
    maxArrayItems: 100,
  });
  return {
    content: [{ type: "text" as const, text: JSON.stringify(compacted, null, 2) }],
  };
}

export function toolError(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}
