using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using Newtonsoft.Json.Linq;
using RevitMCPCommandSet.Services.SiteMep;

namespace RevitMCPCommandSet.Commands.SiteMep
{
    /// <summary>get_toposolids — list toposolids, optionally with slab-shape vertex points.</summary>
    public class GetToposolidsCommand : SiteMepCommandBase
    {
        public override string CommandName => "get_toposolids";

        public GetToposolidsCommand(UIApplication uiApp) : base("get_toposolids", uiApp)
        {
        }

        protected override int TimeoutMs => 60000;

        protected override Func<Document, object> BuildWork(JObject parameters)
        {
            bool includePoints = parameters["includePoints"]?.Value<bool>() ?? false;
            return doc => SiteMepCore.GetToposolids(doc, includePoints);
        }

        protected override string Describe(object response) =>
            response is Dictionary<string, object> d ? $"Found {d["count"]} toposolid(s)" : null;
    }
}
