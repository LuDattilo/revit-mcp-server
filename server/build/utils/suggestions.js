export function addSuggestions(response, suggestions) {
    const filtered = suggestions.filter((s) => s !== null);
    if (filtered.length === 0)
        return response;
    return { ...response, suggestedNextSteps: filtered };
}
export function suggestIf(condition, prompt, reason) {
    return condition ? { prompt, reason } : null;
}
