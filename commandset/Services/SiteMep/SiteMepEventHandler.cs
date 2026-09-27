using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using RevitMCPCommandSet.Models.Common;
using RevitMCPSDK.API.Interfaces;

namespace RevitMCPCommandSet.Services.SiteMep
{
    /// <summary>
    /// Shared external-event handler for the site / coordinates / MEP / IFC tools.
    /// Each command owns one instance and sets <see cref="Work"/> (a call into
    /// <see cref="SiteMepCore"/>) before raising the event. The work runs on Revit's
    /// API thread; any exception becomes a Success=false AIResult.
    /// </summary>
    public class SiteMepEventHandler : IExternalEventHandler, IWaitableExternalEventHandler
    {
        private readonly ManualResetEvent _resetEvent = new ManualResetEvent(false);
        private readonly string _name;

        public SiteMepEventHandler(string name)
        {
            _name = name;
        }

        /// <summary>Work to run against the active document; returns the response payload.</summary>
        public Func<Document, object> Work { get; private set; }

        /// <summary>Success message builder (optional).</summary>
        public Func<object, string> Describe { get; private set; }

        public AIResult<object> Result { get; private set; }

        public void SetWork(Func<Document, object> work, Func<object, string> describe = null)
        {
            Work = work;
            Describe = describe;
            Result = null;
            _resetEvent.Reset();
        }

        public void Execute(UIApplication app)
        {
            try
            {
                var doc = app.ActiveUIDocument?.Document
                          ?? throw new InvalidOperationException("No active Revit document.");
                var response = Work(doc);
                Result = new AIResult<object>
                {
                    Success = true,
                    Message = Describe?.Invoke(response) ?? $"{_name} completed",
                    Response = response
                };
            }
            catch (Exception ex)
            {
                Result = new AIResult<object>
                {
                    Success = false,
                    Message = $"{_name} failed: {ex.Message}"
                };
            }
            finally
            {
                _resetEvent.Set();
            }
        }

        public bool WaitForCompletion(int timeoutMilliseconds = 10000)
        {
            return _resetEvent.WaitOne(timeoutMilliseconds);
        }

        public string GetName() => _name;
    }
}
