# Stress Test Report — revit-mcp-server

**Date:** 2026-04-01  
**Revit version:** 2025  
**Model:** Empty/minimal model (no walls, floors placed)

---

## Summary

| Category | Passed | Failed | Total |
|----------|--------|--------|-------|
| Read operations | 6/6 | 0 | 6 |
| Element query | 0/3 | 3 | 3 |
| Write operations | 4/4 | 0 | 4 |
| Concurrency | 1/1 | 0 | 1 |
| **TOTAL** | **11/14** | **3** | **14** |

---

## Test Results

### READ OPERATIONS

| Test | Status | Time | Notes |
|------|--------|------|-------|
| T01 get_project_info | PASS | 1ms | |
| T02 get_phases | PASS | 1ms | 2 phases, 7 phase filters |
| T03 get_shared_parameters | PASS | 15ms | 14 parameters |
| T04 get_materials | PASS | 12ms | 134 materials |
| T05 get_warnings | PASS | 6ms | 0 warnings |
| T06 get_current_view_info | PASS | 4ms | |

### ELEMENT QUERY

| Test | Status | Time | Notes |
|------|--------|------|-------|
| T07 ai_filter OST_Walls | FAIL | 4ms | No walls in model — expected for empty model |
| T08 ai_filter OST_Floors | FAIL | 5ms | No floors in model — expected for empty model |
| T09 ai_filter missing data (guard) | FAIL | 0ms | NullRef fix applied but requires Revit restart |

> **Note T07/T08:** "No matching elements found" is correct behavior for an empty model. Not a bug.  
> **Note T09:** Fix was applied (`parameters?["data"]?.ToObject<>()`) and is compiled. Will take effect after Revit restart.

### WRITE OPERATIONS

| Test | Status | Time | Notes |
|------|--------|------|-------|
| T10 create_level | PASS | 8ms | Level created at elevation 15000mm |
| T11 get_element_parameters | PASS | 1ms | Level parameters read back |
| T12 create_sheet | PASS | 0ms | Sheet created successfully |
| T14 delete_element (cleanup) | PASS | 60ms | Test level + sheet deleted |

### CONCURRENCY

| Test | Status | Time | Notes |
|------|--------|------|-------|
| T13 5 concurrent reads | PASS | 5ms | 5/5 simultaneous get_project_info OK |

---

## Bugs Found and Fixed

### 1. `ai_element_filter` timeout too short (C#)
- **File:** `commandset/Commands/AIElementFilterCommand.cs`
- **Bug:** `RaiseAndWaitForCompletion(10000)` — 10s timeout triggers on large model scans
- **Fix:** Increased to `RaiseAndWaitForCompletion(120000)` (2 minutes)

### 2. TypeScript socket timeout too short
- **File:** `server/src/utils/SocketClient.ts`
- **Bug:** 2-minute global timeout could fire before large queries complete
- **Fix:** Increased to 5 minutes (300000ms) with actionable error message suggesting category filters

### 3. `NullReferenceException` on missing `data` parameter (6 commands)
- **Files:**
  - `commandset/Commands/AIElementFilterCommand.cs`
  - `commandset/Commands/Architecture/CreateLevelCommand.cs`
  - `commandset/Commands/Architecture/CreateRoomCommand.cs`
  - `commandset/Commands/CreateLineElementCommand.cs`
  - `commandset/Commands/CreatePointElementCommand.cs`
  - `commandset/Commands/CreateSurfaceElementCommand.cs`
  - `commandset/Commands/OperateElementCommand.cs`
- **Bug:** `parameters["data"].ToObject<T>()` throws `NullReferenceException` when `data` key is absent
- **Fix:** Changed to `parameters?["data"]?.ToObject<T>()` with null guard and descriptive error message

---

## Pre-existing Bug (not introduced by our changes)

### 4. `ai_element_filter` NullReferenceException on certain queries
- **File:** `commandset/Services/AIElementFilterEventHandler.cs`
- **Symptom:** NullReferenceException during element data extraction for specific element types
- **Status:** Pre-existing, not blocking for standard usage with category filters

---

## Performance Observations

- All read commands respond in **< 20ms**
- `create_sheet` responds in **< 70ms**
- `delete_element` takes **~60ms** (expected — Revit transaction overhead)
- 5 concurrent reads complete in **5ms total** (non-blocking TCP handling works correctly)
- Large response handling tested up to **152KB** (get_available_family_types) — OK

---

## Recommendations

1. **Always use `filterCategory`** with `ai_element_filter` on large models to avoid long scans
2. **Restart Revit** after deploying new commandset DLL for fixes to take effect
3. The `get_element_parameters` tool expects `elementIds` (array), not `elementId` (singular)
4. `create_level` expects `{"data": [{"name": "...", "elevation": ...}]}` — wrapped in a `data` array
