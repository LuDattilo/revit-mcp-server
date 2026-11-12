# Worked example: a whole bridge from one `send_code_to_revit` call

This example built a three-span steel plate-girder bridge (VDOT structure B-676, about 716 ft long) in
Revit 2027 in a single `send_code_to_revit` call: 38 DirectShape elements, including the crowned deck
following the roadway profile, sidewalk, parapets, five girders, skewed pier caps, columns, drilled shafts,
abutments with HP piles, MSE walls and wingwalls, and approach slabs. It shows a pattern that works when no
family or tool fits: generate the C# from data, build solids with `GeometryCreationUtilities`, and tag
every element so a rerun replaces it.

## Files

| File | What it is |
|---|---|
| `export_bridgedata_civil3d.cs` | Civil 3D .NET snippet that samples the finished-grade profile every 10 ft across the bridge and ground elevations at the substructure lines. It is a method body: `Tr` is an open transaction and `Civ` the `CivilDocument`; run it with whatever you use to execute code in Civil 3D. |
| `bridgedata.json` | Its return value, as `{"result": {"value": ...}}`, used as the example input. |
| `make_bridge.py` | Generator: reads `bridgedata.json`, inserts the profile into the C# template and writes `build_bridge.cs`. Dimensions (spans, girder lines, skew, pier geometry) come from the bridge plans and are constants at the top of the template. |
| `build_bridge.cs` | The generated script, ready to paste into `send_code_to_revit`. |

## How it works

- **Local frame.** x runs along the roadway centerline from the beginning of the bridge, y is the offset
  (left positive), z is true elevation. Shared coordinates are set afterwards (`set_shared_coordinates`) so
  Revit's shared coordinates match the Civil 3D state-plane coordinates.
- **Geometry.** `Box` (plan polygon extruded between two elevations), `Cyl` (two arcs extruded), and
  `Loft` (a prism between two cross sections at x0 and x1, used in short steps so the deck and slabs follow
  the vertical curve).
- **Materials** are created on first use by name, so reruns reuse them.
- **Idempotent reruns.** Every element is a `DirectShape` with `ApplicationId = "BerkmarB676"` and a
  unique `ApplicationDataId` (its mark). The script deletes the existing ones with that ApplicationId first,
  so running it again replaces the bridge instead of duplicating it.
- **Metadata.** Each element gets a Mark and a "4D: nn ..." note in Comments, which the Navisworks
  TimeLiner rules later used to build the construction sequence.

## Running it

```text
python make_bridge.py            # regenerates build_bridge.cs from bridgedata.json
```

Then send the contents of `build_bridge.cs` with `send_code_to_revit` on a working copy of the model.
It returns a log string with one line per element.

## Lessons

- Keep a long geometry script to one transaction and return a log, rather than many small tool calls.
- Don't call `Document.Export` for IFC from inside `send_code_to_revit`; it crashed Revit 2027. Use `export_ifc`.
- Check the result against independent numbers from the plans (here, the computed pier-cap top elevation
  against the plan elevation), since assumed dimensions such as girder depth drive everything above them.
