using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using Newtonsoft.Json.Linq;
using RevitMCPCommandSet.Services.SiteMep;

namespace RevitMCPCommandSet.Commands.SiteMep
{
    /// <summary>get_project_location — survey point, project base point, shared transform, site lat/long.</summary>
    public class GetProjectLocationCommand : SiteMepCommandBase
    {
        public override string CommandName => "get_project_location";

        public GetProjectLocationCommand(UIApplication uiApp) : base("get_project_location", uiApp)
        {
        }

        protected override int TimeoutMs => 15000;

        protected override Func<Document, object> BuildWork(JObject parameters) =>
            doc => SiteMepCore.GetProjectLocation(doc);

        protected override string Describe(object response) =>
            response is Dictionary<string, object> d ? $"Active project location: {d["activeLocationName"]}" : null;
    }
}
