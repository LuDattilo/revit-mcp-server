using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using Newtonsoft.Json.Linq;
using RevitMCPCommandSet.Models.SiteMep;
using RevitMCPCommandSet.Services.SiteMep;

namespace RevitMCPCommandSet.Commands.SiteMep
{
    /// <summary>create_pipe — Pipe.Create for one or more straight segments (all-or-nothing).</summary>
    public class CreatePipeCommand : SiteMepCommandBase
    {
        public override string CommandName => "create_pipe";

        public CreatePipeCommand(UIApplication uiApp) : base("create_pipe", uiApp)
        {
        }

        protected override int TimeoutMs => 120000;

        protected override Func<Document, object> BuildWork(JObject parameters)
        {
            var req = Parse<CreatePipesRequest>(parameters);
            if (req.Pipes == null || req.Pipes.Count == 0)
                throw new ArgumentException("pipes must contain at least one pipe.");
            return doc => SiteMepCore.CreatePipes(doc, req, CommandName);
        }

        protected override string Describe(object response) =>
            response is Dictionary<string, object> d
                ? (d["dryRun"] is true ? $"Dry run: {d["count"]} pipe(s) created and rolled back" : $"Created {d["count"]} pipe(s)")
                : null;
    }
}
