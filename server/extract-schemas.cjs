/**
 * Extract tool schemas from the MCP server and generate a JSON file
 * for the embedded Claude client to use.
 *
 * Usage: node extract-schemas.js > ../plugin/tool_schemas.json
 */
const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");

// We need to intercept tool registrations
const tools = [];
const originalTool = Server.prototype.tool;

// Patch the server to capture tool definitions
const server = new Server({ name: "schema-extractor", version: "1.0.0" }, { capabilities: { tools: {} } });

// Override setRequestHandler to capture tool registrations
const registeredTools = new Map();

// Use the tool method to register and capture
const origTool = server.tool.bind(server);

server.tool = function(name, descOrSchema, schemaOrHandler, handlerOrUndefined) {
    // Call original to register
    origTool.call(this, name, descOrSchema, schemaOrHandler, handlerOrUndefined);

    // Parse the arguments same way SDK does
    let description, schema;
    if (typeof descOrSchema === "string") {
        description = descOrSchema;
        if (typeof schemaOrHandler === "function") {
            schema = {};
        } else {
            schema = schemaOrHandler;
        }
    } else if (typeof descOrSchema === "object") {
        schema = descOrSchema;
        description = "";
    }

    registeredTools.set(name, { description, schema });
};

// Now register all tools
const { registerTools } = require("./dist/tools/register.js");
registerTools(server);

// Convert Zod schemas to JSON Schema
const result = [];
for (const [name, { description, schema }] of registeredTools) {
    let inputSchema;
    if (schema && typeof schema.jsonSchema === "function") {
        inputSchema = schema.jsonSchema();
    } else if (schema && schema._def) {
        // Zod schema - try zodToJsonSchema
        try {
            const { zodToJsonSchema } = require("zod-to-json-schema");
            inputSchema = zodToJsonSchema(schema);
            delete inputSchema.$schema;
        } catch {
            inputSchema = { type: "object", properties: {} };
        }
    } else if (schema && typeof schema === "object" && !schema._def) {
        inputSchema = { type: "object", properties: schema };
    } else {
        inputSchema = { type: "object", properties: {} };
    }

    result.push({
        name,
        description: description || name,
        input_schema: inputSchema
    });
}

console.log(JSON.stringify(result, null, 2));
