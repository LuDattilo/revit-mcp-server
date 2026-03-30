using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using RevitMCPCommandSet.Models.Common;
using RevitMCPCommandSet.Utils;
using RevitMCPSDK.API.Interfaces;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading;

namespace RevitMCPCommandSet.Services.DataExtraction
{
    public class ExportElementsDataEventHandler : IExternalEventHandler, IWaitableExternalEventHandler
    {
        // Input parameters
        public List<string> Categories { get; set; } = new List<string>();
        public List<string> ParameterNames { get; set; } = new List<string>();
        public bool IncludeTypeParameters { get; set; } = false;
        public bool IncludeElementId { get; set; } = true;
        public string OutputFormat { get; set; } = "json"; // "json" or "csv"
        public int MaxElements { get; set; } = 5000;
        public string FilterParameterName { get; set; } = "";
        public string FilterValue { get; set; } = "";
        public string FilterOperator { get; set; } = "equals"; // equals, contains, greater_than, less_than, not_equals

        public AIResult<object> Result { get; private set; }
        public bool TaskCompleted { get; private set; }
        private readonly ManualResetEvent _resetEvent = new ManualResetEvent(false);

        public void SetParameters(
            List<string> categories,
            List<string> parameterNames,
            bool includeTypeParameters,
            bool includeElementId,
            string outputFormat,
            int maxElements,
            string filterParameterName,
            string filterValue,
            string filterOperator)
        {
            Categories = categories ?? new List<string>();
            ParameterNames = parameterNames ?? new List<string>();
            IncludeTypeParameters = includeTypeParameters;
            IncludeElementId = includeElementId;
            OutputFormat = string.IsNullOrEmpty(outputFormat) ? "json" : outputFormat.ToLower();
            MaxElements = maxElements > 0 ? maxElements : 5000;
            FilterParameterName = filterParameterName ?? "";
            FilterValue = filterValue ?? "";
            FilterOperator = string.IsNullOrEmpty(filterOperator) ? "equals" : filterOperator.ToLower();
            TaskCompleted = false;
            _resetEvent.Reset();
        }

        public bool WaitForCompletion(int timeoutMilliseconds = 60000)
        {
            _resetEvent.Reset();
            return _resetEvent.WaitOne(timeoutMilliseconds);
        }

        public void Execute(UIApplication app)
        {
            try
            {
                var doc = app.ActiveUIDocument.Document;

                // Collect elements from specified categories (or all if empty)
                var elements = CollectElements(doc);
                int totalCount = elements.Count;

                // Apply filter if specified
                if (!string.IsNullOrEmpty(FilterParameterName) && !string.IsNullOrEmpty(FilterValue))
                {
                    elements = ApplyFilter(elements, doc);
                }
                int filteredCount = elements.Count;

                // Limit to MaxElements
                elements = elements.Take(MaxElements).ToList();

                // Determine columns
                var columns = BuildColumns(elements, doc);

                // Build rows
                var rows = BuildRows(elements, doc, columns);

                // Format output
                object output;
                if (OutputFormat == "csv")
                {
                    output = BuildCsvOutput(columns, rows);
                }
                else
                {
                    output = rows;
                }

                // Build next-step guidance
                var guidance = BuildGuidance(columns, filteredCount);

                Result = new AIResult<object>
                {
                    Success = true,
                    Message = $"Exported {elements.Count} elements ({filteredCount} after filter, {totalCount} total). Format: {OutputFormat.ToUpper()}.",
                    Response = new
                    {
                        totalCount,
                        filteredCount,
                        exportedCount = elements.Count,
                        categoriesUsed = Categories.Count > 0 ? Categories : new List<string> { "All" },
                        outputFormat = OutputFormat,
                        columns,
                        data = output,
                        guidance
                    }
                };
            }
            catch (Exception ex)
            {
                Result = new AIResult<object>
                {
                    Success = false,
                    Message = $"Export elements data failed: {ex.Message}"
                };
            }
            finally
            {
                TaskCompleted = true;
                _resetEvent.Set();
            }
        }

        // ----------------------------------------------------------------
        // Element collection
        // ----------------------------------------------------------------

        private List<Element> CollectElements(Document doc)
        {
            var result = new List<Element>();

            if (Categories == null || Categories.Count == 0)
            {
                // All model elements
                result = new FilteredElementCollector(doc)
                    .WhereElementIsNotElementType()
                    .Where(e => e.Category != null && e.Category.CategoryType == CategoryType.Model)
                    .ToList();
            }
            else
            {
                foreach (var categoryName in Categories)
                {
                    var bic = ResolveCategoryName(categoryName);
                    if (bic.HasValue)
                    {
                        var collected = new FilteredElementCollector(doc)
                            .OfCategory(bic.Value)
                            .WhereElementIsNotElementType()
                            .ToList();
                        result.AddRange(collected);
                    }
                    else
                    {
                        // Fallback: match by category name string
                        var collected = new FilteredElementCollector(doc)
                            .WhereElementIsNotElementType()
                            .Where(e => e.Category != null &&
                                e.Category.Name.Equals(categoryName, StringComparison.OrdinalIgnoreCase))
                            .ToList();
                        result.AddRange(collected);
                    }
                }

                // Remove duplicates in case multiple categories matched the same element
                result = result
                    .GroupBy(e => e.Id)
                    .Select(g => g.First())
                    .ToList();
            }

            return result;
        }

        // ----------------------------------------------------------------
        // Category name -> BuiltInCategory resolution
        // ----------------------------------------------------------------

        private BuiltInCategory? ResolveCategoryName(string name)
        {
            if (string.IsNullOrEmpty(name)) return null;

            // Direct match with OST_ prefix
            string bicName = name.StartsWith("OST_") ? name : "OST_" + name;
            if (Enum.TryParse<BuiltInCategory>(bicName, true, out var bic))
                return bic;

            // Common friendly-name mappings
            var map = new Dictionary<string, BuiltInCategory>(StringComparer.OrdinalIgnoreCase)
            {
                { "Walls", BuiltInCategory.OST_Walls },
                { "Floors", BuiltInCategory.OST_Floors },
                { "Roofs", BuiltInCategory.OST_Roofs },
                { "Doors", BuiltInCategory.OST_Doors },
                { "Windows", BuiltInCategory.OST_Windows },
                { "Rooms", BuiltInCategory.OST_Rooms },
                { "Columns", BuiltInCategory.OST_Columns },
                { "StructuralColumns", BuiltInCategory.OST_StructuralColumns },
                { "Beams", BuiltInCategory.OST_StructuralFraming },
                { "StructuralFraming", BuiltInCategory.OST_StructuralFraming },
                { "Stairs", BuiltInCategory.OST_Stairs },
                { "Railings", BuiltInCategory.OST_StairsRailing },
                { "Ceilings", BuiltInCategory.OST_Ceilings },
                { "Furniture", BuiltInCategory.OST_Furniture },
                { "FurnitureSystems", BuiltInCategory.OST_FurnitureSystems },
                { "Casework", BuiltInCategory.OST_Casework },
                { "Plumbing", BuiltInCategory.OST_PlumbingFixtures },
                { "PlumbingFixtures", BuiltInCategory.OST_PlumbingFixtures },
                { "MechanicalEquipment", BuiltInCategory.OST_MechanicalEquipment },
                { "ElectricalFixtures", BuiltInCategory.OST_ElectricalFixtures },
                { "ElectricalEquipment", BuiltInCategory.OST_ElectricalEquipment },
                { "LightingFixtures", BuiltInCategory.OST_LightingFixtures },
                { "GenericModels", BuiltInCategory.OST_GenericModel },
                { "GenericModel", BuiltInCategory.OST_GenericModel },
                { "Areas", BuiltInCategory.OST_Areas },
                { "Spaces", BuiltInCategory.OST_MEPSpaces },
                { "Curtain Panels", BuiltInCategory.OST_CurtainWallPanels },
                { "CurtainWallPanels", BuiltInCategory.OST_CurtainWallPanels },
                { "Mullions", BuiltInCategory.OST_CurtainWallMullions },
                { "Grids", BuiltInCategory.OST_Grids },
                { "Levels", BuiltInCategory.OST_Levels },
                { "Views", BuiltInCategory.OST_Views },
                { "Sheets", BuiltInCategory.OST_Sheets },
            };

            if (map.TryGetValue(name, out var mapped))
                return mapped;

            return null;
        }

        // ----------------------------------------------------------------
        // Filter application
        // ----------------------------------------------------------------

        private List<Element> ApplyFilter(List<Element> elements, Document doc)
        {
            var result = new List<Element>();

            foreach (var element in elements)
            {
                string rawValue = GetParameterRawValue(element, doc, FilterParameterName);
                if (rawValue == null) continue;

                bool match = false;

                // Try numeric comparison for greater_than / less_than
                if (FilterOperator == "greater_than" || FilterOperator == "less_than")
                {
                    if (double.TryParse(rawValue, System.Globalization.NumberStyles.Any,
                            System.Globalization.CultureInfo.InvariantCulture, out double dVal) &&
                        double.TryParse(FilterValue, System.Globalization.NumberStyles.Any,
                            System.Globalization.CultureInfo.InvariantCulture, out double fVal))
                    {
                        match = FilterOperator == "greater_than" ? dVal > fVal : dVal < fVal;
                    }
                }
                else
                {
                    switch (FilterOperator)
                    {
                        case "equals":
                            match = rawValue.Equals(FilterValue, StringComparison.OrdinalIgnoreCase);
                            break;
                        case "not_equals":
                            match = !rawValue.Equals(FilterValue, StringComparison.OrdinalIgnoreCase);
                            break;
                        case "contains":
                            match = rawValue.IndexOf(FilterValue, StringComparison.OrdinalIgnoreCase) >= 0;
                            break;
                        default:
                            match = rawValue.Equals(FilterValue, StringComparison.OrdinalIgnoreCase);
                            break;
                    }
                }

                if (match) result.Add(element);
            }

            return result;
        }

        // ----------------------------------------------------------------
        // Column resolution
        // ----------------------------------------------------------------

        private List<string> BuildColumns(List<Element> elements, Document doc)
        {
            var columns = new List<string>();

            if (IncludeElementId)
                columns.Add("ElementId");

            // Always add category and name as base columns
            columns.Add("Category");
            columns.Add("Name");

            if (ParameterNames != null && ParameterNames.Count > 0)
            {
                // Use explicitly requested parameter names
                foreach (var p in ParameterNames)
                {
                    if (!columns.Contains(p))
                        columns.Add(p);
                }
            }
            else
            {
                // Discover all parameter names from the first batch of elements (up to 50 for perf)
                var paramNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                var sampleElements = elements.Take(50).ToList();

                foreach (var element in sampleElements)
                {
                    foreach (Parameter param in element.Parameters)
                    {
                        if (!string.IsNullOrEmpty(param.Definition?.Name))
                            paramNames.Add(param.Definition.Name);
                    }

                    if (IncludeTypeParameters)
                    {
                        var typeId = element.GetTypeId();
                        if (typeId != null && typeId != ElementId.InvalidElementId)
                        {
                            var type = doc.GetElement(typeId);
                            if (type != null)
                            {
                                foreach (Parameter param in type.Parameters)
                                {
                                    if (!string.IsNullOrEmpty(param.Definition?.Name))
                                        paramNames.Add(param.Definition.Name);
                                }
                            }
                        }
                    }
                }

                foreach (var name in paramNames.OrderBy(n => n))
                {
                    if (!columns.Contains(name))
                        columns.Add(name);
                }
            }

            return columns;
        }

        // ----------------------------------------------------------------
        // Row building
        // ----------------------------------------------------------------

        private List<Dictionary<string, object>> BuildRows(
            List<Element> elements,
            Document doc,
            List<string> columns)
        {
            var rows = new List<Dictionary<string, object>>();

            foreach (var element in elements)
            {
                var row = new Dictionary<string, object>();

                // ElementId
                if (IncludeElementId)
                {
                    row["ElementId"] = element.Id.GetValue();
                }

                row["Category"] = element.Category?.Name ?? "";
                row["Name"] = element.Name ?? "";

                // Instance parameters
                var instanceParams = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                foreach (Parameter param in element.Parameters)
                {
                    if (!string.IsNullOrEmpty(param.Definition?.Name))
                        instanceParams[param.Definition.Name] = GetParameterDisplayValue(param, doc);
                }

                // Type parameters
                var typeParams = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                if (IncludeTypeParameters || (ParameterNames != null && ParameterNames.Count > 0))
                {
                    var typeId = element.GetTypeId();
                    if (typeId != null && typeId != ElementId.InvalidElementId)
                    {
                        var type = doc.GetElement(typeId);
                        if (type != null)
                        {
                            foreach (Parameter param in type.Parameters)
                            {
                                if (!string.IsNullOrEmpty(param.Definition?.Name))
                                    typeParams[param.Definition.Name] = GetParameterDisplayValue(param, doc);
                            }
                        }
                    }
                }

                // Populate each column
                foreach (var col in columns)
                {
                    if (col == "ElementId" || col == "Category" || col == "Name")
                        continue;

                    if (instanceParams.TryGetValue(col, out string iVal))
                        row[col] = iVal;
                    else if (typeParams.TryGetValue(col, out string tVal))
                        row[col] = tVal;
                    else
                        row[col] = "";
                }

                rows.Add(row);
            }

            return rows;
        }

        // ----------------------------------------------------------------
        // CSV output
        // ----------------------------------------------------------------

        private string BuildCsvOutput(List<string> columns, List<Dictionary<string, object>> rows)
        {
            var sb = new StringBuilder();

            // Header
            sb.AppendLine(string.Join(";", columns.Select(c => EscapeCsvField(c))));

            // Rows
            foreach (var row in rows)
            {
                var fields = columns.Select(col =>
                {
                    row.TryGetValue(col, out object val);
                    return EscapeCsvField(val?.ToString() ?? "");
                });
                sb.AppendLine(string.Join(";", fields));
            }

            return sb.ToString();
        }

        private string EscapeCsvField(string value)
        {
            if (string.IsNullOrEmpty(value)) return "";
            if (value.Contains(";") || value.Contains("\"") || value.Contains("\n"))
                return "\"" + value.Replace("\"", "\"\"") + "\"";
            return value;
        }

        // ----------------------------------------------------------------
        // Parameter value helpers
        // ----------------------------------------------------------------

        private string GetParameterDisplayValue(Parameter param, Document doc)
        {
            if (param == null) return "";

            try
            {
                switch (param.StorageType)
                {
                    case StorageType.String:
                        return param.AsString() ?? "";

                    case StorageType.Integer:
                        // Try to detect Yes/No parameters via AsValueString
                        try
                        {
                            string yesNoCheck = param.AsValueString();
                            if (yesNoCheck == "Yes" || yesNoCheck == "No")
                                return yesNoCheck;
                        }
                        catch { }
                        return param.AsInteger().ToString();

                    case StorageType.Double:
                        // Return the formatted string with display units when available
                        try
                        {
                            string formatted = param.AsValueString();
                            if (!string.IsNullOrEmpty(formatted)) return formatted;
                        }
                        catch { }
                        return param.AsDouble().ToString("F4", System.Globalization.CultureInfo.InvariantCulture);

                    case StorageType.ElementId:
                        var eid = param.AsElementId();
                        if (eid == null || eid == ElementId.InvalidElementId) return "";
                        var refElem = doc.GetElement(eid);
                        return refElem?.Name ?? eid.GetValue().ToString();

                    default:
                        return "";
                }
            }
            catch
            {
                return "";
            }
        }

        private string GetParameterRawValue(Element element, Document doc, string paramName)
        {
            var param = element.LookupParameter(paramName);
            if (param == null)
            {
                // Try type parameters
                var typeId = element.GetTypeId();
                if (typeId != null && typeId != ElementId.InvalidElementId)
                {
                    var type = doc.GetElement(typeId);
                    param = type?.LookupParameter(paramName);
                }
            }

            if (param == null) return null;

            switch (param.StorageType)
            {
                case StorageType.String:
                    return param.AsString() ?? "";
                case StorageType.Integer:
                    return param.AsInteger().ToString();
                case StorageType.Double:
                    return param.AsDouble().ToString("F6", System.Globalization.CultureInfo.InvariantCulture);
                case StorageType.ElementId:
                    var eid = param.AsElementId();
                    if (eid == null || eid == ElementId.InvalidElementId) return "";
                    var refElem = doc.GetElement(eid);
                    return refElem?.Name ?? eid.GetValue().ToString();
                default:
                    return "";
            }
        }

        // ----------------------------------------------------------------
        // Guidance
        // ----------------------------------------------------------------

        private object BuildGuidance(List<string> columns, int filteredCount)
        {
            var suggestions = new List<string>();

            if (filteredCount == MaxElements)
                suggestions.Add($"Result is limited to {MaxElements} elements. Use maxElements parameter to increase the limit or add category/filter constraints.");

            suggestions.Add("Use sync_csv_parameters to write values back to Revit elements using the ElementId column.");
            suggestions.Add("Use get_element_parameters with a specific ElementId to inspect all parameters of a single element.");

            if (columns.Contains("Level") || columns.Contains("Base Level"))
                suggestions.Add("You can filter by Level using filterParameterName='Level', filterOperator='equals', filterValue='<level name>'.");

            if (columns.Contains("Area"))
                suggestions.Add("Filter by area with filterParameterName='Area', filterOperator='greater_than', filterValue='<number in internal units>'.");

            return new
            {
                nextSteps = suggestions,
                tip = "Pass the 'data' field to sync_csv_parameters to batch-update parameters from AI-generated values."
            };
        }

        public string GetName() => "Export Elements Data";
    }
}
