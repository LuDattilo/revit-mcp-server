import { z } from "zod";

/**
 * Shared zod fragments for the site / shared-coordinate / MEP / IFC tools
 * (get_project_location, set_shared_coordinates, create_toposolid, get_toposolids,
 * create_pipe, create_duct, get_mep_systems, get_mep_elements, export_ifc).
 * All lengths are millimeters, all angles degrees.
 */
export const pointMmSchema = z.object({
  x: z.number().describe("X in mm"),
  y: z.number().describe("Y in mm"),
  z: z.number().describe("Z in mm"),
});

export const coordinateSystemSchema = z
  .enum(["internal", "shared"])
  .describe(
    "Coordinate system of the input points. 'internal' (default) = Revit internal coordinates; 'shared' = shared/survey coordinates (E/W, N/S, elevation), converted through the active ProjectLocation."
  );

export const dryRunSchema = z
  .boolean()
  .optional()
  .describe(
    "If true, perform the change inside the transaction, report the result, then roll it back (nothing is saved). Default false."
  );

/** Remove undefined values so the C# side sees only what the caller supplied. */
export function definedOnly<T extends Record<string, unknown>>(args: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(args).filter(([, v]) => v !== undefined)
  ) as Partial<T>;
}
