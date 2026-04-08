using System;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using Autodesk.Revit.UI;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using RevitMCPSDK.API.Models.JsonRPC;
using RevitMCPSDK.API.Interfaces;
using revit_mcp_plugin.Configuration;
using revit_mcp_plugin.Helpers;
using revit_mcp_plugin.Utils;

namespace revit_mcp_plugin.Core
{
    public class SocketService
    {
        private static volatile SocketService _instance;
        private static readonly object _lock = new object();
        private TcpListener _listener;
        private Thread _listenerThread;
        private volatile bool _isRunning;
        private int _port = 8080;
        private UIApplication _uiApp;
        private ICommandRegistry _commandRegistry;
        private ILogger _logger;

        public static SocketService Instance
        {
            get
            {
                if (_instance == null)
                {
                    lock (_lock)
                    {
                        if (_instance == null)
                            _instance = new SocketService();
                    }
                }
                return _instance;
            }
        }

        private SocketService()
        {
            _commandRegistry = new RevitCommandRegistry();
            _logger = new Logger();
        }

        public bool IsRunning => _isRunning;

        public UIApplication UiApplication => _uiApp;

        public int Port => _port;

        // Initialization.
        public void Initialize(UIApplication uiApp)
        {
            _uiApp = uiApp;

            // Initialize ExternalEventManager
            ExternalEventManager.Instance.Initialize(uiApp, _logger);

            // Get the current Revit version.
            var versionAdapter = new RevitMCPSDK.API.Utils.RevitVersionAdapter(_uiApp.Application);
            string currentVersion = versionAdapter.GetRevitVersion();
            _logger.Info("Current Revit version: {0}", currentVersion);



            // Load configuration and register commands.
            ConfigurationManager configManager = new ConfigurationManager(_logger);
            configManager.LoadConfiguration();
            

            //// Read the service port from the configuration.
            //if (configManager.Config.Settings.Port > 0)
            //{
            //    _port = configManager.Config.Settings.Port;
            //}
            _port = 8080; // Hard-wired port number.

            // Load commands.
            CommandManager commandManager = new CommandManager(
                _commandRegistry, _logger, configManager, _uiApp);
            commandManager.LoadCommands();

            _logger.Info($"Socket service initialized on port {_port}");
        }

        private int FindAvailablePort(int startPort, int endPort)
        {
            for (int port = startPort; port <= endPort; port++)
            {
                try
                {
                    var testListener = new TcpListener(IPAddress.Loopback, port);
                    testListener.Start();
                    testListener.Stop();
                    return port;
                }
                catch (SocketException)
                {
                    McpLogger.Warn("SocketService", $"Port {port} is not available, trying next...");
                }
            }
            return -1;
        }

        private void WritePortFile(int port)
        {
            try
            {
                string pluginDir = Path.GetDirectoryName(typeof(SocketService).Assembly.Location);
                string portFilePath = Path.Combine(pluginDir, "mcp-port.txt");
                File.WriteAllText(portFilePath, port.ToString());
                McpLogger.Info("SocketService", $"Port file written to {portFilePath} with port {port}");
            }
            catch (Exception ex)
            {
                McpLogger.Error("SocketService", "Failed to write port file", ex);
            }
        }

        public void Start()
        {
            if (_isRunning) return;

            // Run pre-start health checks
            var pluginDir = Path.GetDirectoryName(typeof(SocketService).Assembly.Location);
            var healthResults = HealthChecker.RunAll(pluginDir, 0);
            foreach (var r in healthResults)
            {
                if (r.Name == "Port Connectivity") continue;
                if (r.AutoFixed)
                    McpLogger.Info("SocketService", $"Auto-fixed: {r.Name} — {r.Message}");
                if (!r.Passed)
                    McpLogger.Warn("SocketService", $"Health check [{r.Name}]: {r.Message}");
            }

            // Block start only if server files are missing
            var serverCheck = healthResults.Find(r => r.Name == "Server Files");
            if (serverCheck != null && !serverCheck.Passed)
            {
                McpLogger.Error("SocketService", $"Cannot start: {serverCheck.Message}");
                System.Windows.MessageBox.Show(
                    serverCheck.Message,
                    "Revit MCP", System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Error);
                return;
            }

            try
            {
                int port = FindAvailablePort(8080, 8089);
                if (port == -1)
                {
                    McpLogger.Error("SocketService", "No available port found in range 8080-8089");
                    System.Windows.Forms.MessageBox.Show(
                        "No available port (8080-8089). Please close other applications using these ports and try again.",
                        "MCP Server - Port Error",
                        System.Windows.Forms.MessageBoxButtons.OK,
                        System.Windows.Forms.MessageBoxIcon.Error);
                    return;
                }

                _port = port;

                if (port != 8080)
                {
                    McpLogger.Warn("SocketService", $"Port 8080 was not available, falling back to port {port}");
                }

                WritePortFile(port);

                _listener = new TcpListener(IPAddress.Loopback, port);
                _listener.Start();

                _listenerThread = new Thread(ListenForClients)
                {
                    IsBackground = true
                };
                _listenerThread.Start();

                _isRunning = true;
                McpLogger.Info("SocketService", $"Server started on port {port}");
            }
            catch (Exception ex)
            {
                _isRunning = false;
                _listener?.Stop();
                _listener = null;
                McpLogger.Error("SocketService", "Failed to start socket service", ex);
                _logger?.Error($"Failed to start socket service on port {_port}: {ex.Message}");
            }
        }

        public void Stop()
        {
            if (!_isRunning) return;

            McpLogger.Info("SocketService", "Server stopping");

            try
            {
                _isRunning = false;

                _listener?.Stop();
                _listener = null;

                if(_listenerThread!=null && _listenerThread.IsAlive)
                {
                    _listenerThread.Join(1000);
                }
            }
            catch (Exception ex)
            {
                _logger?.Error($"Error stopping socket service: {ex.Message}");
            }
        }

        private void ListenForClients()
        {
            try
            {
                while (_isRunning)
                {
                    TcpClient client = _listener.AcceptTcpClient();

                    Thread clientThread = new Thread(HandleClientCommunication)
                    {
                        IsBackground = true
                    };
                    clientThread.Start(client);
                }
            }
            catch (SocketException ex)
            {
                if (_isRunning)
                    McpLogger.Error("SocketService", "Socket error in listener", ex);
            }
            catch (Exception ex)
            {
                if (_isRunning)
                    McpLogger.Error("SocketService", "Unexpected error in listener", ex);
            }
        }

        private void HandleClientCommunication(object clientObj)
        {
            TcpClient tcpClient = (TcpClient)clientObj;
            NetworkStream stream = tcpClient.GetStream();
            StringBuilder messageBuffer = new StringBuilder();

            try
            {
                byte[] buffer = new byte[65536];

                while (_isRunning && tcpClient.Connected)
                {
                    int bytesRead = 0;

                    try
                    {
                        bytesRead = stream.Read(buffer, 0, buffer.Length);
                    }
                    catch (IOException)
                    {
                        break;
                    }

                    if (bytesRead == 0)
                        break;

                    messageBuffer.Append(Encoding.UTF8.GetString(buffer, 0, bytesRead));

                    // Process all complete newline-delimited messages in the buffer.
                    string bufferContent = messageBuffer.ToString();
                    int newlineIndex;
                    while ((newlineIndex = bufferContent.IndexOf('\n')) >= 0)
                    {
                        string message = bufferContent.Substring(0, newlineIndex).Trim();
                        bufferContent = bufferContent.Substring(newlineIndex + 1);

                        if (string.IsNullOrEmpty(message))
                            continue;

                        System.Diagnostics.Trace.WriteLine($"Received message: {message}");
                        string response = ProcessJsonRPCRequest(message);

                        // Send response with newline delimiter.
                        byte[] responseData = Encoding.UTF8.GetBytes(response + "\n");
                        stream.Write(responseData, 0, responseData.Length);
                    }

                    messageBuffer.Clear();
                    if (bufferContent.Length > 0)
                        messageBuffer.Append(bufferContent);
                }
            }
            catch (Exception ex)
            {
                McpLogger.Error("SocketService", "Client communication error", ex);
                _logger?.Error($"Error in client communication: {ex.Message}");
            }
            finally
            {
                tcpClient.Close();
            }
        }

        private string ProcessJsonRPCRequest(string requestJson)
        {
            JsonRPCRequest request;

            try
            {
                // Parse JSON-RPC requests.
                request = JsonConvert.DeserializeObject<JsonRPCRequest>(requestJson);

                // Verify that the request format is valid.
                if (request == null || !request.IsValid())
                {
                    return CreateErrorResponse(
                        null,
                        JsonRPCErrorCodes.InvalidRequest,
                        "Invalid JSON-RPC request"
                    );
                }

                // Search for the command in the registry.
                if (!_commandRegistry.TryGetCommand(request.Method, out var command))
                {
                    return CreateErrorResponse(request.Id, JsonRPCErrorCodes.MethodNotFound,
                        $"Method '{request.Method}' not found");
                }

                // Execute command.
                try
                {
                    var stopwatch = System.Diagnostics.Stopwatch.StartNew();
                    object result = command.Execute(request.GetParamsObject(), request.Id);
                    stopwatch.Stop();

                    // Log to dockable panel
                    try
                    {
                        UI.MCPDockablePanel.Instance?.LogCommand(
                            request.Method, true, "Success", stopwatch.ElapsedMilliseconds);
                    }
                    catch { }

                    return CreateSuccessResponse(request.Id, result);
                }
                catch (Exception ex)
                {
                    McpLogger.Error("SocketService", $"Command '{request.Method}' failed", ex);

                    // Log error to dockable panel
                    try
                    {
                        UI.MCPDockablePanel.Instance?.LogCommand(
                            request.Method, false, ex.Message, 0);
                    }
                    catch { }

                    return CreateErrorResponse(request.Id, JsonRPCErrorCodes.InternalError,
                        $"Command '{request.Method}' failed: {ex.Message}. Check the MCP log for details.");
                }
            }
            catch (JsonException)
            {
                // JSON parsing error.
                return CreateErrorResponse(
                    null,
                    JsonRPCErrorCodes.ParseError,
                    "Invalid JSON"
                );
            }
            catch (Exception ex)
            {
                // Catch other errors produced when processing requests.
                McpLogger.Error("SocketService", "Request processing failed", ex);
                return CreateErrorResponse(
                    null,
                    JsonRPCErrorCodes.InternalError,
                    $"Request processing failed: {ex.Message}. Check the MCP log for details."
                );
            }
        }

        private string CreateSuccessResponse(string id, object result)
        {
            var response = new JsonRPCSuccessResponse
            {
                Id = id,
                Result = result is JToken jToken ? jToken : JToken.FromObject(result)
            };

            return response.ToJson();
        }

        private string CreateErrorResponse(string id, int code, string message, object data = null)
        {
            var response = new JsonRPCErrorResponse
            {
                Id = id,
                Error = new JsonRPCError
                {
                    Code = code,
                    Message = message,
                    Data = data != null ? JToken.FromObject(data) : null
                }
            };

            return response.ToJson();
        }
    }
}
