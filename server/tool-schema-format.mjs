/**
 * Pure formatting of an MCP tools/list result into the two generated schema files.
 * Shared by generate-tool-schemas.mjs (writes them at build time) and the vitest
 * drift test (compares them against the committed copies).
 */

/** tool-schemas.txt: one compact signature line per tool, sorted by name. */
export function formatToolSchemasTxt(tools) {
  const lines = [...tools]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((t) => {
      const props = t.inputSchema?.properties || {};
      const required = new Set(t.inputSchema?.required || []);

      const params = Object.entries(props)
        .map(([k, v]) => {
          let sig;
          if (v.type === "object" && v.properties) {
            const sub = Object.entries(v.properties)
              .map(([pk, pv]) => `${pk}:${pv.type || "?"}`)
              .join(",");
            sig = `${k}:{${sub}}`;
          } else if (v.enum) {
            sig = `${k}:${v.enum.join("|")}`;
          } else {
            sig = `${k}:${v.type || "?"}`;
          }
          if (required.has(k)) sig += "!";
          return sig;
        })
        .join(", ");

      return `${t.name}(${params})`;
    });
  return lines.join("\n") + "\n";
}

/** plugin/tool_schemas.json: full schema for the Revit chat panel, sorted by name. */
export function formatToolSchemasJson(tools) {
  const jsonSchemas = [...tools]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((t) => ({
      name: t.name,
      description: t.description || "",
      input_schema: t.inputSchema || { type: "object", properties: {} },
    }));
  return JSON.stringify(jsonSchemas, null, 2) + "\n";
}
