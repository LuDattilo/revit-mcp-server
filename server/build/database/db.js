import Database from 'better-sqlite3';
import { join } from 'path';
import { homedir } from 'os';
import { mkdirSync } from 'fs';
// Database path (stored in user home directory)
const DB_DIR = join(homedir(), '.mcp-revit');
mkdirSync(DB_DIR, { recursive: true });
const DB_PATH = join(DB_DIR, 'revit-data.db');
// Initialize database connection
export const db = new Database(DB_PATH);
// Enable foreign keys
db.pragma('foreign_keys = ON');
// Initialize database schema
export function initializeDatabase() {
    // Create projects table
    db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_name TEXT NOT NULL,
      project_path TEXT,
      project_number TEXT,
      project_address TEXT,
      client_name TEXT,
      project_status TEXT,
      author TEXT,
      timestamp INTEGER NOT NULL,
      last_updated INTEGER NOT NULL,
      metadata TEXT
    )
  `);
    // Create rooms table
    db.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      room_id TEXT NOT NULL,
      room_name TEXT,
      room_number TEXT,
      department TEXT,
      level TEXT,
      area REAL,
      perimeter REAL,
      occupancy TEXT,
      comments TEXT,
      timestamp INTEGER NOT NULL,
      metadata TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      UNIQUE(project_id, room_id)
    )
  `);
    // Create index for faster queries
    db.exec(`
    CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(project_name);
    CREATE INDEX IF NOT EXISTS idx_projects_timestamp ON projects(timestamp);
    CREATE INDEX IF NOT EXISTS idx_rooms_project_id ON rooms(project_id);
    CREATE INDEX IF NOT EXISTS idx_rooms_room_number ON rooms(room_number);
  `);
}
// Graceful shutdown
process.on('exit', () => db.close());
process.on('SIGTERM', () => { db.close(); process.exit(0); });
process.on('SIGINT', () => { db.close(); process.exit(0); });
// Initialize on module load
initializeDatabase();
export default db;
