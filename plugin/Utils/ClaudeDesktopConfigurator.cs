using System;
using System.IO;
using System.Linq;
using Autodesk.Revit.UI;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace revit_mcp_plugin.Utils
{
    /// <summary>
    /// Auto-configures Claude Desktop (claude_desktop_config.json) so the user
    /// never needs to run any script or edit any file.
    /// Called once during Revit startup — silently skips if already configured.
    /// </summary>
    public static class ClaudeDesktopConfigurator
    {
        private const string ConfigFileName = "claude_desktop_config.json";
        private const string McpServerName = "revit-mcp";

        /// <summary>
        /// Ensures that Claude Desktop is configured to connect to the Revit MCP server.
        /// Safe to call every startup — only writes when the config is missing or stale.
        /// </summary>
        public static void EnsureConfigured()
        {
            try
            {
                // 1. Locate the MCP server and a Node.js runtime
                string serverPath = GetServerPath();
                string nodePath = GetNodePath();

                if (serverPath == null || nodePath == null)
                {
                    System.Diagnostics.Trace.WriteLine(
                        $"[RevitMCP] Auto-config skipped: server={serverPath ?? "null"}, node={nodePath ?? "null"}");
                    return;
                }

                // 2. Find the Claude Desktop config directory
                string claudeDir = GetClaudeDesktopDir();
                if (claudeDir == null)
                {
                    System.Diagnostics.Trace.WriteLine("[RevitMCP] Auto-config skipped: Claude Desktop not found");
                    return;
                }

                // 3. Read (or bootstrap) the config file
                string configPath = Path.Combine(claudeDir, ConfigFileName);
                JObject config;

                if (File.Exists(configPath))
                {
                    try
                    {
                        config = JObject.Parse(File.ReadAllText(configPath));
                    }
                    catch
                    {
                        // Corrupt JSON — back up and start fresh
                        File.Copy(configPath, configPath + ".bak", overwrite: true);
                        config = new JObject();
                    }
                }
                else
                {
                    config = new JObject();
                }

                // 4. Ensure mcpServers object exists
                var mcpServers = config["mcpServers"] as JObject;
                if (mcpServers == null)
                {
                    mcpServers = new JObject();
                    config["mcpServers"] = mcpServers;
                }

                // 5. Check whether the entry already points to the correct paths
                var existing = mcpServers[McpServerName] as JObject;
                if (existing != null)
                {
                    string existingCmd = existing["command"]?.ToString();
                    var existingArgs = existing["args"]?.ToObject<string[]>();

                    if (existingCmd == nodePath &&
                        existingArgs != null && existingArgs.Length > 0 &&
                        existingArgs[0] == serverPath)
                    {
                        // Already correct — nothing to do
                        return;
                    }
                }

                // 6. Write / update the revit-mcp entry (preserves all other servers)
                mcpServers[McpServerName] = new JObject
                {
                    ["command"] = nodePath,
                    ["args"] = new JArray(serverPath)
                };

                Directory.CreateDirectory(claudeDir);
                File.WriteAllText(configPath, config.ToString(Formatting.Indented));

                System.Diagnostics.Trace.WriteLine(
                    $"[RevitMCP] Claude Desktop auto-configured: {nodePath} {serverPath}");

                // 7. Notify the user (only when we actually changed something)
                try
                {
                    var td = new TaskDialog("Revit MCP Plugin")
                    {
                        MainInstruction = "Claude Desktop configurato automaticamente",
                        MainContent =
                            "Il server MCP per Revit è stato registrato in Claude Desktop.\n\n" +
                            "Riavvia Claude Desktop per attivare i tool.\n\n" +
                            "(Questo messaggio appare solo quando la configurazione viene aggiornata)",
                        CommonButtons = TaskDialogCommonButtons.Ok
                    };
                    td.Show();
                }
                catch
                {
                    // If TaskDialog fails (e.g. during silent startup), ignore
                }
            }
            catch (Exception ex)
            {
                // Never crash Revit because of auto-config
                System.Diagnostics.Trace.WriteLine(
                    $"[RevitMCP] Claude Desktop auto-config failed (non-fatal): {ex.Message}");
            }
        }

        // -----------------------------------------------------------------
        // Path resolution
        // -----------------------------------------------------------------

        private static string GetServerPath()
        {
            string pluginDir = PathManager.GetAppDataDirectoryPath();
            string serverJs = Path.Combine(
                pluginDir, "Commands", "RevitMCPCommandSet", "server", "build", "index.js");
            return File.Exists(serverJs) ? serverJs : null;
        }

        private static string GetNodePath()
        {
            // 1. Bundled portable node.exe (ships with the Release ZIP)
            string pluginDir = PathManager.GetAppDataDirectoryPath();
            string bundledNode = Path.Combine(
                pluginDir, "Commands", "RevitMCPCommandSet", "server", "runtime", "node.exe");
            if (File.Exists(bundledNode))
                return bundledNode;

            // 2. System node in PATH
            return FindInPath("node.exe");
        }

        private static string FindInPath(string executable)
        {
            string pathEnv = Environment.GetEnvironmentVariable("PATH");
            if (string.IsNullOrEmpty(pathEnv)) return null;

            foreach (string dir in pathEnv.Split(';'))
            {
                if (string.IsNullOrWhiteSpace(dir)) continue;
                try
                {
                    string fullPath = Path.Combine(dir.Trim(), executable);
                    if (File.Exists(fullPath))
                        return fullPath;
                }
                catch
                {
                    // Invalid path entry — skip
                }
            }
            return null;
        }

        // -----------------------------------------------------------------
        // Claude Desktop detection
        // -----------------------------------------------------------------

        private static string GetClaudeDesktopDir()
        {
            // Standard install
            string standard = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Claude");
            if (Directory.Exists(standard))
                return standard;

            // MSIX (Microsoft Store) install
            string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            string packagesDir = Path.Combine(localAppData, "Packages");
            if (Directory.Exists(packagesDir))
            {
                try
                {
                    string claudePkg = Directory.GetDirectories(packagesDir, "Claude_*").FirstOrDefault();
                    if (claudePkg != null)
                    {
                        string msixDir = Path.Combine(claudePkg, "LocalCache", "Roaming", "Claude");
                        if (Directory.Exists(msixDir))
                            return msixDir;
                    }
                }
                catch
                {
                    // Permission issue reading Packages — skip MSIX check
                }
            }

            // Claude Desktop not installed — return standard path anyway so the
            // config is ready when the user eventually installs it.
            return standard;
        }
    }
}
