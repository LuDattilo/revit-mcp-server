using System.Collections.Generic;

namespace RevitMCPCommandSet.Models.SiteMep
{
    // Request models for the site / shared-coordinate / MEP / IFC tools.
    //
    // Property names deliberately mirror the MCP JSON parameter names (Newtonsoft
    // binds them case-insensitively), and this file has no Newtonsoft or
    // RevitMCPSDK dependency so the Revit-side test project can compile it too.
    // All lengths are MILLIMETERS, all angles DEGREES.

    /// <summary>A point in millimeters.</summary>
    public class PointMm
    {
        public double X { get; set; }
        public double Y { get; set; }
        public double Z { get; set; }

        public PointMm() { }

        public PointMm(double x, double y, double z)
        {
            X = x;
            Y = y;
            Z = z;
        }
    }

    public static class SiteCoordinateSystems
    {
        public const string Internal = "internal";
        public const string Shared = "shared";
    }

    public class SetSharedCoordinatesRequest
    {
        public double EastWest_mm { get; set; }
        public double NorthSouth_mm { get; set; }
        public double Elevation_mm { get; set; }
        public double AngleToTrueNorth_deg { get; set; }
        /// <summary>Internal-coordinate point that should land on the given shared coordinates. Default 0,0,0.</summary>
        public PointMm InternalPoint_mm { get; set; }
        /// <summary>Optional: rename the active ProjectLocation (site) to this name.</summary>
        public string LocationName { get; set; }
        public bool DryRun { get; set; }
    }

    public class CreateToposolidRequest
    {
        public List<PointMm> Points_mm { get; set; } = new List<PointMm>();
        /// <summary>"internal" (default) or "shared".</summary>
        public string CoordinateSystem { get; set; } = SiteCoordinateSystems.Internal;
        public string ToposolidTypeName { get; set; }
        public string LevelName { get; set; }
        /// <summary>Optional value written to the Comments parameter (toposolids have no editable Name).</summary>
        public string Name { get; set; }
        public bool DryRun { get; set; }
    }

    public class PipeSegmentRequest
    {
        public PointMm Start_mm { get; set; }
        public PointMm End_mm { get; set; }
        public double Diameter_mm { get; set; }
        public string SystemTypeName { get; set; }
        public string PipeTypeName { get; set; }
        public string LevelName { get; set; }
    }

    public class CreatePipesRequest
    {
        public List<PipeSegmentRequest> Pipes { get; set; } = new List<PipeSegmentRequest>();
        public string CoordinateSystem { get; set; } = SiteCoordinateSystems.Internal;
        public bool DryRun { get; set; }
    }

    public class DuctSegmentRequest
    {
        public PointMm Start_mm { get; set; }
        public PointMm End_mm { get; set; }
        public double? Width_mm { get; set; }
        public double? Height_mm { get; set; }
        public double? Diameter_mm { get; set; }
        public string SystemTypeName { get; set; }
        public string DuctTypeName { get; set; }
        public string LevelName { get; set; }
    }

    public class CreateDuctsRequest
    {
        public List<DuctSegmentRequest> Ducts { get; set; } = new List<DuctSegmentRequest>();
        public string CoordinateSystem { get; set; } = SiteCoordinateSystems.Internal;
        public bool DryRun { get; set; }
    }

    public class GetMepElementsRequest
    {
        /// <summary>"all" (default), "pipes", "ducts", "fittings".</summary>
        public string Category { get; set; } = "all";
        public string SystemName { get; set; }
        public int Limit { get; set; } = 500;
    }

    public class ExportIfcRequest
    {
        public string OutputFolder { get; set; }
        public string FileName { get; set; }
        /// <summary>"IFC2x3", "IFC4" (default) or "IFC4x3".</summary>
        public string IfcVersion { get; set; } = "IFC4";
        public string ViewName { get; set; }
        public bool ExportBaseQuantities { get; set; }
        /// <summary>true (default): IfcSite placed at shared coordinates; false: internal origin.</summary>
        public bool UseSharedCoordinates { get; set; } = true;
        public bool DryRun { get; set; }
    }
}
