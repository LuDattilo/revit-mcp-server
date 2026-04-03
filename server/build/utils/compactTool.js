import { compactResponse, filterFields } from "./responseCompactor.js";
/**
 * Standard tool response wrapper with compaction and field filtering.
 * Use in place of the raw JSON.stringify return in every tool.
 */
export function toolResponse(response, args) {
    let result = response;
    // Apply field filtering on the Response payload if present
    if (args?.fields?.length) {
        if (result?.Response) {
            result = { ...result, Response: filterFields(result.Response, args.fields) };
        }
        else {
            result = filterFields(result, args.fields);
        }
    }
    const compacted = compactResponse(result, {
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
