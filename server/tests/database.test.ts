import { beforeAll, describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { createRequire } from "module";
import initSqlJs from "sql.js";
import { getDatabase, dbAll, dbGet, dbRun } from "../src/database/db.js";
import {
  storeProject,
  storeRoomsBatch,
  getAllProjects,
  getProjectById,
  getProjectByName,
  getRoomsByProjectId,
  getAllRoomsWithProject,
  getStats,
} from "../src/database/service.js";

// HOME / USERPROFILE point at a per-file temp dir (tests/setup.ts), so this is a
// fresh, disposable store - never the user's real ~/.mcp-revit/revit-data.db.
const dbPath = join(process.env.USERPROFILE!, ".mcp-revit", "revit-data.db");

beforeAll(async () => {
  await getDatabase();
});

describe("database/db", () => {
  it("getDatabase is idempotent and creates the schema", async () => {
    const a = await getDatabase();
    const b = await getDatabase();
    expect(a).toBe(b);
    const tables = dbAll("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").map((r) => r.name);
    expect(tables).toEqual(expect.arrayContaining(["projects", "rooms"]));
  });

  it("dbGet returns undefined for no row; dbAll returns []", () => {
    expect(dbGet("SELECT * FROM projects WHERE id = ?", [-1])).toBeUndefined();
    expect(dbAll("SELECT * FROM projects WHERE id = ?", [-1])).toEqual([]);
  });

  it("flushes writes to the database file (deferred save)", async () => {
    dbRun("INSERT INTO projects (project_name, timestamp, last_updated) VALUES (?, ?, ?)", ["flush-check", 1, 1]);
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    expect(existsSync(dbPath)).toBe(true);

    const require = createRequire(import.meta.url);
    const SQL = await initSqlJs({ locateFile: (f: string) => require.resolve(`sql.js/dist/${f}`) });
    const onDisk = new SQL.Database(readFileSync(dbPath));
    const rows = onDisk.exec("SELECT project_name FROM projects WHERE project_name = 'flush-check'");
    expect(rows[0]?.values).toEqual([["flush-check"]]);
    onDisk.close();
  });
});

describe("database/service", () => {
  it("inserts a project and reads it back by id and name with parsed metadata", () => {
    const id = storeProject({
      project_name: "Tower A",
      project_number: "P-001",
      client_name: "ACME",
      metadata: { phase: "DD", floors: 12 },
    });
    expect(id).toBeGreaterThan(0);

    const byId = getProjectById(id);
    const byName = getProjectByName("Tower A");
    expect(byId).toEqual(byName);
    expect(byId).toMatchObject({ id, project_name: "Tower A", project_number: "P-001", client_name: "ACME" });
    expect(byId.metadata).toEqual({ phase: "DD", floors: 12 });
    expect(new Date(byId.timestamp).toISOString()).toBe(byId.timestamp);
  });

  it("upserts by project_name: same id, fields replaced", () => {
    const id1 = storeProject({ project_name: "Upsert", project_status: "Active" });
    const id2 = storeProject({ project_name: "Upsert", project_status: "On Hold", author: "JS" });
    expect(id2).toBe(id1);
    expect(getProjectById(id1)).toMatchObject({ project_status: "On Hold", author: "JS", metadata: null });
    expect(getAllProjects().filter((p) => p.project_name === "Upsert")).toHaveLength(1);
  });

  it("returns null for unknown projects", () => {
    expect(getProjectById(999999)).toBeNull();
    expect(getProjectByName("does not exist")).toBeNull();
  });

  it("stores rooms in batch, upserting by (project, room_id), ordered by room number", () => {
    const pid = storeProject({ project_name: "Rooms" });
    expect(
      storeRoomsBatch(pid, [
        { room_id: "r2", room_number: "102", room_name: "Office", area: 20.5 },
        { room_id: "r1", room_number: "101", room_name: "Lobby", metadata: { finish: "tile" } },
      ])
    ).toBe(2);
    storeRoomsBatch(pid, [{ room_id: "r2", room_number: "102", room_name: "Big Office", area: 30 }]);

    const rooms = getRoomsByProjectId(pid);
    expect(rooms.map((r) => r.room_id)).toEqual(["r1", "r2"]);
    expect(rooms[0].metadata).toEqual({ finish: "tile" });
    expect(rooms[1]).toMatchObject({ room_name: "Big Office", area: 30 });

    const joined = getAllRoomsWithProject().filter((r) => r.project_id === pid);
    expect(joined.every((r) => r.project_name === "Rooms")).toBe(true);
  });

  it("keeps a legitimate zero area / perimeter instead of turning it into NULL", () => {
    const pid = storeProject({ project_name: "Zero" });
    storeRoomsBatch(pid, [{ room_id: "shaft", area: 0, perimeter: 0 }]);
    expect(getRoomsByProjectId(pid)[0]).toMatchObject({ area: 0, perimeter: 0 });
  });

  it("getStats counts projects and rooms", () => {
    const before = getStats();
    const pid = storeProject({ project_name: `Stats ${Date.now()}` });
    storeRoomsBatch(pid, [{ room_id: "a" }, { room_id: "b" }]);
    expect(getStats()).toEqual({
      total_projects: before.total_projects + 1,
      total_rooms: before.total_rooms + 2,
    });
  });
});
