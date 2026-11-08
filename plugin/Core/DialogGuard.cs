using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Autodesk.Revit.DB;
using Autodesk.Revit.DB.Events;
using Autodesk.Revit.UI;
using Autodesk.Revit.UI.Events;
using Newtonsoft.Json.Linq;
using revit_mcp_plugin.Helpers;

namespace revit_mcp_plugin.Core
{
    /// <summary>
    /// Opt-in handling of Revit dialogs and transaction failures for unattended (agent-driven) sessions.
    ///
    /// Enable it with a line "dialogs=auto" in the plugin's "autostart" file, or REVIT_MCP_DIALOGS=auto.
    /// When it is off (the default), nothing is registered and interactive behaviour is unchanged.
    ///
    /// Policy (conservative):
    /// - Failures: warnings are recorded and left in the model (Review Warnings still lists them); with
    ///   "warnings=dismiss" they are deleted instead. Errors are never resolved,
    ///   because Revit's resolutions can delete elements; the pending transaction is rolled back instead,
    ///   which is what Cancel in the error dialog does.
    /// - Dialogs: an explicit mapping from the autostart file ("dialog:&lt;DialogId&gt;=&lt;result&gt;") wins; then a short
    ///   built-in list of known-safe answers; otherwise Cancel, then Close; an OK-only message box gets OK.
    ///   A dialog that offers none of these stays on screen and is logged as not dismissed.
    /// Every dialog and failure is written to the plugin log and attached to the next socket response
    /// as "_revitDialogs" (see SocketService).
    /// </summary>
    public static class DialogGuard
    {
        private const int IDOK = 1, IDCANCEL = 2, IDCLOSE = 8;

        // Known dialogs where Cancel would abort the very operation the agent asked for, and the
        // non-destructive answer is clear.
        private static readonly Dictionary<string, int> BuiltIn = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase)
        {
            // Opening a model with missing links: "Ignore and continue opening the project".
            ["TaskDialog_Unresolved_References"] = (int)TaskDialogResult.CommandLink2,
            // The failures dialog. Answering it through this event rolls the transaction back on Revit 2027.3,
            // whether with Cancel or OK (the caller still saw success, but the elements were gone), so OnFailures
            // switches warnings to non-modal handling and this dialog no longer appears for them. It still shows
            // after an error rollback, where OK just acknowledges it.
            ["Dialog_Revit_DocWarnDialog"] = IDOK,
        };

        private static readonly Dictionary<string, int> Mapped = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        private static readonly object Lock = new object();
        private static readonly List<JObject> Pending = new List<JObject>();

        public static bool Enabled { get; private set; }

        /// <summary>"warnings=dismiss" deletes warnings from the model; the default keeps them (they stay in Review Warnings).</summary>
        public static bool DismissWarnings { get; private set; }

        /// <summary>Reads the opt-in from the autostart file / environment and registers the handlers.</summary>
        public static void Register(UIControlledApplication app, string pluginDir)
        {
            var cfg = Path.Combine(pluginDir, "autostart");
            bool on = string.Equals(Environment.GetEnvironmentVariable("REVIT_MCP_DIALOGS"), "auto", StringComparison.OrdinalIgnoreCase);
            if (File.Exists(cfg))
            {
                foreach (var raw in File.ReadAllLines(cfg))
                {
                    var t = raw.Trim();
                    if (t.Equals("dialogs=auto", StringComparison.OrdinalIgnoreCase)) on = true;
                    else if (t.Equals("warnings=dismiss", StringComparison.OrdinalIgnoreCase)) DismissWarnings = true;
                    else if (t.StartsWith("dialog:", StringComparison.OrdinalIgnoreCase))
                    {
                        var eq = t.IndexOf('=');
                        if (eq > 7 && int.TryParse(t.Substring(eq + 1).Trim(), out var code))
                            Mapped[t.Substring(7, eq - 7).Trim()] = code;
                    }
                }
            }
            if (!on) return;

            Enabled = true;
            app.DialogBoxShowing += OnDialog;
            app.ControlledApplication.FailuresProcessing += OnFailures;
            McpLogger.Info("DialogGuard", $"Unattended dialog/failure handling on ({Mapped.Count} mapped dialog ids, warnings {(DismissWarnings ? "dismissed" : "kept")})");
        }

        /// <summary>Returns and clears everything recorded since the last call.</summary>
        public static JArray Drain()
        {
            lock (Lock)
            {
                var a = new JArray(Pending);
                Pending.Clear();
                return a;
            }
        }

        private static void Record(JObject o)
        {
            o["time"] = DateTime.Now.ToString("HH:mm:ss");
            lock (Lock)
            {
                Pending.Add(o);
                if (Pending.Count > 200) Pending.RemoveAt(0);
            }
            McpLogger.Info("DialogGuard", o.ToString(Newtonsoft.Json.Formatting.None));
        }

        private static void OnDialog(object sender, DialogBoxShowingEventArgs e)
        {
            try
            {
                string id = e.DialogId ?? "";
                string message = (e as TaskDialogShowingEventArgs)?.Message ?? (e as MessageBoxShowingEventArgs)?.Message ?? "";
                var rec = new JObject { ["kind"] = "dialog", ["dialogId"] = id, ["message"] = message };

                var tried = new List<int>();
                if (Mapped.TryGetValue(id, out var m)) tried.Add(m);
                else if (BuiltIn.TryGetValue(id, out var b)) tried.Add(b);
                else
                {
                    tried.Add(IDCANCEL);
                    tried.Add(IDCLOSE);
                    // MB_OK (0): an information box whose only button is OK.
                    if (e is MessageBoxShowingEventArgs mb && mb.DialogType == 0) tried.Add(IDOK);
                }

                int? used = null;
                foreach (var r in tried)
                    if (e.OverrideResult(r)) { used = r; break; }

                rec["result"] = used.HasValue ? (JToken)used.Value : "not dismissed";
                Record(rec);
            }
            catch (Exception ex)
            {
                McpLogger.Error("DialogGuard", "Dialog handler failed", ex);
            }
        }

        private static void OnFailures(object sender, FailuresProcessingEventArgs e)
        {
            try
            {
                var fa = e.GetFailuresAccessor();
                var msgs = fa.GetFailureMessages();
                if (msgs == null || msgs.Count == 0) return;

                string doc = SafeTitle(fa);
                string txn = SafeTxn(fa);
                bool hasError = false;

                foreach (var fm in msgs)
                {
                    var sev = fm.GetSeverity();
                    var rec = new JObject
                    {
                        ["kind"] = "failure",
                        ["severity"] = sev.ToString(),
                        ["message"] = fm.GetDescriptionText(),
                        ["failureId"] = fm.GetFailureDefinitionId().Guid.ToString(),
                        ["transaction"] = txn,
                        ["document"] = doc,
                        ["elementIds"] = new JArray(fm.GetFailingElementIds().Select(i => i.ToString())),
                    };
                    if (sev == FailureSeverity.Warning)
                    {
                        if (DismissWarnings)
                        {
                            fa.DeleteWarning(fm);
                            rec["result"] = "warning deleted";
                        }
                        else rec["result"] = "warning kept in model";
                    }
                    else
                    {
                        hasError = true;
                        rec["result"] = "transaction rolled back (error not resolved)";
                    }
                    Record(rec);
                }

                if (hasError)
                {
                    e.SetProcessingResult(FailureProcessingResult.ProceedWithRollBack);
                }
                else if (!DismissWarnings)
                {
                    // Keep the warnings without the modal warnings dialog: answering that dialog through
                    // DialogBoxShowing (OK or Cancel) rolls the transaction back on Revit 2027.3.
                    var opts = fa.GetFailureHandlingOptions();
                    opts.SetForcedModalHandling(false);
                    opts.SetDelayedMiniWarnings(true);
                    fa.SetFailureHandlingOptions(opts);
                }
            }
            catch (Exception ex)
            {
                McpLogger.Error("DialogGuard", "Failure handler failed", ex);
            }
        }

        private static string SafeTitle(FailuresAccessor fa) { try { return fa.GetDocument().Title; } catch { return ""; } }
        private static string SafeTxn(FailuresAccessor fa) { try { return fa.GetTransactionName(); } catch { return ""; } }
    }
}
