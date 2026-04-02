import * as net from "net";
import { randomUUID } from "crypto";
export class RevitClientConnection {
    host;
    port;
    socket;
    isConnected = false;
    responseCallbacks = new Map();
    timeoutHandles = new Map();
    buffer = "";
    constructor(host, port) {
        this.host = host;
        this.port = port;
        this.socket = new net.Socket();
        this.setupSocketListeners();
    }
    setupSocketListeners() {
        this.socket.on("connect", () => {
            this.isConnected = true;
        });
        this.socket.on("data", (data) => {
            this.buffer += data.toString();
            this.processBuffer();
        });
        this.socket.on("close", () => {
            this.isConnected = false;
            this.cleanupAllPending(new Error("Socket closed"));
        });
        this.socket.on("error", (error) => {
            console.error("RevitClientConnection error:", error);
            this.isConnected = false;
        });
    }
    processBuffer() {
        // Process all complete newline-delimited messages.
        let newlineIndex;
        while ((newlineIndex = this.buffer.indexOf("\n")) >= 0) {
            const line = this.buffer.substring(0, newlineIndex).trim();
            this.buffer = this.buffer.substring(newlineIndex + 1);
            if (line.length === 0)
                continue;
            this.handleResponse(line);
        }
    }
    connect() {
        if (this.isConnected) {
            return true;
        }
        try {
            this.socket.connect(this.port, this.host);
            return true;
        }
        catch (error) {
            console.error("Failed to connect:", error);
            return false;
        }
    }
    disconnect() {
        this.socket.destroy();
        this.isConnected = false;
        this.cleanupAllPending(new Error("Disconnected from Revit"));
    }
    cleanupAllPending(error) {
        for (const timeoutHandle of this.timeoutHandles.values()) {
            clearTimeout(timeoutHandle);
        }
        this.timeoutHandles.clear();
        const pendingCallbacks = Array.from(this.responseCallbacks.values());
        this.responseCallbacks.clear();
        for (const callback of pendingCallbacks) {
            try {
                callback(JSON.stringify({ error: { message: error.message } }));
            }
            catch {
                // Ignore errors from already-settled promises.
            }
        }
    }
    generateRequestId() {
        return randomUUID();
    }
    handleResponse(responseData) {
        try {
            const response = JSON.parse(responseData);
            const requestId = response.id || "default";
            const callback = this.responseCallbacks.get(requestId);
            if (callback) {
                // Clear the timeout for this request.
                const timeoutHandle = this.timeoutHandles.get(requestId);
                if (timeoutHandle) {
                    clearTimeout(timeoutHandle);
                    this.timeoutHandles.delete(requestId);
                }
                callback(responseData);
                this.responseCallbacks.delete(requestId);
            }
        }
        catch (error) {
            console.error("Error parsing response:", error);
        }
    }
    sendCommand(command, params = {}) {
        return new Promise((resolve, reject) => {
            try {
                if (!this.isConnected) {
                    this.connect();
                }
                const requestId = this.generateRequestId();
                const commandObj = {
                    jsonrpc: "2.0",
                    method: command,
                    params: params,
                    id: requestId,
                };
                // Store callback
                this.responseCallbacks.set(requestId, (responseData) => {
                    try {
                        const response = JSON.parse(responseData);
                        if (response.error) {
                            reject(new Error(response.error.message || "Unknown error from Revit"));
                        }
                        else {
                            resolve(response.result);
                        }
                    }
                    catch (error) {
                        if (error instanceof Error) {
                            reject(new Error(`Failed to parse response: ${error.message}`));
                        }
                        else {
                            reject(new Error(`Failed to parse response: ${String(error)}`));
                        }
                    }
                });
                // Send command with newline delimiter.
                const commandString = JSON.stringify(commandObj) + "\n";
                this.socket.write(commandString);
                // Set timeout (5 minutes) with cleanup.
                const timeoutHandle = setTimeout(() => {
                    if (this.responseCallbacks.has(requestId)) {
                        this.responseCallbacks.delete(requestId);
                        this.timeoutHandles.delete(requestId);
                        reject(new Error(`Command timed out after 5 minutes: ${command}. For large models, use category filters (e.g., filterCategory: "OST_Walls") to narrow the scope.`));
                        this.socket.destroy();
                    }
                }, 300000);
                this.timeoutHandles.set(requestId, timeoutHandle);
            }
            catch (error) {
                reject(error);
            }
        });
    }
}
