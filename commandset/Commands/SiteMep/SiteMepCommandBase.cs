using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using Newtonsoft.Json.Linq;
using RevitMCPCommandSet.Services.SiteMep;
using RevitMCPSDK.API.Base;

namespace RevitMCPCommandSet.Commands.SiteMep
{
    /// <summary>
    /// Common plumbing for the site / coordinates / MEP / IFC commands: one
    /// <see cref="SiteMepEventHandler"/> per command, a per-command lock so concurrent
    /// requests do not overwrite each other's work item, and a timeout per tool.
    /// </summary>
    public abstract class SiteMepCommandBase : ExternalEventCommandBase
    {
        private readonly object _executionLock = new object();

        protected SiteMepCommandBase(string toolName, UIApplication uiApp)
            : base(new SiteMepEventHandler(toolName), uiApp)
        {
        }

        private SiteMepEventHandler SiteHandler => (SiteMepEventHandler)Handler;

        /// <summary>Milliseconds to wait for Revit to finish the work.</summary>
        protected virtual int TimeoutMs => 60000;

        /// <summary>Builds the work item from the request parameters (validation may throw here).</summary>
        protected abstract Func<Document, object> BuildWork(JObject parameters);

        /// <summary>Optional human-readable success message.</summary>
        protected virtual string Describe(object response) => null;

        protected static T Parse<T>(JObject parameters) where T : new()
        {
            return parameters == null ? new T() : parameters.ToObject<T>() ?? new T();
        }

        public override object Execute(JObject parameters, string requestId)
        {
            lock (_executionLock)
            {
                var work = BuildWork(parameters ?? new JObject());
                SiteHandler.SetWork(work, Describe);

                if (RaiseAndWaitForCompletion(TimeoutMs))
                    return SiteHandler.Result;

                throw new TimeoutException($"{CommandName} timed out after {TimeoutMs / 1000} s");
            }
        }
    }
}
