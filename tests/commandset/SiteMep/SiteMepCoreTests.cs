using System.Text.RegularExpressions;
using Autodesk.Revit.DB;
using Nice3point.TUnit.Revit;
using Nice3point.TUnit.Revit.Executors;
using RevitMCPCommandSet.Models.SiteMep;
using RevitMCPCommandSet.Services.SiteMep;
using TUnit.Core;
using TUnit.Core.Executors;

namespace RevitMCPCommandSet.Tests.SiteMep;

/// <summary>
/// Exercises the production SiteMepCore logic (linked into this project) against a real
/// Revit document created from the installed metric multi-discipline template.
/// Tests run sequentially because several of them change the document's shared coordinates.
/// </summary>
[NotInParallel]
public class SiteMepCoreTests : RevitApiTest
{
    private static Document _doc;

    private static string FindTemplate()
    {
        var version = Application.VersionNumber;
        var root = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "Autodesk", $"RVT {version}", "Templates");
        foreach (var candidate in new[]
                 {
                     Path.Combine(root, "English", "Default-Multi-Discipline_Metric.rte"),
                     Path.Combine(root, "English", "Systems-Default_Metric.rte"),
                     Path.Combine(root, "Default_M_ENU.rte")
                 })
        {
            if (File.Exists(candidate)) return candidate;
        }
        throw new FileNotFoundException($"No metric project template found under {root}");
    }

    [Before(HookType.Class)]
    [HookExecutor<RevitThreadExecutor>]
    public static void Setup()
    {
        _doc = Application.NewProjectDocument(FindTemplate());
    }

    [After(HookType.Class)]
    [HookExecutor<RevitThreadExecutor>]
    public static void Cleanup()
    {
        _doc?.Close(false);
    }

    private static void ResetSharedCoordinates()
    {
        SiteMepCore.SetSharedCoordinates(_doc, new SetSharedCoordinatesRequest());
    }

    private static double Get(Dictionary<string, object> d, params string[] path)
    {
        object cur = d;
        foreach (var key in path) cur = ((Dictionary<string, object>)cur)[key];
        return Convert.ToDouble(cur);
    }

    // ------------------------------------------------------------ coordinates

    [Test]
    public async Task SetSharedCoordinates_AtOrigin_InternalOriginReportsRequestedSharedCoordinates()
    {
        var result = SiteMepCore.SetSharedCoordinates(_doc, new SetSharedCoordinatesRequest
        {
            EastWest_mm = 500000, NorthSouth_mm = 4000000, Elevation_mm = 100000, AngleToTrueNorth_deg = 0
        });

        await Assert.That(Get(result, "internalPointSharedAfter_mm", "x")).IsEqualTo(500000).Within(0.5);
        await Assert.That(Get(result, "internalPointSharedAfter_mm", "y")).IsEqualTo(4000000).Within(0.5);
        await Assert.That(Get(result, "internalPointSharedAfter_mm", "z")).IsEqualTo(100000).Within(0.5);

        var loc = SiteMepCore.GetProjectLocation(_doc);
        await Assert.That(Get(loc, "sharedTransform", "origin_mm", "x")).IsEqualTo(500000).Within(0.5);
        await Assert.That(Get(loc, "sharedTransform", "origin_mm", "y")).IsEqualTo(4000000).Within(0.5);
        await Assert.That(Get(loc, "sharedTransform", "rotation_deg")).IsEqualTo(0).Within(1e-6);

        ResetSharedCoordinates();
    }

    [Test]
    public async Task SetSharedCoordinates_RotatedAtArbitraryPoint_PointMapsExactlyAndAngleRoundTrips()
    {
        var result = SiteMepCore.SetSharedCoordinates(_doc, new SetSharedCoordinatesRequest
        {
            EastWest_mm = 123456, NorthSouth_mm = 654321, Elevation_mm = 2500, AngleToTrueNorth_deg = 30,
            InternalPoint_mm = new PointMm(10000, 5000, 0)
        });

        await Assert.That(Get(result, "internalPointSharedAfter_mm", "x")).IsEqualTo(123456).Within(0.5);
        await Assert.That(Get(result, "internalPointSharedAfter_mm", "y")).IsEqualTo(654321).Within(0.5);
        await Assert.That(Get(result, "internalPointSharedAfter_mm", "z")).IsEqualTo(2500).Within(0.5);
        await Assert.That(Get(result, "after", "projectBasePoint", "angleToTrueNorth_deg")).IsEqualTo(30).Within(1e-6);

        // Observed on Revit 2027: the internal->shared rotation has the same sign as the
        // ProjectPosition angle (a positive angle rotates internal axes counter-clockwise).
        await Assert.That(Get(result, "after", "sharedTransform", "rotation_deg")).IsEqualTo(30).Within(1e-6);

        // Shared -> internal -> shared round trip through the helpers.
        var shared = new PointMm(123456, 654321, 2500);
        var internalPt = SiteMepCore.ResolvePoint(_doc, shared, "shared");
        await Assert.That(internalPt.X * 304.8).IsEqualTo(10000).Within(0.5);
        await Assert.That(internalPt.Y * 304.8).IsEqualTo(5000).Within(0.5);
        await Assert.That(internalPt.Z * 304.8).IsEqualTo(0).Within(0.5);

        ResetSharedCoordinates();
    }

    [Test]
    public async Task SetSharedCoordinates_DryRun_LeavesDocumentUnchanged()
    {
        var before = SiteMepCore.GetProjectLocation(_doc);
        var result = SiteMepCore.SetSharedCoordinates(_doc, new SetSharedCoordinatesRequest
        {
            EastWest_mm = 999000, NorthSouth_mm = 111000, Elevation_mm = 5000, AngleToTrueNorth_deg = 12, DryRun = true
        });
        var after = SiteMepCore.GetProjectLocation(_doc);

        await Assert.That(Get(result, "internalPointSharedAfter_mm", "x")).IsEqualTo(999000).Within(0.5);
        await Assert.That(Get(after, "sharedTransform", "origin_mm", "x")).IsEqualTo(Get(before, "sharedTransform", "origin_mm", "x")).Within(1e-6);
        await Assert.That(Get(after, "projectBasePoint", "angleToTrueNorth_deg")).IsEqualTo(Get(before, "projectBasePoint", "angleToTrueNorth_deg")).Within(1e-9);
    }

    [Test]
    public async Task SetSharedCoordinates_LocationName_RenamesActiveLocation()
    {
        var original = _doc.ActiveProjectLocation.Name;
        SiteMepCore.SetSharedCoordinates(_doc, new SetSharedCoordinatesRequest { LocationName = "MCP Test Site" });
        var loc = SiteMepCore.GetProjectLocation(_doc);
        await Assert.That((string)loc["activeLocationName"]).IsEqualTo("MCP Test Site");
        SiteMepCore.SetSharedCoordinates(_doc, new SetSharedCoordinatesRequest { LocationName = original });
    }

    // ------------------------------------------------------------ toposolids

    private static List<PointMm> Hill(double ox, double oy, double oz) => new()
    {
        new PointMm(ox, oy, oz),
        new PointMm(ox + 20000, oy, oz),
        new PointMm(ox + 20000, oy + 20000, oz),
        new PointMm(ox, oy + 20000, oz),
        new PointMm(ox + 10000, oy + 10000, oz + 3000)
    };

    [Test]
    public async Task CreateToposolid_InternalPoints_CreatesTopoWithExpectedExtents()
    {
        var result = SiteMepCore.CreateToposolid(_doc, new CreateToposolidRequest
        {
            Points_mm = Hill(0, 0, 0), Name = "MCP hill"
        });

        await Assert.That(result["elementId"]).IsNotNull();
        await Assert.That(Convert.ToInt32(result["pointCount"])).IsGreaterThanOrEqualTo(5);
        await Assert.That(Get(result, "boundingBox_mm", "max", "x")).IsEqualTo(20000).Within(1);
        await Assert.That(Get(result, "boundingBox_mm", "min", "y")).IsEqualTo(0).Within(1);
        await Assert.That(Get(result, "boundingBox_mm", "max", "z")).IsEqualTo(3000).Within(1);
        await Assert.That((string)result["comments"]).IsEqualTo("MCP hill");

        var list = SiteMepCore.GetToposolids(_doc, includePoints: true);
        var mine = ((List<Dictionary<string, object>>)list["toposolids"])
            .Single(t => Convert.ToInt64(t["elementId"]) == Convert.ToInt64(result["elementId"]));
        var pts = (List<Dictionary<string, object>>)mine["points_mm"];
        await Assert.That(pts.Count).IsGreaterThanOrEqualTo(5);
        await Assert.That(pts.Any(p => Math.Abs(Convert.ToDouble(p["z"]) - 3000) < 1 && Math.Abs(Convert.ToDouble(p["x"]) - 10000) < 1)).IsTrue();
    }

    [Test]
    public async Task CreateToposolid_SharedPoints_AreTransformedToInternal()
    {
        SiteMepCore.SetSharedCoordinates(_doc, new SetSharedCoordinatesRequest
        {
            EastWest_mm = 500000, NorthSouth_mm = 4000000, Elevation_mm = 100000
        });
        try
        {
            var result = SiteMepCore.CreateToposolid(_doc, new CreateToposolidRequest
            {
                Points_mm = Hill(500000 + 50000, 4000000 + 50000, 100000), CoordinateSystem = "shared"
            });
            await Assert.That(Get(result, "boundingBox_mm", "min", "x")).IsEqualTo(50000).Within(1);
            await Assert.That(Get(result, "boundingBox_mm", "min", "y")).IsEqualTo(50000).Within(1);
            await Assert.That(Get(result, "boundingBox_mm", "max", "z")).IsEqualTo(3000).Within(1);
        }
        finally
        {
            ResetSharedCoordinates();
        }
    }

    [Test]
    public async Task CreateToposolid_OverlappingFloor_ReturnsWarningInsteadOfDialog()
    {
        // Live Revit showed "Highlighted toposolid and floor overlap" as a modal dialog at
        // commit, which blocked every later MCP command. The warning must come back in the result.
        const double ox = 300000, oy = 300000;
        var level = new FilteredElementCollector(_doc).OfClass(typeof(Level)).Cast<Level>().OrderBy(l => Math.Abs(l.Elevation)).First();
        var floorType = new FilteredElementCollector(_doc).OfClass(typeof(FloorType)).Cast<FloorType>().First(t => !t.IsFoundationSlab);
        using (var tx = new Transaction(_doc, "test floor"))
        {
            tx.Start();
            var p = new[] { new XYZ(ox + 5000, oy + 5000, 0), new XYZ(ox + 15000, oy + 5000, 0), new XYZ(ox + 15000, oy + 15000, 0), new XYZ(ox + 5000, oy + 15000, 0) }
                .Select(v => v / SiteMepCore.MmPerFoot).ToArray();
            var loop = new CurveLoop();
            for (int i = 0; i < p.Length; i++) loop.Append(Line.CreateBound(p[i], p[(i + 1) % p.Length]));
            Floor.Create(_doc, new List<CurveLoop> { loop }, floorType.Id, level.Id);
            tx.Commit();
        }

        var result = SiteMepCore.CreateToposolid(_doc, new CreateToposolidRequest
        {
            Points_mm = Hill(ox, oy, level.Elevation * SiteMepCore.MmPerFoot)
        });

        await Assert.That((bool)result["committed"]).IsTrue();
        await Assert.That(result["elementId"]).IsNotNull();
        var warnings = (List<string>)result["warnings"];
        await Assert.That(warnings.Any(w => w.Contains("overlap", StringComparison.OrdinalIgnoreCase))).IsTrue();
    }

    [Test]
    public async Task CreateToposolid_DryRun_DoesNotPersist()
    {
        int before = new FilteredElementCollector(_doc).OfClass(typeof(Toposolid)).GetElementCount();
        var result = SiteMepCore.CreateToposolid(_doc, new CreateToposolidRequest
        {
            Points_mm = Hill(-100000, -100000, 0), DryRun = true
        });
        int after = new FilteredElementCollector(_doc).OfClass(typeof(Toposolid)).GetElementCount();

        await Assert.That(after).IsEqualTo(before);
        await Assert.That((bool)result["committed"]).IsFalse();
        await Assert.That(Get(result, "boundingBox_mm", "max", "z")).IsEqualTo(3000).Within(1);
    }

    [Test]
    public async Task CreateToposolid_TooFewPoints_Throws()
    {
        await Assert.That(() => SiteMepCore.CreateToposolid(_doc, new CreateToposolidRequest
        {
            Points_mm = new List<PointMm> { new(0, 0, 0), new(1000, 0, 0) }
        })).Throws<ArgumentException>();
    }

    // ------------------------------------------------------------------ MEP

    // NOTE: keep this non-generic. A generic helper constrained to a Revit type
    // (FirstName<T>() where T : Element) made Nice3point's Revit injector fail for the whole
    // test session with "Attempted to write protected memory" (observed with Revit 2027).
    private static string FirstName(Type t) =>
        new FilteredElementCollector(_doc).OfClass(t).FirstElement()?.Name;

    private static string FirstLevelName() =>
        new FilteredElementCollector(_doc).OfClass(typeof(Level)).Cast<Level>().OrderBy(l => l.Elevation).First().Name;

    [Test]
    public async Task CreatePipe_WithDiameter_CreatesPipeAndSystem()
    {
        var systemTypeName = FirstName(typeof(Autodesk.Revit.DB.Plumbing.PipingSystemType));
        await Assert.That(systemTypeName).IsNotNull();

        var result = SiteMepCore.CreatePipes(_doc, new CreatePipesRequest
        {
            Pipes = new List<PipeSegmentRequest>
            {
                new()
                {
                    Start_mm = new PointMm(0, 0, 3000), End_mm = new PointMm(6000, 0, 3000),
                    Diameter_mm = 100, SystemTypeName = systemTypeName, LevelName = FirstLevelName()
                }
            }
        });

        var pipe = ((List<Dictionary<string, object>>)result["pipes"]).Single();
        await Assert.That(pipe["elementId"]).IsNotNull();
        await Assert.That(Convert.ToDouble(pipe["length_mm"])).IsEqualTo(6000).Within(1);
        await Assert.That(Convert.ToDouble(pipe["diameter_mm"])).IsEqualTo(100).Within(1);
        await Assert.That(Get(pipe, "start_mm", "z")).IsEqualTo(3000).Within(0.5);

        var elements = SiteMepCore.GetMepElements(_doc, new GetMepElementsRequest { Category = "pipes" });
        await Assert.That(Convert.ToInt32(elements["totalMatched"])).IsGreaterThanOrEqualTo(1);

        var systems = SiteMepCore.GetMepSystems(_doc);
        var piping = ((List<Dictionary<string, object>>)systems["systems"]).Where(s => (string)s["domain"] == "piping").ToList();
        await Assert.That(piping.Count).IsGreaterThanOrEqualTo(1);
        await Assert.That(piping.Sum(s => Convert.ToDouble(s["totalLength_mm"]))).IsGreaterThanOrEqualTo(5999);
    }

    [Test]
    public async Task CreatePipe_DryRun_DoesNotPersist()
    {
        int before = new FilteredElementCollector(_doc).OfClass(typeof(Autodesk.Revit.DB.Plumbing.Pipe)).GetElementCount();
        var result = SiteMepCore.CreatePipes(_doc, new CreatePipesRequest
        {
            DryRun = true,
            Pipes = new List<PipeSegmentRequest>
            {
                new()
                {
                    Start_mm = new PointMm(0, 5000, 3000), End_mm = new PointMm(0, 9000, 3000),
                    Diameter_mm = 50, SystemTypeName = FirstName(typeof(Autodesk.Revit.DB.Plumbing.PipingSystemType)), LevelName = FirstLevelName()
                }
            }
        });
        int after = new FilteredElementCollector(_doc).OfClass(typeof(Autodesk.Revit.DB.Plumbing.Pipe)).GetElementCount();
        await Assert.That(after).IsEqualTo(before);
        await Assert.That(Convert.ToInt32(result["count"])).IsEqualTo(1);
    }

    [Test]
    public async Task CreatePipe_UnknownSystemType_ThrowsAndRollsBackBatch()
    {
        int before = new FilteredElementCollector(_doc).OfClass(typeof(Autodesk.Revit.DB.Plumbing.Pipe)).GetElementCount();
        await Assert.That(() => SiteMepCore.CreatePipes(_doc, new CreatePipesRequest
        {
            Pipes = new List<PipeSegmentRequest>
            {
                new()
                {
                    Start_mm = new PointMm(0, 20000, 3000), End_mm = new PointMm(3000, 20000, 3000),
                    Diameter_mm = 50, SystemTypeName = FirstName(typeof(Autodesk.Revit.DB.Plumbing.PipingSystemType)), LevelName = FirstLevelName()
                },
                new()
                {
                    Start_mm = new PointMm(0, 21000, 3000), End_mm = new PointMm(3000, 21000, 3000),
                    Diameter_mm = 50, SystemTypeName = "No Such System", LevelName = FirstLevelName()
                }
            }
        })).Throws<InvalidOperationException>();
        int after = new FilteredElementCollector(_doc).OfClass(typeof(Autodesk.Revit.DB.Plumbing.Pipe)).GetElementCount();
        await Assert.That(after).IsEqualTo(before);
    }

    [Test]
    public async Task CreateDuct_RectangularAndRound_SizesApplied()
    {
        var systemTypeName = FirstName(typeof(Autodesk.Revit.DB.Mechanical.MechanicalSystemType));
        await Assert.That(systemTypeName).IsNotNull();
        var level = FirstLevelName();

        var result = SiteMepCore.CreateDucts(_doc, new CreateDuctsRequest
        {
            Ducts = new List<DuctSegmentRequest>
            {
                new()
                {
                    Start_mm = new PointMm(0, 30000, 3500), End_mm = new PointMm(8000, 30000, 3500),
                    Width_mm = 400, Height_mm = 300, SystemTypeName = systemTypeName, LevelName = level
                },
                new()
                {
                    Start_mm = new PointMm(0, 32000, 3500), End_mm = new PointMm(8000, 32000, 3500),
                    Diameter_mm = 250, SystemTypeName = systemTypeName, LevelName = level
                }
            }
        });

        var ducts = (List<Dictionary<string, object>>)result["ducts"];
        await Assert.That(ducts.Count).IsEqualTo(2);
        await Assert.That(Convert.ToDouble(ducts[0]["width_mm"])).IsEqualTo(400).Within(1);
        await Assert.That(Convert.ToDouble(ducts[0]["height_mm"])).IsEqualTo(300).Within(1);
        await Assert.That(Convert.ToDouble(ducts[1]["diameter_mm"])).IsEqualTo(250).Within(1);
        await Assert.That(Convert.ToDouble(ducts[1]["length_mm"])).IsEqualTo(8000).Within(1);

        var systems = SiteMepCore.GetMepSystems(_doc);
        var mech = ((List<Dictionary<string, object>>)systems["systems"]).Where(s => (string)s["domain"] == "mechanical").ToList();
        await Assert.That(mech.Count).IsGreaterThanOrEqualTo(1);
    }

    [Test]
    public async Task CreatePipe_SharedCoordinates_TransformedToInternal()
    {
        SiteMepCore.SetSharedCoordinates(_doc, new SetSharedCoordinatesRequest
        {
            EastWest_mm = 1000000, NorthSouth_mm = 2000000, Elevation_mm = 50000, AngleToTrueNorth_deg = 0
        });
        try
        {
            var result = SiteMepCore.CreatePipes(_doc, new CreatePipesRequest
            {
                CoordinateSystem = "shared",
                Pipes = new List<PipeSegmentRequest>
                {
                    new()
                    {
                        Start_mm = new PointMm(1000000, 2040000, 53000), End_mm = new PointMm(1004000, 2040000, 53000),
                        Diameter_mm = 80, SystemTypeName = FirstName(typeof(Autodesk.Revit.DB.Plumbing.PipingSystemType)), LevelName = FirstLevelName()
                    }
                }
            });
            var pipe = ((List<Dictionary<string, object>>)result["pipes"]).Single();
            await Assert.That(Get(pipe, "start_mm", "x")).IsEqualTo(0).Within(0.5);
            await Assert.That(Get(pipe, "start_mm", "y")).IsEqualTo(40000).Within(0.5);
            await Assert.That(Get(pipe, "start_mm", "z")).IsEqualTo(3000).Within(0.5);
        }
        finally
        {
            ResetSharedCoordinates();
        }
    }

    // ------------------------------------------------------------------ IFC

    private static string SitePlacementPoint(string ifcText)
    {
        // #a=IFCSITE('guid',#owner,'name',$,$,#placement,...
        var site = Regex.Match(ifcText, @"=IFCSITE\('[^']*',#\d+,[^,]*,[^,]*,[^,]*,#(\d+)");
        if (!site.Success) return null;
        var placement = Regex.Match(ifcText, $@"#{site.Groups[1].Value}=IFCLOCALPLACEMENT\([^,]*,#(\d+)\)");
        if (!placement.Success) return null;
        var axis = Regex.Match(ifcText, $@"#{placement.Groups[1].Value}=IFCAXIS2PLACEMENT3D\(#(\d+)");
        if (!axis.Success) return null;
        var point = Regex.Match(ifcText, $@"#{axis.Groups[1].Value}=IFCCARTESIANPOINT\(\(([^)]*)\)\)");
        return point.Success ? point.Groups[1].Value : null;
    }

    [Test]
    public async Task ExportIfc_SharedVsInternal_SitePlacementDiffers()
    {
        var folder = Path.Combine(Path.GetTempPath(), "revit-mcp-ifc-tests-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(folder);
        SiteMepCore.SetSharedCoordinates(_doc, new SetSharedCoordinatesRequest
        {
            EastWest_mm = 500000, NorthSouth_mm = 4000000, Elevation_mm = 100000
        });
        try
        {
            var dry = SiteMepCore.ExportIfc(_doc, new ExportIfcRequest { OutputFolder = folder, FileName = "dry", DryRun = true });
            await Assert.That((bool)dry["exported"]).IsFalse();
            await Assert.That(File.Exists(Path.Combine(folder, "dry.ifc"))).IsFalse();

            var shared = SiteMepCore.ExportIfc(_doc, new ExportIfcRequest
            {
                OutputFolder = folder, FileName = "shared.ifc", IfcVersion = "IFC4", UseSharedCoordinates = true, ExportBaseQuantities = true
            });
            var internalExport = SiteMepCore.ExportIfc(_doc, new ExportIfcRequest
            {
                OutputFolder = folder, FileName = "internal", IfcVersion = "IFC2x3", UseSharedCoordinates = false
            });

            await Assert.That(Convert.ToInt64(shared["sizeBytes"])).IsGreaterThan(0);
            await Assert.That(Convert.ToInt64(internalExport["sizeBytes"])).IsGreaterThan(0);

            var sharedText = File.ReadAllText((string)shared["path"]);
            var internalText = File.ReadAllText((string)internalExport["path"]);
            await Assert.That(sharedText).Contains("FILE_SCHEMA(('IFC4'))");
            await Assert.That(internalText).Contains("FILE_SCHEMA(('IFC2X3'))");

            var sharedSite = SitePlacementPoint(sharedText);
            var internalSite = SitePlacementPoint(internalText);
            Console.WriteLine($"IfcSite placement shared='{sharedSite}' internal='{internalSite}'");
            await Assert.That(sharedSite).IsNotNull();
            await Assert.That(internalSite).IsNotNull();
            await Assert.That(sharedSite).IsNotEqualTo(internalSite);
        }
        finally
        {
            ResetSharedCoordinates();
            try { Directory.Delete(folder, true); } catch { /* best effort */ }
        }
    }

    [Test]
    public async Task ExportIfc_MissingFolder_Throws()
    {
        await Assert.That(() => SiteMepCore.ExportIfc(_doc, new ExportIfcRequest
        {
            OutputFolder = Path.Combine(Path.GetTempPath(), "does-not-exist-" + Guid.NewGuid().ToString("N")), FileName = "x"
        })).Throws<DirectoryNotFoundException>();
    }
}
