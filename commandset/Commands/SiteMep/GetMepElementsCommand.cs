using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using Newtonsoft.Json.Linq;
using RevitMCPCommandSet.Models.SiteMep;
using RevitMCPCommandSet.Services.SiteMep;

namespace RevitMCPCommandSet.Commands.SiteMep
{
    /// <summary>get_mep_elements — pipes, ducts, fittings and accessories with system and size.</summary>
    public class GetMepElementsCommand : SiteMepCommandBase
    {
        public override string CommandName => "get_mep_elements";

        public GetMepElementsCommand(UIApplication uiApp) : base("get_mep_elements", uiApp)
        {
        }

        protected override int TimeoutMs => 120000;

        protected override Func<Document, object> BuildWork(JObject parameters)
        {
            var req = Parse<GetMepElementsRequest>(parameters);
            return doc => SiteMepCore.GetMepElements(doc, req);
        }

        protected override string Describe(object response) =>
            response is Dictionary<string, object> d ? $"Returned {d["returned"]} of {d["totalMatched"]} MEP element(s)" : null;
    }
}
