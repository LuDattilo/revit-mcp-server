export function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
