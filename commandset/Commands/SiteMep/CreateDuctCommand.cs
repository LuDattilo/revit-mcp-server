using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using Newtonsoft.Json.Linq;
using RevitMCPCommandSet.Models.SiteMep;
using RevitMCPCommandSet.Services.SiteMep;

namespace RevitMCPCommandSet.Commands.SiteMep
{
    /// <summary>create_duct — Duct.Create for one or more straight segments (all-or-nothing).</summary>
    public class CreateDuctCommand : SiteMepCommandBase
    {
        public override string CommandName => "create_duct";

        public CreateDuctCommand(UIApplication uiApp) : base("create_duct", uiApp)
        {
        }

        protected override int TimeoutMs => 120000;

        protected override Func<Document, object> BuildWork(JObject parameters)
        {
            var req = Parse<CreateDuctsRequest>(parameters);
            if (req.Ducts == null || req.Ducts.Count == 0)
                throw new ArgumentException("ducts must contain at least one duct.");
            return doc => SiteMepCore.CreateDucts(doc, req, CommandName);
        }

        protected override string Describe(object response) =>
            response is Dictionary<string, object> d
                ? (d["dryRun"] is true ? $"Dry run: {d["count"]} duct(s) created and rolled back" : $"Created {d["count"]} duct(s)")
                : null;
    }
}
