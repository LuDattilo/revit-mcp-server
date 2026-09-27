using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using Newtonsoft.Json.Linq;
using RevitMCPCommandSet.Models.SiteMep;
using RevitMCPCommandSet.Services.SiteMep;

namespace RevitMCPCommandSet.Commands.SiteMep
{
    /// <summary>export_ifc — export the model (or one view's visible elements) to an IFC file.</summary>
    public class ExportIfcCommand : SiteMepCommandBase
    {
        public override string CommandName => "export_ifc";

        public ExportIfcCommand(UIApplication uiApp) : base("export_ifc", uiApp)
        {
        }

        // Large models can take a long time to export.
        protected override int TimeoutMs => 1800000;

        protected override Func<Document, object> BuildWork(JObject parameters)
        {
            var req = Parse<ExportIfcRequest>(parameters);
            if (string.IsNullOrWhiteSpace(req.OutputFolder)) throw new ArgumentException("outputFolder is required.");
            if (string.IsNullOrWhiteSpace(req.FileName)) throw new ArgumentException("fileName is required.");
            return doc => SiteMepCore.ExportIfc(doc, req, CommandName);
        }

        protected override string Describe(object response) =>
            response is Dictionary<string, object> d
                ? (d["exported"] is true ? $"Exported {d["path"]} ({d["sizeBytes"]} bytes)" : $"Dry run: would export {d["path"]}")
                : null;
    }
}
