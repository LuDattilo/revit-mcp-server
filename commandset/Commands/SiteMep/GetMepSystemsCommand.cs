using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using Newtonsoft.Json.Linq;
using RevitMCPCommandSet.Services.SiteMep;

namespace RevitMCPCommandSet.Commands.SiteMep
{
    /// <summary>get_mep_systems — piping and mechanical (duct) systems with counts and total length.</summary>
    public class GetMepSystemsCommand : SiteMepCommandBase
    {
        public override string CommandName => "get_mep_systems";

        public GetMepSystemsCommand(UIApplication uiApp) : base("get_mep_systems", uiApp)
        {
        }

        protected override int TimeoutMs => 120000;

        protected override Func<Document, object> BuildWork(JObject parameters) =>
            doc => SiteMepCore.GetMepSystems(doc);

        protected override string Describe(object response) =>
            response is Dictionary<string, object> d ? $"Found {d["count"]} MEP system(s)" : null;
    }
}
