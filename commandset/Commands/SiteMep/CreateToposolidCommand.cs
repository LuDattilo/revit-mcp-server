using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using Newtonsoft.Json.Linq;
using RevitMCPCommandSet.Models.SiteMep;
using RevitMCPCommandSet.Services.SiteMep;

namespace RevitMCPCommandSet.Commands.SiteMep
{
    /// <summary>create_toposolid — Toposolid.Create from a list of (x,y,z) points in mm.</summary>
    public class CreateToposolidCommand : SiteMepCommandBase
    {
        public override string CommandName => "create_toposolid";

        public CreateToposolidCommand(UIApplication uiApp) : base("create_toposolid", uiApp)
        {
        }

        protected override int TimeoutMs => 120000;

        protected override Func<Document, object> BuildWork(JObject parameters)
        {
            var req = Parse<CreateToposolidRequest>(parameters);
            if (req.Points_mm == null || req.Points_mm.Count < 3)
                throw new ArgumentException("points_mm must contain at least 3 points, e.g. {\"points_mm\": [{\"x\":0,\"y\":0,\"z\":0}, ...]}");
            return doc => SiteMepCore.CreateToposolid(doc, req, CommandName);
        }

        protected override string Describe(object response) =>
            response is Dictionary<string, object> d
                ? (d["dryRun"] is true ? "Dry run: toposolid created and rolled back" : $"Created toposolid {d["elementId"]}")
                : null;
    }
}
