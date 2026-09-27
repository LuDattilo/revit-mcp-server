/**
 * Contract fixtures for every MCP tool registered by src/tools/register.ts.
 *
 * tests/tool_contracts.test.ts discovers tools from the live registration, so a new
 * tool is picked up automatically. It then REQUIRES an entry here - a missing entry
 * fails with the tool's name. For most tools the entry is just `{}`:
 *
 *   - the input is generated from the tool's zod schema (all fields, then required-only),
 *   - the Revit command is expected to equal the tool name,
 *   - every top-level input field is expected to reach the command params unchanged.
 *
 * Only add fields when a tool deviates from that. Keep the list alphabetical.
 */
export interface ToolFixture {
  /** Revit command the handler must send. Defaults to the tool name. */
  command?: string;
  /** True for tools served entirely by the Node server (no Revit round trip). */
  local?: boolean;
  /**
   * Hand-written valid input, used instead of the schema-generated "full" input
   * (e.g. when a refinement rejects generated data).
   */
  input?: Record<string, unknown>;
  /** Input fields consumed on the Node side and deliberately not forwarded to Revit. */
  notForwarded?: string[];
  /** Input fields forwarded under a different params key: { inputKey: paramsKey }. */
  renamed?: Record<string, string>;
  /** Fixed params the handler must always add (checked with toMatchObject). */
  fixedParams?: Record<string, unknown>;
  /** Upper bound for the command timeout, when a tool legitimately exceeds the 10-minute default. */
  maxTimeoutMs?: number;
  /** Free-form note shown nowhere; explains non-obvious entries to reviewers. */
  note?: string;
}

// `compact` only controls Node-side response compaction; tools may forward it or not.
export const CLIENT_SIDE_FIELDS = ["compact"];

export const TOOL_FIXTURES: Record<string, ToolFixture> = {
  add_prefix_suffix: {},
  add_shared_parameter: {},
  ai_element_filter: {},
  align_viewports: {},
  analyze_model_statistics: {},
  apply_view_template: {},
  audit_families: {},
  batch_create_sheets: {},
  batch_export: {},
  batch_modify_view_range: {},
  batch_rename: {},
  bulk_modify_parameter_values: {},
  cad_link_cleanup: {},
  calculate_rai: {},
  change_element_type: {},
  check_family_health: {},
  check_model_health: {},
  clash_detection: {},
  clear_parameter_values: {},
  color_elements: { command: "color_splash" },
  copy_elements: {},
  create_array: {},
  create_callout_from_rooms: {},
  create_color_legend: {},
  create_dimensions: {},
  create_duct: {},
  create_door_schedule_by_room: {
    command: "create_schedule",
    fixedParams: { preset: "door_by_room", categoryName: "OST_Doors" },
  },
  create_elevations_from_rooms: {},
  create_filled_region: {},
  create_floor: {},
  create_grid: {},
  create_level: {},
  create_line_based_element: {},
  create_material: {},
  create_pipe: {},
  create_material_takeoff_schedule: {
    command: "create_schedule",
    fixedParams: { preset: "material_quantities", type: "material_takeoff" },
  },
  create_placeholder_sheets: {},
  create_point_based_element: {},
  create_revision: {},
  create_room: {},
  create_room_finish_schedule: {
    command: "create_schedule",
    fixedParams: { preset: "room_finish", categoryName: "OST_Rooms" },
  },
  create_schedule: {
    renamed: { scheduleType: "type" },
    note: "C# ScheduleCreationInfo reads `type`, the MCP schema calls it scheduleType.",
  },
  create_sheet: {},
  create_sheet_list_schedule: {
    command: "create_schedule",
    fixedParams: { preset: "sheet_index", type: "sheet_list" },
  },
  create_structural_framing_system: {},
  create_surface_based_element: {},
  create_text_note: {},
  create_toposolid: {},
  create_view: {},
  create_view_filter: {},
  create_view_list_schedule: {
    command: "create_schedule",
    fixedParams: { preset: "view_index", type: "view_list" },
  },
  create_view_template: {},
  create_views_from_rooms: {},
  create_window_schedule_by_room: {
    command: "create_schedule",
    fixedParams: { preset: "window_by_room", categoryName: "OST_Windows" },
  },
  create_workset: {},
  delete_element: {},
  delete_schedule: {},
  delete_selection: {},
  delete_workset: {},
  duplicate_schedule: {},
  duplicate_sheet_with_content: {},
  duplicate_sheet_with_views: {},
  duplicate_view: {},
  export_elements_data: {},
  export_families: {},
  export_ifc: {
    maxTimeoutMs: 31 * 60 * 1000,
    note: "IFC export of a large model can run long; the C# command allows 30 minutes.",
  },
  export_room_data: {},
  export_schedule: {},
  export_shared_parameter_file: {},
  export_to_excel: {},
  filter_by_parameter_value: {},
  find_undimensioned_elements: {},
  find_untagged_elements: {},
  get_available_family_types: {},
  get_compound_structure: {},
  get_current_view_elements: {},
  get_current_view_info: {},
  get_element_parameters: {},
  get_elements_by_workset: {},
  get_elements_in_spatial_volume: {},
  get_linked_elements: {},
  get_material_properties: {},
  get_material_quantities: {},
  get_materials: {},
  get_mep_elements: {},
  get_mep_systems: {},
  get_phases: {},
  get_project_info: {},
  get_project_location: {},
  get_room_openings: {},
  get_schedule_data: {},
  get_selected_elements: {},
  get_shared_parameters: {},
  get_toposolids: {},
  get_warnings: {},
  get_worksets: {},
  import_from_excel: {},
  import_table: {},
  lines_per_view_count: {},
  list_family_sizes: {},
  list_schedulable_fields: {},
  load_family: {},
  load_selection: {},
  manage_links: {},
  manage_project_parameters: {},
  manage_unplaced_views: {},
  manage_view_templates: {},
  match_element_properties: {},
  measure_between_elements: {},
  modify_element: {},
  modify_schedule: {},
  navigate_view: {},
  operate_element: {},
  override_graphics: {},
  place_viewport: {},
  purge_unused: {},
  query_stored_data: { local: true, note: "Reads the local sql.js store." },
  rename_families: {},
  rename_views: {},
  rename_workset: {},
  renumber_elements: {},
  save_selection: {},
  say_hello: {},
  section_box_from_selection: {},
  send_code_to_revit: {},
  set_active_workset: {},
  set_compound_structure: {},
  set_element_parameters: {},
  set_element_phase: {},
  set_element_workset: {},
  set_material_appearance: {},
  set_material_assets: {},
  set_material_properties: {},
  set_shared_coordinates: {},
  set_view_crop: {},
  store_project_data: { local: true, note: "Writes the local sql.js store." },
  store_room_data: { local: true, note: "Writes the local sql.js store." },
  sync_csv_parameters: {},
  tag_all_rooms: { command: "tag_rooms" },
  tag_all_walls: { command: "tag_walls" },
  transfer_parameters: {},
  wipe_empty_tags: {},
  workflow_clash_review: {},
  workflow_data_roundtrip: {},
  workflow_model_audit: {},
  workflow_room_documentation: {},
  workflow_sheet_set: {},
};
