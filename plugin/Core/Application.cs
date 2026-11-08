using System;
using System.IO;
using Autodesk.Revit.UI;
using System.Reflection;
using System.Windows.Media.Imaging;
using revit_mcp_plugin.Helpers;
using revit_mcp_plugin.UI;
using revit_mcp_plugin.Utils;



namespace revit_mcp_plugin.Core
{
    public class Application : IExternalApplication
    {
        public Result OnStartup(UIControlledApplication application)
        {
            var pluginDir = Path.GetDirectoryName(typeof(Application).Assembly.Location);
            McpLogger.Initialize(pluginDir);
            McpLogger.Info("Application", "Plugin starting");

            // Auto-configure Claude Desktop on first run (silent, never crashes)
            ClaudeDesktopConfigurator.EnsureConfigured();

            // Register Dockable Panel
            try
            {
                application.RegisterDockablePane(
                    MCPDockablePaneProvider.PaneId,
                    "MCP Server",
                    new MCPDockablePaneProvider());
            }
            catch (Exception ex)
            {
                System.Diagnostics.Trace.WriteLine($"[RevitMCP] Panel registration skipped: {ex.Message}");
            }

            RibbonPanel mcpPanel = application.CreateRibbonPanel("Revit MCP Plugin");

            PushButtonData pushButtonData = new PushButtonData("ID_EXCMD_TOGGLE_REVIT_MCP", "Revit MCP\r\n Switch",
                Assembly.GetExecutingAssembly().Location, "revit_mcp_plugin.Core.MCPServiceConnection");
            pushButtonData.ToolTip = "Open / Close mcp server";
            pushButtonData.Image = new BitmapImage(new Uri("/RevitMCPPlugin;component/Core/Ressources/icon-16.png", UriKind.RelativeOrAbsolute));
            pushButtonData.LargeImage = new BitmapImage(new Uri("/RevitMCPPlugin;component/Core/Ressources/icon-32.png", UriKind.RelativeOrAbsolute));
            mcpPanel.AddItem(pushButtonData);

            PushButtonData panelButtonData = new PushButtonData("ID_EXCMD_TOGGLE_MCP_PANEL", "MCP\r\n Panel",
                Assembly.GetExecutingAssembly().Location, "revit_mcp_plugin.Core.ToggleMCPPanel");
            panelButtonData.ToolTip = "Show / Hide MCP monitoring panel";
            panelButtonData.Image = new BitmapImage(new Uri("/RevitMCPPlugin;component/Core/Ressources/panel-16.png", UriKind.RelativeOrAbsolute));
            panelButtonData.LargeImage = new BitmapImage(new Uri("/RevitMCPPlugin;component/Core/Ressources/panel-32.png", UriKind.RelativeOrAbsolute));
            mcpPanel.AddItem(panelButtonData);

            PushButtonData mcp_settings_pushButtonData = new PushButtonData("ID_EXCMD_MCP_SETTINGS", "Settings",
                Assembly.GetExecutingAssembly().Location, "revit_mcp_plugin.Core.Settings");
            mcp_settings_pushButtonData.ToolTip = "MCP Settings";
            mcp_settings_pushButtonData.Image = new BitmapImage(new Uri("/RevitMCPPlugin;component/Core/Ressources/settings-16.png", UriKind.RelativeOrAbsolute));
            mcp_settings_pushButtonData.LargeImage = new BitmapImage(new Uri("/RevitMCPPlugin;component/Core/Ressources/settings-32.png", UriKind.RelativeOrAbsolute));
            mcpPanel.AddItem(mcp_settings_pushButtonData);

            // Optional auto-start, for unattended (agent-driven) sessions: start the socket server on the
            // first Idling event when REVIT_MCP_AUTOSTART=1 or a file named "autostart" sits next to the plugin.
            if (Environment.GetEnvironmentVariable("REVIT_MCP_AUTOSTART") == "1" || File.Exists(Path.Combine(pluginDir, "autostart")))
            {
                application.Idling += AutoStartOnIdling;
                McpLogger.Info("Application", "Auto-start armed");
            }

            // Opt-in ("dialogs=auto" in the autostart file): answer dialogs and failures without a human.
            try { DialogGuard.Register(application, pluginDir); }
            catch (Exception ex) { McpLogger.Error("Application", "DialogGuard registration failed", ex); }

            return Result.Succeeded;
        }

        private static void AutoStartOnIdling(object sender, Autodesk.Revit.UI.Events.IdlingEventArgs e)
        {
            var uiApp = sender as UIApplication;
            if (uiApp == null) return;
            uiApp.Idling -= AutoStartOnIdling;
            try
            {
                var service = SocketService.Instance;
                // The autostart file may name a project to open: "open=C:\path\model.rvt", and a template
                // to create it from when it does not exist yet: "template=C:\...\Default.rte".
                var pluginDir = Path.GetDirectoryName(typeof(Application).Assembly.Location);
                var cfg = Path.Combine(pluginDir, "autostart");
                string openPath = null, template = null;
                if (File.Exists(cfg))
                    foreach (var line in File.ReadAllLines(cfg))
                    {
                        var t = line.Trim();
                        if (t.StartsWith("open=", StringComparison.OrdinalIgnoreCase)) openPath = t.Substring(5).Trim();
                        else if (t.StartsWith("template=", StringComparison.OrdinalIgnoreCase)) template = t.Substring(9).Trim();
                    }
                if (!string.IsNullOrEmpty(openPath) && uiApp.ActiveUIDocument == null)
                {
                    if (!File.Exists(openPath) && !string.IsNullOrEmpty(template))
                    {
                        var doc = uiApp.Application.NewProjectDocument(template);
                        Directory.CreateDirectory(Path.GetDirectoryName(openPath));
                        doc.SaveAs(openPath);
                        doc.Close(false);
                        McpLogger.Info("Application", $"Created project {openPath} from {template}");
                    }
                    if (File.Exists(openPath)) uiApp.OpenAndActivateDocument(openPath);
                }
                if (!service.IsRunning)
                {
                    service.Initialize(uiApp);
                    service.Start();
                    McpLogger.Info("Application", "Auto-started MCP socket server");
                }
            }
            catch (Exception ex)
            {
                McpLogger.Info("Application", $"Auto-start failed: {ex.Message}");
            }
        }

        public Result OnShutdown(UIControlledApplication application)
        {
            try
            {
                if (SocketService.Instance.IsRunning)
                {
                    SocketService.Instance.Stop();
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Trace.WriteLine($"[RevitMCP] Error during shutdown: {ex.Message}");
            }

            return Result.Succeeded;
        }
    }
}
