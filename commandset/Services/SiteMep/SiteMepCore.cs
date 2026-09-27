using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Autodesk.Revit.DB;
using Autodesk.Revit.DB.Mechanical;
using Autodesk.Revit.DB.Plumbing;
using RevitMCPCommandSet.Models.SiteMep;

namespace RevitMCPCommandSet.Services.SiteMep
{
    /// <summary>
    /// Revit API logic for the project-location / shared-coordinate, toposolid, MEP and IFC tools.
    ///
    /// Everything here depends only on the Revit API (no RevitMCPSDK, no Newtonsoft) so that the
    /// Revit-side test project can compile this file directly and exercise the production code.
    /// Units at the boundary: millimeters and degrees. Internally Revit uses feet and radians.
    ///
    /// Write operations each run in exactly one Transaction named after the MCP tool. When
    /// dryRun is set the transaction is still started and the work is performed (so Revit
    /// validates it and the caller sees realistic results) and then rolled back.
    /// </summary>
    public static class SiteMepCore
    {
        public const double MmPerFoot = 304.8;

        // ----------------------------------------------------------------- helpers

        public static double ToFeet(double mm) => mm / MmPerFoot;
        public static double ToMm(double feet) => Math.Round(feet * MmPerFoot, 3);
        public static double ToDeg(double rad) => Math.Round(rad * 180.0 / Math.PI, 6);
        public static double ToRad(double deg) => deg * Math.PI / 180.0;

        public static XYZ ToXyzFeet(PointMm p) => new XYZ(ToFeet(p.X), ToFeet(p.Y), ToFeet(p.Z));

        public static Dictionary<string, object> PointToMm(XYZ p) => new Dictionary<string, object>
        {
            ["x"] = ToMm(p.X),
            ["y"] = ToMm(p.Y),
            ["z"] = ToMm(p.Z)
        };

        public static long IdValue(ElementId id)
        {
#if REVIT2024_OR_GREATER
            return id.Value;
#else
            return id.IntegerValue;
#endif
        }

        private static string ParamString(Element e, BuiltInParameter bip)
        {
            var p = e?.get_Parameter(bip);
            if (p == null || !p.HasValue) return null;
            return p.StorageType == StorageType.String ? p.AsString() : p.AsValueString();
        }

        private static double? ParamDoubleMm(Element e, BuiltInParameter bip)
        {
            var p = e?.get_Parameter(bip);
            if (p == null || !p.HasValue || p.StorageType != StorageType.Double) return null;
            return ToMm(p.AsDouble());
        }

        private static Dictionary<string, object> BoundingBoxMm(Element e)
        {
            var bb = e.get_BoundingBox(null);
            if (bb == null) return null;
            return new Dictionary<string, object> { ["min"] = PointToMm(bb.Min), ["max"] = PointToMm(bb.Max) };
        }

        private static bool NameEquals(string a, string b) =>
            string.Equals(a?.Trim(), b?.Trim(), StringComparison.OrdinalIgnoreCase);

        /// <summary>
        /// Transform that maps SHARED coordinates (feet) to INTERNAL coordinates (feet)
        /// for the active project location. Its inverse maps internal to shared.
        /// </summary>
        public static Transform SharedToInternal(Document doc) => doc.ActiveProjectLocation.GetTotalTransform();

        /// <summary>Transform that maps INTERNAL coordinates (feet) to SHARED coordinates (feet).</summary>
        public static Transform InternalToShared(Document doc) => SharedToInternal(doc).Inverse;

        /// <summary>Converts a user-supplied mm point into internal feet, honouring coordinateSystem.</summary>
        public static XYZ ResolvePoint(Document doc, PointMm p, string coordinateSystem, Transform sharedToInternal = null)
        {
            if (p == null) throw new ArgumentException("Point is missing (expected {x,y,z} in mm).");
            var xyz = ToXyzFeet(p);
            if (IsShared(coordinateSystem))
                xyz = (sharedToInternal ?? SharedToInternal(doc)).OfPoint(xyz);
            return xyz;
        }

        public static bool IsShared(string coordinateSystem)
        {
            if (string.IsNullOrWhiteSpace(coordinateSystem) || NameEquals(coordinateSystem, SiteCoordinateSystems.Internal))
                return false;
            if (NameEquals(coordinateSystem, SiteCoordinateSystems.Shared))
                return true;
            throw new ArgumentException($"coordinateSystem must be \"internal\" or \"shared\" (got \"{coordinateSystem}\").");
        }

        public static Level ResolveLevel(Document doc, string levelName, bool required)
        {
            var levels = new FilteredElementCollector(doc).OfClass(typeof(Level)).Cast<Level>().ToList();
            if (!string.IsNullOrWhiteSpace(levelName))
            {
                var match = levels.FirstOrDefault(l => NameEquals(l.Name, levelName));
                if (match == null)
                    throw new ArgumentException($"Level '{levelName}' not found. Available: {string.Join(", ", levels.OrderBy(l => l.Elevation).Select(l => l.Name))}");
                return match;
            }
            if (required)
                throw new ArgumentException("levelName is required.");
            // Default: the level whose elevation is closest to 0.
            var fallback = levels.OrderBy(l => Math.Abs(l.Elevation)).FirstOrDefault();
            if (fallback == null) throw new InvalidOperationException("The document has no levels.");
            return fallback;
        }

        private static T ResolveTypeByName<T>(Document doc, string name, string what, Func<T, bool> preferred = null) where T : ElementType
        {
            var all = new FilteredElementCollector(doc).OfClass(typeof(T)).Cast<T>().ToList();
            if (all.Count == 0) throw new InvalidOperationException($"The document has no {what}.");
            if (!string.IsNullOrWhiteSpace(name))
            {
                var match = all.FirstOrDefault(t => NameEquals(t.Name, name));
                if (match == null)
                    throw new ArgumentException($"{what} '{name}' not found. Available: {string.Join(", ", all.Select(t => t.Name).OrderBy(n => n))}");
                return match;
            }
            if (preferred != null)
            {
                var pref = all.FirstOrDefault(preferred);
                if (pref != null) return pref;
            }
            return all.First();
        }

        private static void RequireModifiable(Document doc)
        {
            if (doc.IsReadOnly) throw new InvalidOperationException("The active document is read-only.");
            if (doc.IsFamilyDocument) throw new InvalidOperationException("This tool requires a project document, not a family document.");
        }

        // ------------------------------------------------------ project location

        public static Dictionary<string, object> GetProjectLocation(Document doc)
        {
            var location = doc.ActiveProjectLocation;
            var toShared = InternalToShared(doc);
            var originPosition = location.GetProjectPosition(XYZ.Zero);

            var survey = BasePoint.GetSurveyPoint(doc);
            var pbp = BasePoint.GetProjectBasePoint(doc);

            XYZ surveyShared = survey != null ? survey.SharedPosition : XYZ.Zero;
            XYZ pbpShared = pbp != null ? pbp.SharedPosition : toShared.OfPoint(XYZ.Zero);

            var sharedOrigin = toShared.OfPoint(XYZ.Zero);
            double rotation = Math.Atan2(toShared.BasisX.Y, toShared.BasisX.X);

            var site = doc.SiteLocation;
            var result = new Dictionary<string, object>
            {
                ["activeLocationName"] = location.Name,
                ["surveyPoint"] = new Dictionary<string, object>
                {
                    ["eastWest_mm"] = ToMm(surveyShared.X),
                    ["northSouth_mm"] = ToMm(surveyShared.Y),
                    ["elevation_mm"] = ToMm(surveyShared.Z),
                    ["internal_mm"] = survey != null ? PointToMm(survey.Position) : null,
#if REVIT2021_OR_GREATER || REVIT2022_OR_GREATER
                    // BasePoint.Clipped arrived in the Revit 2021 API. Every current configuration
                    // defines REVIT2022_OR_GREATER; the first symbol covers a 2021 build.
                    ["clipped"] = survey?.Clipped
#endif
                },
                ["projectBasePoint"] = new Dictionary<string, object>
                {
                    ["eastWest_mm"] = ToMm(pbpShared.X),
                    ["northSouth_mm"] = ToMm(pbpShared.Y),
                    ["elevation_mm"] = ToMm(pbpShared.Z),
                    ["angleToTrueNorth_deg"] = ToDeg(originPosition.Angle),
                    ["internal_mm"] = pbp != null ? PointToMm(pbp.Position) : null
                },
                ["sharedTransform"] = new Dictionary<string, object>
                {
                    // Shared coordinates of the internal origin, and the rotation (about Z, CCW
                    // positive) that takes internal axes to shared axes.
                    ["origin_mm"] = PointToMm(sharedOrigin),
                    ["rotation_deg"] = ToDeg(rotation),
                    ["description"] = "shared = R(rotation_deg) * internal + origin_mm"
                },
                ["siteLatitude"] = site != null ? ToDeg(site.Latitude) : (double?)null,
                ["siteLongitude"] = site != null ? ToDeg(site.Longitude) : (double?)null,
                ["siteName"] = site?.PlaceName,
                ["projectLocations"] = doc.ProjectLocations.Cast<ProjectLocation>().Select(l => l.Name).ToList()
            };

            return result;
        }

        public static Dictionary<string, object> SetSharedCoordinates(Document doc, SetSharedCoordinatesRequest req, string transactionName = "set_shared_coordinates")
        {
            if (req == null) throw new ArgumentNullException(nameof(req));
            RequireModifiable(doc);
            foreach (var v in new[] { req.EastWest_mm, req.NorthSouth_mm, req.Elevation_mm, req.AngleToTrueNorth_deg })
                if (double.IsNaN(v) || double.IsInfinity(v)) throw new ArgumentException("Coordinates and angle must be finite numbers.");

            var internalPointMm = req.InternalPoint_mm ?? new PointMm(0, 0, 0);
            var internalPoint = ToXyzFeet(internalPointMm);

            var before = GetProjectLocation(doc);
            var sharedOfPointBefore = InternalToShared(doc).OfPoint(internalPoint);

            Dictionary<string, object> after;
            XYZ sharedOfPointAfter;
            string renamedTo = null;
            List<string> warnings;

            using (var tx = new Transaction(doc, transactionName))
            {
                tx.Start();
                var failures = FailureCollector.Attach(tx);
                try
                {
                    var location = doc.ActiveProjectLocation;
                    if (!string.IsNullOrWhiteSpace(req.LocationName) && !NameEquals(location.Name, req.LocationName))
                    {
                        bool taken = doc.ProjectLocations.Cast<ProjectLocation>()
                            .Any(l => l.Id != location.Id && NameEquals(l.Name, req.LocationName));
                        if (taken)
                            throw new ArgumentException($"A project location named '{req.LocationName}' already exists.");
                        location.Name = req.LocationName;
                        renamedTo = location.Name;
                    }

                    var position = new ProjectPosition(
                        ToFeet(req.EastWest_mm),
                        ToFeet(req.NorthSouth_mm),
                        ToFeet(req.Elevation_mm),
                        ToRad(req.AngleToTrueNorth_deg));
                    location.SetProjectPosition(internalPoint, position);

                    doc.Regenerate();
                    after = GetProjectLocation(doc);
                    sharedOfPointAfter = InternalToShared(doc).OfPoint(internalPoint);

                    if (req.DryRun) tx.RollBack();
                    else failures.CommitOrThrow(tx);
                }
                catch
                {
                    if (tx.GetStatus() == TransactionStatus.Started) tx.RollBack();
                    throw;
                }
                warnings = failures.Warnings;
            }

            return new Dictionary<string, object>
            {
                ["dryRun"] = req.DryRun,
                ["committed"] = !req.DryRun,
                ["warnings"] = warnings,
                ["internalPoint_mm"] = new Dictionary<string, object> { ["x"] = internalPointMm.X, ["y"] = internalPointMm.Y, ["z"] = internalPointMm.Z },
                ["requested"] = new Dictionary<string, object>
                {
                    ["eastWest_mm"] = req.EastWest_mm,
                    ["northSouth_mm"] = req.NorthSouth_mm,
                    ["elevation_mm"] = req.Elevation_mm,
                    ["angleToTrueNorth_deg"] = req.AngleToTrueNorth_deg
                },
                ["internalPointSharedBefore_mm"] = PointToMm(sharedOfPointBefore),
                ["internalPointSharedAfter_mm"] = PointToMm(sharedOfPointAfter),
                ["renamedLocationTo"] = renamedTo,
                ["before"] = before,
                ["after"] = after
            };
        }

        // ------------------------------------------------------------ toposolids

#if REVIT2024_OR_GREATER
        public static Dictionary<string, object> CreateToposolid(Document doc, CreateToposolidRequest req, string transactionName = "create_toposolid")
        {
            if (req == null) throw new ArgumentNullException(nameof(req));
            RequireModifiable(doc);
            if (req.Points_mm == null || req.Points_mm.Count < 3)
                throw new ArgumentException("points_mm needs at least 3 points.");

            var sharedToInternal = SharedToInternal(doc);
            var points = req.Points_mm.Select(p => ResolvePoint(doc, p, req.CoordinateSystem, sharedToInternal)).ToList();

            // Reject exact duplicates in plan (Revit rejects them with an unhelpful message).
            var planKeys = new HashSet<string>();
            foreach (var p in points)
            {
                var key = $"{Math.Round(p.X * MmPerFoot, 1)}|{Math.Round(p.Y * MmPerFoot, 1)}";
                if (!planKeys.Add(key))
                    throw new ArgumentException($"Duplicate point in plan at x={Math.Round(p.X * MmPerFoot, 1)} mm, y={Math.Round(p.Y * MmPerFoot, 1)} mm.");
            }

            var level = ResolveLevel(doc, req.LevelName, required: false);
            var type = ResolveTypeByName<ToposolidType>(doc, req.ToposolidTypeName, "Toposolid type");

            Dictionary<string, object> info;
            using (var tx = new Transaction(doc, transactionName))
            {
                tx.Start();
                var failures = FailureCollector.Attach(tx);
                try
                {
                    var topo = Toposolid.Create(doc, points, type.Id, level.Id);
                    if (topo == null) throw new InvalidOperationException("Toposolid.Create returned null.");

                    if (!string.IsNullOrWhiteSpace(req.Name))
                    {
                        var comments = topo.get_Parameter(BuiltInParameter.ALL_MODEL_INSTANCE_COMMENTS);
                        if (comments != null && !comments.IsReadOnly) comments.Set(req.Name);
                    }

                    doc.Regenerate();
                    info = DescribeToposolid(doc, topo, includePoints: false);
                    info["inputPointCount"] = points.Count;
                    info["coordinateSystem"] = IsShared(req.CoordinateSystem) ? SiteCoordinateSystems.Shared : SiteCoordinateSystems.Internal;
                    if (!string.IsNullOrWhiteSpace(req.Name)) info["nameStoredIn"] = "Comments";

                    if (req.DryRun)
                    {
                        tx.RollBack();
                        info["elementId"] = null; // rolled back, id no longer valid
                    }
                    else
                    {
                        failures.CommitOrThrow(tx);
                    }
                }
                catch
                {
                    if (tx.GetStatus() == TransactionStatus.Started) tx.RollBack();
                    throw;
                }
                info["warnings"] = failures.Warnings;
            }

            info["dryRun"] = req.DryRun;
            info["committed"] = !req.DryRun;
            return info;
        }
#else
        public static Dictionary<string, object> CreateToposolid(Document doc, CreateToposolidRequest req, string transactionName = "create_toposolid")
        {
            throw new NotSupportedException("Toposolids require Revit 2024 or newer.");
        }
#endif

#if REVIT2024_OR_GREATER
        public static Dictionary<string, object> DescribeToposolid(Document doc, Toposolid topo, bool includePoints)
        {
            var level = doc.GetElement(topo.LevelId) as Level;
            var type = doc.GetElement(topo.GetTypeId());
            int vertexCount = 0;
            List<Dictionary<string, object>> vertices = null;

            try
            {
                var editor = topo.GetSlabShapeEditor();
                if (editor != null)
                {
                    var arr = editor.SlabShapeVertices;
                    vertexCount = arr.Size;
                    if (includePoints)
                    {
                        vertices = new List<Dictionary<string, object>>(vertexCount);
                        foreach (SlabShapeVertex v in arr)
                            vertices.Add(PointToMm(v.Position));
                    }
                }
            }
            catch
            {
                // Some toposolids (e.g. sub-divisions) may not expose an editor.
            }

            var info = new Dictionary<string, object>
            {
                ["elementId"] = IdValue(topo.Id),
                ["uniqueId"] = topo.UniqueId,
                ["typeName"] = type?.Name,
                ["levelName"] = level?.Name,
                ["comments"] = ParamString(topo, BuiltInParameter.ALL_MODEL_INSTANCE_COMMENTS),
                ["pointCount"] = vertexCount,
                ["isSubDivision"] = topo.HostTopoId != null && topo.HostTopoId != ElementId.InvalidElementId,
                ["boundingBox_mm"] = BoundingBoxMm(topo)
            };
            if (includePoints) info["points_mm"] = vertices ?? new List<Dictionary<string, object>>();
            return info;
        }
#endif

        public static Dictionary<string, object> GetToposolids(Document doc, bool includePoints)
        {
#if REVIT2024_OR_GREATER
            var list = new FilteredElementCollector(doc)
                .OfClass(typeof(Toposolid))
                .Cast<Toposolid>()
                .Select(t => DescribeToposolid(doc, t, includePoints))
                .ToList();
            return new Dictionary<string, object>
            {
                ["count"] = list.Count,
                ["coordinateSystem"] = SiteCoordinateSystems.Internal,
                ["toposolids"] = list
            };
#else
            throw new NotSupportedException("Toposolids require Revit 2024 or newer.");
#endif
        }

        // ------------------------------------------------------------------ MEP

        public static Dictionary<string, object> CreatePipes(Document doc, CreatePipesRequest req, string transactionName = "create_pipe")
        {
            if (req == null) throw new ArgumentNullException(nameof(req));
            RequireModifiable(doc);
            if (req.Pipes == null || req.Pipes.Count == 0) throw new ArgumentException("pipes must contain at least one pipe.");

            var sharedToInternal = SharedToInternal(doc);
            var created = new List<Dictionary<string, object>>();
            List<string> warnings;

            using (var tx = new Transaction(doc, transactionName))
            {
                tx.Start();
                var failures = FailureCollector.Attach(tx);
                try
                {
                    for (int i = 0; i < req.Pipes.Count; i++)
                    {
                        var p = req.Pipes[i];
                        try
                        {
                            if (!(p.Diameter_mm > 0)) throw new ArgumentException("diameter_mm must be > 0.");
                            var start = ResolvePoint(doc, p.Start_mm, req.CoordinateSystem, sharedToInternal);
                            var end = ResolvePoint(doc, p.End_mm, req.CoordinateSystem, sharedToInternal);
                            if (start.DistanceTo(end) < doc.Application.ShortCurveTolerance)
                                throw new ArgumentException("start_mm and end_mm are (nearly) identical.");

                            var systemType = ResolveTypeByName<PipingSystemType>(doc, p.SystemTypeName, "Piping system type");
                            var pipeType = ResolveTypeByName<PipeType>(doc, p.PipeTypeName, "Pipe type");
                            var level = ResolveLevel(doc, p.LevelName, required: true);

                            var pipe = Pipe.Create(doc, systemType.Id, pipeType.Id, level.Id, start, end);
                            var dia = pipe.get_Parameter(BuiltInParameter.RBS_PIPE_DIAMETER_PARAM);
                            if (dia == null || dia.IsReadOnly) throw new InvalidOperationException("Pipe diameter parameter is not settable.");
                            dia.Set(ToFeet(p.Diameter_mm));

                            doc.Regenerate();
                            var info = DescribeMepCurve(doc, pipe);
                            info["index"] = i;
                            info["requestedDiameter_mm"] = p.Diameter_mm;
                            created.Add(info);
                        }
                        catch (Exception ex)
                        {
                            throw new InvalidOperationException($"pipes[{i}]: {ex.Message}", ex);
                        }
                    }

                    if (req.DryRun) tx.RollBack();
                    else failures.CommitOrThrow(tx);
                }
                catch
                {
                    if (tx.GetStatus() == TransactionStatus.Started) tx.RollBack();
                    throw;
                }
                warnings = failures.Warnings;
            }

            if (req.DryRun) foreach (var c in created) c["elementId"] = null;
            return new Dictionary<string, object>
            {
                ["dryRun"] = req.DryRun,
                ["committed"] = !req.DryRun,
                ["warnings"] = warnings,
                ["coordinateSystem"] = IsShared(req.CoordinateSystem) ? SiteCoordinateSystems.Shared : SiteCoordinateSystems.Internal,
                ["count"] = created.Count,
                ["pipes"] = created
            };
        }

        public static Dictionary<string, object> CreateDucts(Document doc, CreateDuctsRequest req, string transactionName = "create_duct")
        {
            if (req == null) throw new ArgumentNullException(nameof(req));
            RequireModifiable(doc);
            if (req.Ducts == null || req.Ducts.Count == 0) throw new ArgumentException("ducts must contain at least one duct.");

            var sharedToInternal = SharedToInternal(doc);
            var created = new List<Dictionary<string, object>>();
            List<string> warnings;

            using (var tx = new Transaction(doc, transactionName))
            {
                tx.Start();
                var failures = FailureCollector.Attach(tx);
                try
                {
                    for (int i = 0; i < req.Ducts.Count; i++)
                    {
                        var d = req.Ducts[i];
                        try
                        {
                            bool round = d.Diameter_mm.HasValue;
                            if (round && !(d.Diameter_mm.Value > 0)) throw new ArgumentException("diameter_mm must be > 0.");
                            if (!round && (!d.Width_mm.HasValue || !d.Height_mm.HasValue))
                                throw new ArgumentException("Give diameter_mm (round duct) or both width_mm and height_mm (rectangular/oval duct).");
                            if (!round && (!(d.Width_mm.Value > 0) || !(d.Height_mm.Value > 0)))
                                throw new ArgumentException("width_mm and height_mm must be > 0.");

                            var start = ResolvePoint(doc, d.Start_mm, req.CoordinateSystem, sharedToInternal);
                            var end = ResolvePoint(doc, d.End_mm, req.CoordinateSystem, sharedToInternal);
                            if (start.DistanceTo(end) < doc.Application.ShortCurveTolerance)
                                throw new ArgumentException("start_mm and end_mm are (nearly) identical.");

                            var systemType = ResolveTypeByName<MechanicalSystemType>(doc, d.SystemTypeName, "Duct system type");
                            var wantShape = round ? ConnectorProfileType.Round : ConnectorProfileType.Rectangular;
                            var ductType = ResolveTypeByName<DuctType>(doc, d.DuctTypeName, "Duct type", t => t.Shape == wantShape);
                            if (ductType.Shape == ConnectorProfileType.Round && !round)
                                throw new ArgumentException($"Duct type '{ductType.Name}' is round; give diameter_mm instead of width/height.");
                            if (ductType.Shape != ConnectorProfileType.Round && round)
                                throw new ArgumentException($"Duct type '{ductType.Name}' is {ductType.Shape}; give width_mm and height_mm instead of diameter_mm.");
                            var level = ResolveLevel(doc, d.LevelName, required: true);

                            var duct = Duct.Create(doc, systemType.Id, ductType.Id, level.Id, start, end);
                            if (round)
                            {
                                SetDouble(duct, BuiltInParameter.RBS_CURVE_DIAMETER_PARAM, ToFeet(d.Diameter_mm.Value), "diameter");
                            }
                            else
                            {
                                SetDouble(duct, BuiltInParameter.RBS_CURVE_WIDTH_PARAM, ToFeet(d.Width_mm.Value), "width");
                                SetDouble(duct, BuiltInParameter.RBS_CURVE_HEIGHT_PARAM, ToFeet(d.Height_mm.Value), "height");
                            }

                            doc.Regenerate();
                            var info = DescribeMepCurve(doc, duct);
                            info["index"] = i;
                            created.Add(info);
                        }
                        catch (Exception ex)
                        {
                            throw new InvalidOperationException($"ducts[{i}]: {ex.Message}", ex);
                        }
                    }

                    if (req.DryRun) tx.RollBack();
                    else failures.CommitOrThrow(tx);
                }
                catch
                {
                    if (tx.GetStatus() == TransactionStatus.Started) tx.RollBack();
                    throw;
                }
                warnings = failures.Warnings;
            }

            if (req.DryRun) foreach (var c in created) c["elementId"] = null;
            return new Dictionary<string, object>
            {
                ["dryRun"] = req.DryRun,
                ["committed"] = !req.DryRun,
                ["warnings"] = warnings,
                ["coordinateSystem"] = IsShared(req.CoordinateSystem) ? SiteCoordinateSystems.Shared : SiteCoordinateSystems.Internal,
                ["count"] = created.Count,
                ["ducts"] = created
            };
        }

        private static void SetDouble(Element e, BuiltInParameter bip, double valueFeet, string label)
        {
            var p = e.get_Parameter(bip);
            if (p == null || p.IsReadOnly) throw new InvalidOperationException($"Duct {label} parameter is not settable.");
            p.Set(valueFeet);
        }

        public static Dictionary<string, object> DescribeMepCurve(Document doc, MEPCurve curve)
        {
            var line = (curve.Location as LocationCurve)?.Curve;
            var type = doc.GetElement(curve.GetTypeId());
            var info = new Dictionary<string, object>
            {
                ["elementId"] = IdValue(curve.Id),
                ["category"] = curve.Category?.Name,
                ["typeName"] = type?.Name,
                ["systemName"] = ParamString(curve, BuiltInParameter.RBS_SYSTEM_NAME_PARAM),
                ["systemTypeName"] = ParamString(curve, BuiltInParameter.RBS_PIPING_SYSTEM_TYPE_PARAM) ?? ParamString(curve, BuiltInParameter.RBS_DUCT_SYSTEM_TYPE_PARAM),
                ["systemClassification"] = ParamString(curve, BuiltInParameter.RBS_SYSTEM_CLASSIFICATION_PARAM),
                ["levelName"] = curve.ReferenceLevel?.Name,
                ["size"] = ParamString(curve, BuiltInParameter.RBS_CALCULATED_SIZE),
                ["length_mm"] = ParamDoubleMm(curve, BuiltInParameter.CURVE_ELEM_LENGTH)
            };
            if (curve is Pipe)
            {
                info["diameter_mm"] = ParamDoubleMm(curve, BuiltInParameter.RBS_PIPE_DIAMETER_PARAM);
            }
            else
            {
                var dia = ParamDoubleMm(curve, BuiltInParameter.RBS_CURVE_DIAMETER_PARAM);
                if (dia.HasValue && dia.Value > 0) info["diameter_mm"] = dia;
                var w = ParamDoubleMm(curve, BuiltInParameter.RBS_CURVE_WIDTH_PARAM);
                var h = ParamDoubleMm(curve, BuiltInParameter.RBS_CURVE_HEIGHT_PARAM);
                if (w.HasValue && w.Value > 0) info["width_mm"] = w;
                if (h.HasValue && h.Value > 0) info["height_mm"] = h;
            }
            if (line != null)
            {
                info["start_mm"] = PointToMm(line.GetEndPoint(0));
                info["end_mm"] = PointToMm(line.GetEndPoint(1));
            }
            return info;
        }

        public static Dictionary<string, object> GetMepSystems(Document doc)
        {
            var systems = new List<Dictionary<string, object>>();
            var collected = new FilteredElementCollector(doc).OfClass(typeof(PipingSystem)).Cast<MEPSystem>()
                .Concat(new FilteredElementCollector(doc).OfClass(typeof(MechanicalSystem)).Cast<MEPSystem>());

            foreach (var sys in collected)
            {
                ElementSet network = null;
                string domain;
                string systemEnum;
                if (sys is PipingSystem ps)
                {
                    domain = "piping";
                    systemEnum = ps.SystemType.ToString();
                    try { network = ps.PipingNetwork; } catch { }
                }
                else
                {
                    var ms = (MechanicalSystem)sys;
                    domain = "mechanical";
                    systemEnum = ms.SystemType.ToString();
                    try { network = ms.DuctNetwork; } catch { }
                }

                int curveCount = 0, fittingCount = 0, otherCount = 0, total = 0;
                double lengthFeet = 0;
                if (network != null)
                {
                    foreach (Element e in network)
                    {
                        total++;
                        if (e is MEPCurve mc)
                        {
                            curveCount++;
                            var len = mc.get_Parameter(BuiltInParameter.CURVE_ELEM_LENGTH);
                            if (len != null && len.HasValue) lengthFeet += len.AsDouble();
                        }
                        else if (e is FamilyInstance fi && fi.MEPModel is MechanicalFitting)
                        {
                            fittingCount++;
                        }
                        else
                        {
                            otherCount++;
                        }
                    }
                }

                var systemType = doc.GetElement(sys.GetTypeId());
                systems.Add(new Dictionary<string, object>
                {
                    ["elementId"] = IdValue(sys.Id),
                    ["name"] = sys.Name,
                    ["domain"] = domain,
                    ["classification"] = ParamString(sys, BuiltInParameter.RBS_SYSTEM_CLASSIFICATION_PARAM) ?? systemEnum,
                    ["systemClassificationEnum"] = systemEnum,
                    ["systemTypeName"] = systemType?.Name,
                    ["elementCount"] = total,
                    ["curveCount"] = curveCount,
                    ["fittingCount"] = fittingCount,
                    ["otherCount"] = otherCount,
                    ["totalLength_mm"] = Math.Round(lengthFeet * MmPerFoot, 1),
                    ["isEmpty"] = SafeBool(() => sys.IsEmpty)
                });
            }

            return new Dictionary<string, object>
            {
                ["count"] = systems.Count,
                ["systems"] = systems.OrderBy(s => (string)s["domain"]).ThenBy(s => (string)s["name"]).ToList()
            };
        }

        private static bool? SafeBool(Func<bool> f)
        {
            try { return f(); } catch { return null; }
        }

        public static Dictionary<string, object> GetMepElements(Document doc, GetMepElementsRequest req)
        {
            req ??= new GetMepElementsRequest();
            var category = string.IsNullOrWhiteSpace(req.Category) ? "all" : req.Category.Trim().ToLowerInvariant();
            var cats = new List<BuiltInCategory>();
            switch (category)
            {
                case "pipes": cats.Add(BuiltInCategory.OST_PipeCurves); break;
                case "ducts": cats.Add(BuiltInCategory.OST_DuctCurves); break;
                case "fittings":
                    cats.AddRange(new[] { BuiltInCategory.OST_PipeFitting, BuiltInCategory.OST_DuctFitting, BuiltInCategory.OST_PipeAccessory, BuiltInCategory.OST_DuctAccessory });
                    break;
                case "all":
                    cats.AddRange(new[] { BuiltInCategory.OST_PipeCurves, BuiltInCategory.OST_DuctCurves, BuiltInCategory.OST_PipeFitting, BuiltInCategory.OST_DuctFitting, BuiltInCategory.OST_PipeAccessory, BuiltInCategory.OST_DuctAccessory });
                    break;
                default:
                    throw new ArgumentException("category must be one of: all, pipes, ducts, fittings.");
            }
            int limit = req.Limit <= 0 ? 500 : Math.Min(req.Limit, 10000);

            var filter = new ElementMulticategoryFilter(cats);
            var elements = new FilteredElementCollector(doc).WherePasses(filter).WhereElementIsNotElementType().ToElements();

            var items = new List<Dictionary<string, object>>();
            int matched = 0;
            foreach (var e in elements)
            {
                var systemName = ParamString(e, BuiltInParameter.RBS_SYSTEM_NAME_PARAM);
                if (!string.IsNullOrWhiteSpace(req.SystemName) && !NameEquals(systemName, req.SystemName)) continue;
                matched++;
                if (items.Count >= limit) continue;

                if (e is MEPCurve mc)
                {
                    items.Add(DescribeMepCurve(doc, mc));
                    continue;
                }

                var type = doc.GetElement(e.GetTypeId()) as ElementType;
                var loc = e.Location as LocationPoint;
                items.Add(new Dictionary<string, object>
                {
                    ["elementId"] = IdValue(e.Id),
                    ["category"] = e.Category?.Name,
                    ["familyName"] = type?.FamilyName,
                    ["typeName"] = type?.Name,
                    ["systemName"] = systemName,
                    ["systemClassification"] = ParamString(e, BuiltInParameter.RBS_SYSTEM_CLASSIFICATION_PARAM),
                    ["size"] = ParamString(e, BuiltInParameter.RBS_CALCULATED_SIZE),
                    ["levelName"] = (doc.GetElement(e.LevelId) as Level)?.Name,
                    ["location_mm"] = loc != null ? PointToMm(loc.Point) : null
                });
            }

            return new Dictionary<string, object>
            {
                ["category"] = category,
                ["systemNameFilter"] = req.SystemName,
                ["totalMatched"] = matched,
                ["returned"] = items.Count,
                ["truncated"] = matched > items.Count,
                ["coordinateSystem"] = SiteCoordinateSystems.Internal,
                ["elements"] = items
            };
        }

        // ------------------------------------------------------------------ IFC

        public static IFCVersion MapIfcVersion(string version)
        {
            var v = (version ?? "IFC4").Trim().ToUpperInvariant().Replace(" ", "");
            switch (v)
            {
                case "IFC2X3":
                case "IFC2X3CV2":
                    return IFCVersion.IFC2x3CV2;
                case "IFC4":
                case "IFC4RV":
                    return IFCVersion.IFC4RV;
#if REVIT2024_OR_GREATER
                case "IFC4X3":
                    return IFCVersion.IFC4x3;
#endif
                default:
                    throw new ArgumentException($"ifcVersion must be one of IFC2x3, IFC4, IFC4x3 (got '{version}').");
            }
        }

        /// <summary>
        /// Value for the IFC exporter's "SitePlacement" option (Revit.IFC.Export SiteTransformBasis):
        /// Shared = 0, Site = 1, Project = 2, Internal = 3.
        /// </summary>
        public static string SitePlacementOption(bool useSharedCoordinates) => useSharedCoordinates ? "0" : "3";

        public static Dictionary<string, object> ExportIfc(Document doc, ExportIfcRequest req, string transactionName = "export_ifc")
        {
            if (req == null) throw new ArgumentNullException(nameof(req));
            if (doc.IsFamilyDocument) throw new InvalidOperationException("IFC export requires a project document.");
            if (string.IsNullOrWhiteSpace(req.OutputFolder)) throw new ArgumentException("outputFolder is required.");
            if (string.IsNullOrWhiteSpace(req.FileName)) throw new ArgumentException("fileName is required.");

            var folder = Path.GetFullPath(req.OutputFolder);
            if (!Directory.Exists(folder))
                throw new DirectoryNotFoundException($"outputFolder does not exist: {folder}");

            var fileName = req.FileName.Trim();
            if (fileName.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0 || fileName != Path.GetFileName(fileName))
                throw new ArgumentException($"fileName must be a plain file name without path separators or invalid characters: '{req.FileName}'");
            if (!fileName.EndsWith(".ifc", StringComparison.OrdinalIgnoreCase)) fileName += ".ifc";
            var fullPath = Path.Combine(folder, fileName);

            var version = MapIfcVersion(req.IfcVersion);

            View view = null;
            if (!string.IsNullOrWhiteSpace(req.ViewName))
            {
                var views = new FilteredElementCollector(doc).OfClass(typeof(View)).Cast<View>()
                    .Where(v => !v.IsTemplate && NameEquals(v.Name, req.ViewName)).ToList();
                if (views.Count == 0) throw new ArgumentException($"View '{req.ViewName}' not found.");
                view = views.FirstOrDefault(v => v is View3D) ?? views.First();
            }

            var plan = new Dictionary<string, object>
            {
                ["path"] = fullPath,
                ["ifcVersion"] = version.ToString(),
                ["viewName"] = view?.Name,
                ["viewId"] = view != null ? IdValue(view.Id) : (long?)null,
                ["exportBaseQuantities"] = req.ExportBaseQuantities,
                ["useSharedCoordinates"] = req.UseSharedCoordinates,
                ["sitePlacementOption"] = SitePlacementOption(req.UseSharedCoordinates),
                ["fileExistedBefore"] = File.Exists(fullPath),
                ["dryRun"] = req.DryRun
            };

            if (req.DryRun)
            {
                plan["exported"] = false;
                return plan;
            }

            var options = new IFCExportOptions
            {
                FileVersion = version,
                ExportBaseQuantities = req.ExportBaseQuantities
            };
            options.AddOption("ExportBaseQuantities", req.ExportBaseQuantities ? "true" : "false");
            options.AddOption("SitePlacement", SitePlacementOption(req.UseSharedCoordinates));
            if (view != null)
            {
                options.FilterViewId = view.Id;
                options.AddOption("VisibleElementsOfCurrentView", "true");
                options.AddOption("ActiveViewId", IdValue(view.Id).ToString());
            }

            bool ok;
            // The IFC exporter needs an open transaction; roll it back afterwards so the export
            // does not leave the model modified (this is what Revit's own IFC export UI does).
            using (var tx = new Transaction(doc, transactionName))
            {
                tx.Start();
                try
                {
                    ok = doc.Export(folder, fileName, options);
                }
                finally
                {
                    if (tx.GetStatus() == TransactionStatus.Started) tx.RollBack();
                }
            }

            var fi = new FileInfo(fullPath);
            if (!ok || !fi.Exists)
                throw new InvalidOperationException($"IFC export did not produce a file (Export returned {ok}). Path: {fullPath}");

            plan["exported"] = true;
            plan["sizeBytes"] = fi.Length;
            plan["lastWriteTimeUtc"] = fi.LastWriteTimeUtc.ToString("o");
            return plan;
        }
    }

    /// <summary>
    /// Keeps Revit's failure dialog out of MCP transactions. Without a preprocessor, a warning
    /// raised at commit (e.g. "Highlighted toposolid and floor overlap") opens a modal dialog;
    /// the external event cannot finish until someone clicks it, so every later MCP command
    /// times out behind it. Warnings are recorded and dismissed so the caller sees them in the
    /// result; errors are recorded and the transaction is rolled back, and CommitOrThrow turns
    /// that into an exception carrying the error text.
    /// </summary>
    public sealed class FailureCollector : IFailuresPreprocessor
    {
        public List<string> Warnings { get; } = new List<string>();
        public List<string> Errors { get; } = new List<string>();

        public static FailureCollector Attach(Transaction tx)
        {
            var collector = new FailureCollector();
            var options = tx.GetFailureHandlingOptions()
                .SetFailuresPreprocessor(collector)
                .SetClearAfterRollback(true)
                .SetForcedModalHandling(false);
            tx.SetFailureHandlingOptions(options);
            return collector;
        }

        public FailureProcessingResult PreprocessFailures(FailuresAccessor failuresAccessor)
        {
            bool hasError = false;
            foreach (var failure in failuresAccessor.GetFailureMessages())
            {
                var text = failure.GetDescriptionText();
                if (failure.GetSeverity() == FailureSeverity.Warning)
                {
                    if (!Warnings.Contains(text)) Warnings.Add(text);
                    failuresAccessor.DeleteWarning(failure);
                }
                else
                {
                    if (!Errors.Contains(text)) Errors.Add(text);
                    hasError = true;
                }
            }
            return hasError ? FailureProcessingResult.ProceedWithRollBack : FailureProcessingResult.Continue;
        }

        public void CommitOrThrow(Transaction tx)
        {
            var status = tx.Commit();
            if (status != TransactionStatus.Committed)
            {
                var why = Errors.Count > 0 ? string.Join("; ", Errors) : $"transaction status {status}";
                throw new InvalidOperationException($"Revit rejected the change and rolled it back: {why}");
            }
        }
    }
}
