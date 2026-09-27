using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using Newtonsoft.Json.Linq;
using RevitMCPCommandSet.Models.SiteMep;
using RevitMCPCommandSet.Services.SiteMep;

namespace RevitMCPCommandSet.Commands.SiteMep
{
    /// <summary>
    /// set_shared_coordinates — ProjectLocation.SetProjectPosition so that an internal point
    /// (default the internal origin) lands on the given shared E/N/elevation and angle to true north.
    /// </summary>
    public class SetSharedCoordinatesCommand : SiteMepCommandBase
    {
        public override string CommandName => "set_shared_coordinates";

        public SetSharedCoordinatesCommand(UIApplication uiApp) : base("set_shared_coordinates", uiApp)
        {
        }

        protected override int TimeoutMs => 30000;

        protected override Func<Document, object> BuildWork(JObject parameters)
        {
            foreach (var required in new[] { "eastWest_mm", "northSouth_mm", "elevation_mm", "angleToTrueNorth_deg" })
                if (parameters[required] == null)
                    throw new ArgumentException($"{required} is required.");

            var req = Parse<SetSharedCoordinatesRequest>(parameters);
            return doc => SiteMepCore.SetSharedCoordinates(doc, req, CommandName);
        }

        protected override string Describe(object response) =>
            response is Dictionary<string, object> d && d["dryRun"] is true
                ? "Dry run: shared coordinates computed and rolled back"
                : "Shared coordinates updated";
    }
}
