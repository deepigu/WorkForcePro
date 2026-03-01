const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const dbPath = path.join(__dirname, "workforcepro.sqlite");
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error("❌ SQLite open error:", err.message);
  else console.log("✅ SQLite connected:", dbPath);
});

// --- Promisified helpers ---
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

// --- Ensure table exists ---
(async () => {
  await run(`
    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT UNIQUE,
      password TEXT,
      role TEXT,
      position TEXT,
      department TEXT,
      hourlyRate REAL,
      salary REAL,
      manager INTEGER,
      active INTEGER,
      startDate TEXT
    )
  `);
})().catch((e) => console.error("❌ Init table error:", e.message));

module.exports = { run, all, get, raw: db };
