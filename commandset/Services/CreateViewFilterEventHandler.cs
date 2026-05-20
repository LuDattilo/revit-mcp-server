using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using RevitMCPCommandSet.Models.Common;
using RevitMCPCommandSet.Utils;
using RevitMCPSDK.API.Interfaces;

namespace RevitMCPCommandSet.Services
{
    public class CreateViewFilterEventHandler : IExternalEventHandler, IWaitableExternalEventHandler
    {
        private readonly ManualResetEvent _resetEvent = new ManualResetEvent(false);

        public string Action { get; set; } = "list";
        public string FilterName { get; set; } = "";
        public List<string> CategoryNames { get; set; } = new List<string>();
        public string ParameterName { get; set; } = "";
        public string FilterRule { get; set; } = "";
        public string FilterValue { get; set; } = "";
        public long ViewId { get; set; } = 0;
        public int ColorR { get; set; } = -1;
        public int ColorG { get; set; } = -1;
        public int ColorB { get; set; } = -1;
        public bool IsVisible { get; set; } = true;
        public AIResult<object> Result { get; private set; }

        public void SetParameters(string action, string filterName, List<string> categoryNames, string parameterName, string filterRule, string filterValue, long viewId, int colorR, int colorG, int colorB, bool isVisible)
        {
            Action = action ?? "list";
            FilterName = filterName ?? "";
            CategoryNames = categoryNames ?? new List<string>();
            ParameterName = parameterName ?? "";
            FilterRule = filterRule ?? "";
            FilterValue = filterValue ?? "";
            ViewId = viewId;
            ColorR = colorR;
            ColorG = colorG;
            ColorB = colorB;
            IsVisible = isVisible;
            _resetEvent.Reset();
        }

        public bool WaitForCompletion(int timeoutMilliseconds = 10000)
        {
            return _resetEvent.WaitOne(timeoutMilliseconds);
        }

        public void Execute(UIApplication app)
        {
            try
            {
                var doc = app.ActiveUIDocument.Document;

                switch (Action.ToLower())
                {
                    case "create":
                        ExecuteCreate(doc);
                        break;
                    case "apply":
                        ExecuteApply(doc, app);
                        break;
                    case "list":
                        ExecuteList(doc);
                        break;
                    default:
                        throw new ArgumentException($"Unknown action: {Action}");
                }
            }
            catch (Exception ex)
            {
                Result = new AIResult<object>
                {
                    Success = false,
                    Message = $"View filter operation failed: {ex.Message}"
                };
            }
            finally
            {
                _resetEvent.Set();
            }
        }

        private void ExecuteCreate(Document doc)
        {
            if (string.IsNullOrEmpty(FilterName))
                throw new ArgumentException("filterName is required for 'create' action");
            if (CategoryNames.Count == 0)
                throw new ArgumentException("categoryNames is required for 'create' action");

            // Resolve categories using shared CategoryResolver (language-independent)
            var categoryIds = CategoryNames
                .Select(catName => CategoryResolver.ResolveToId(doc, catName))
                .Where(id => id != null)
                .ToList();

            if (categoryIds.Count == 0)
                throw new Exception($"No valid categories found for: {string.Join(", ", CategoryNames)}. Use localized names (e.g., 'Muri' in Italian) or BuiltInCategory names (e.g., 'OST_Walls').");

            ParameterFilterElement filter;
            using (var transaction = new Transaction(doc, "Create View Filter"))
            {
                transaction.Start();
                try
                {
                    if (!string.IsNullOrEmpty(ParameterName) && !string.IsNullOrEmpty(FilterRule))
                    {
                        // Find the parameter to filter by
                        var param = FindParameterInCategories(doc, categoryIds, ParameterName);
                        if (param == null)
                            throw new Exception($"Parameter '{ParameterName}' not found in specified categories");

                        var rule = CreateFilterRule(param, FilterRule, FilterValue);
                        var elementFilter = new ElementParameterFilter(rule);
                        filter = ParameterFilterElement.Create(doc, FilterName, categoryIds, elementFilter);
                    }
                    else
                    {
                        filter = ParameterFilterElement.Create(doc, FilterName, categoryIds);
                    }

                    transaction.Commit();
                }
                catch
                {
                    if (transaction.GetStatus() == TransactionStatus.Started)
                        transaction.RollBack();
                    throw;
                }
            }

            Result = new AIResult<object>
            {
                Success = true,
                Message = $"Successfully created view filter '{FilterName}'",
                Response = new
                {
#if REVIT2024_OR_GREATER
                    filterId = filter.Id.Value,
#else
                    filterId = filter.Id.IntegerValue,
#endif
                    filterName = filter.Name
                }
            };
        }

        private void ExecuteApply(Document doc, UIApplication app)
        {
            if (string.IsNullOrEmpty(FilterName))
                throw new ArgumentException("filterName is required for 'apply' action");

            // Find the filter
            var filter = new FilteredElementCollector(doc)
                .OfClass(typeof(ParameterFilterElement))
                .Cast<ParameterFilterElement>()
                .FirstOrDefault(f => f.Name.Equals(FilterName, StringComparison.OrdinalIgnoreCase));

            if (filter == null)
                throw new Exception($"View filter '{FilterName}' not found");

            // Get target view
            View view;
            if (ViewId != 0)
                view = doc.GetElement(ToElementId(ViewId)) as View;
            else
                view = app.ActiveUIDocument.ActiveView;

            if (view == null)
                throw new Exception("Target view not found");

            using (var transaction = new Transaction(doc, "Apply View Filter"))
            {
                transaction.Start();
                try
                {
                    view.AddFilter(filter.Id);
                    view.SetFilterVisibility(filter.Id, IsVisible);

                    // Apply color override if specified
                    if (ColorR >= 0 && ColorG >= 0 && ColorB >= 0)
                    {
                        var overrideSettings = new OverrideGraphicSettings();
                        var color = new Color((byte)ColorR, (byte)ColorG, (byte)ColorB);
                        overrideSettings.SetProjectionLineColor(color);
                        overrideSettings.SetSurfaceForegroundPatternColor(color);
                        view.SetFilterOverrides(filter.Id, overrideSettings);
                    }

                    transaction.Commit();
                }
                catch
                {
                    if (transaction.GetStatus() == TransactionStatus.Started)
                        transaction.RollBack();
                    throw;
                }
            }

            Result = new AIResult<object>
            {
                Success = true,
                Message = $"Successfully applied filter '{FilterName}' to view '{view.Name}'"
            };
        }

        private void ExecuteList(Document doc)
        {
            var filters = new FilteredElementCollector(doc)
                .OfClass(typeof(ParameterFilterElement))
                .Cast<ParameterFilterElement>()
                .ToList();

            var result = new List<object>();
            foreach (var filter in filters)
            {
                result.Add(new
                {
#if REVIT2024_OR_GREATER
                    id = filter.Id.Value,
#else
                    id = filter.Id.IntegerValue,
#endif
                    name = filter.Name,
                    categoryCount = filter.GetCategories().Count
                });
            }

            Result = new AIResult<object>
            {
                Success = true,
                Message = $"Found {result.Count} view filters",
                Response = result
            };
        }

        private ElementId FindParameterInCategories(Document doc, List<ElementId> categoryIds, string paramName)
        {
            foreach (var catId in categoryIds)
            {
                // Search instance parameters
                var instance = new FilteredElementCollector(doc)
                    .OfCategoryId(catId)
                    .WhereElementIsNotElementType()
                    .FirstOrDefault();

                if (instance != null)
                {
                    foreach (Parameter param in instance.Parameters)
                    {
                        if (param.Definition.Name.Equals(paramName, StringComparison.OrdinalIgnoreCase))
                            return param.Id;
                    }

                    // Search type parameters
                    var typeId = instance.GetTypeId();
                    if (typeId != null && typeId != ElementId.InvalidElementId)
                    {
                        var typeElem = doc.GetElement(typeId);
                        if (typeElem != null)
                        {
                            foreach (Parameter param in typeElem.Parameters)
                            {
                                if (param.Definition.Name.Equals(paramName, StringComparison.OrdinalIgnoreCase))
                                    return param.Id;
                            }
                        }
                    }
                }
            }
            return null;
        }

        private FilterRule CreateFilterRule(ElementId paramId, string ruleType, string value)
        {
            switch (ruleType)
            {
                case "Equals":
                    if (int.TryParse(value, out int eqIntVal))
                        return ParameterFilterRuleFactory.CreateEqualsRule(paramId, eqIntVal);
#if REVIT2023_OR_GREATER
                    return ParameterFilterRuleFactory.CreateEqualsRule(paramId, value);
#else
                    return ParameterFilterRuleFactory.CreateEqualsRule(paramId, value, true);
#endif
                case "DoesNotEqual":
                    if (int.TryParse(value, out int neqIntVal))
                        return ParameterFilterRuleFactory.CreateNotEqualsRule(paramId, neqIntVal);
#if REVIT2023_OR_GREATER
                    return ParameterFilterRuleFactory.CreateNotEqualsRule(paramId, value);
#else
                    return ParameterFilterRuleFactory.CreateNotEqualsRule(paramId, value, true);
#endif
                case "Contains":
#if REVIT2023_OR_GREATER
                    return ParameterFilterRuleFactory.CreateContainsRule(paramId, value);
#else
                    return ParameterFilterRuleFactory.CreateContainsRule(paramId, value, true);
#endif
                case "DoesNotContain":
#if REVIT2023_OR_GREATER
                    return ParameterFilterRuleFactory.CreateNotContainsRule(paramId, value);
#else
                    return ParameterFilterRuleFactory.CreateNotContainsRule(paramId, value, true);
#endif
                case "BeginsWith":
#if REVIT2023_OR_GREATER
                    return ParameterFilterRuleFactory.CreateBeginsWithRule(paramId, value);
#else
                    return ParameterFilterRuleFactory.CreateBeginsWithRule(paramId, value, true);
#endif
                case "EndsWith":
#if REVIT2023_OR_GREATER
                    return ParameterFilterRuleFactory.CreateEndsWithRule(paramId, value);
#else
                    return ParameterFilterRuleFactory.CreateEndsWithRule(paramId, value, true);
#endif
                case "HasValue":
                    return ParameterFilterRuleFactory.CreateHasValueParameterRule(paramId);
                case "HasNoValue":
                    return ParameterFilterRuleFactory.CreateHasNoValueParameterRule(paramId);
                case "IsGreaterThan":
                    if (int.TryParse(value, out int gtVal))
                        return ParameterFilterRuleFactory.CreateGreaterRule(paramId, gtVal);
#if REVIT2023_OR_GREATER
                    return ParameterFilterRuleFactory.CreateGreaterRule(paramId, value);
#else
                    throw new NotSupportedException("String-based GreaterThan filter requires Revit 2023 or newer.");
#endif
                case "IsLessThan":
                    if (int.TryParse(value, out int ltVal))
                        return ParameterFilterRuleFactory.CreateLessRule(paramId, ltVal);
#if REVIT2023_OR_GREATER
                    return ParameterFilterRuleFactory.CreateLessRule(paramId, value);
#else
                    throw new NotSupportedException("String-based LessThan filter requires Revit 2023 or newer.");
#endif
                default:
                    throw new ArgumentException($"Unknown filter rule type: {ruleType}");
            }
        }

        private ElementId ToElementId(long id)
        {
#if REVIT2024_OR_GREATER
            return new ElementId(id);
#else
            return new ElementId((int)id);
#endif
        }

        public string GetName() => "Create View Filter";
    }
}
