const express = require("express");
const cors = require("cors");
const db = require("./db");

const app = express();
app.use(cors());
app.use(express.json({ limit: "15mb" })); // base64 images can be large

// --------------------
// EMPLOYEES
// --------------------
app.post("/api/employees/bulk", async (req, res) => {
  try {
    const { employees } = req.body;
    if (!Array.isArray(employees)) {
      return res.status(400).json({ message: "employees must be an array" });
    }

    // simplest: wipe and re-insert (ok for small demo apps)
    await db.run("DELETE FROM employees");

    for (const e of employees) {
      await db.run(
        `INSERT INTO employees (id, name, email, password, role, position, department, hourlyRate, salary, manager, active, startDate, data)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          e.id,
          e.name,
          e.email,
          e.password,
          e.role,
          e.position,
          e.department,
          e.hourlyRate ?? null,
          e.salary ?? null,
          e.manager ? 1 : 0,
          e.active ? 1 : 0,
          e.startDate ?? null,
          JSON.stringify(e), // store full object
        ]
      );
    }

    res.json({ ok: true, count: employees.length });
  } catch (err) {
    console.error("BULK SAVE ERROR:", err);
    res.status(500).json({ message: "Bulk save failed" });
  }
});
app.get("/api/employees", async (req, res) => {
  try {
    const rows = await db.all("SELECT * FROM employees ORDER BY id");
    res.json(rows);
  } catch (err) {
    console.error("GET EMPLOYEES ERROR:", err);
    res.status(500).json({ message: "Failed to load employees", error: err.message });
  }
});

app.post("/api/employees/replaceAll", (req, res) => {
  const employees = req.body || [];
  db.serialize(() => {
    db.run("DELETE FROM employees");
    const stmt = db.prepare("INSERT INTO employees (id, data) VALUES (?, ?)");
    for (const e of employees) stmt.run(e.id, JSON.stringify(e));
    stmt.finalize(() => res.json({ ok: true, count: employees.length }));
  });
});

// --------------------
// PHOTOS
// key format: emp:E004
// --------------------
app.get("/api/photos", (req, res) => {
  db.all("SELECT key, data FROM photos", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const obj = {};
    for (const r of rows) obj[r.key] = r.data;
    res.json(obj);
  });
});

app.post("/api/photos", (req, res) => {
  const { key, data } = req.body || {};
  if (!key || !data) return res.status(400).json({ error: "key and data required" });

  db.run(
    "INSERT INTO photos (key, data) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET data=excluded.data",
    [key, data],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ok: true });
    }
  );
});

app.delete("/api/photos/:key", (req, res) => {
  const key = req.params.key;
  db.run("DELETE FROM photos WHERE key=?", [key], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true });
  });
});

// --------------------
// NOTIFICATIONS
// --------------------
app.get("/api/notifs", (req, res) => {
  db.all("SELECT data FROM notifications", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const notifs = rows.map(r => JSON.parse(r.data)).sort((a,b)=>b.ts-a.ts);
    res.json(notifs);
  });
});

app.post("/api/notifs", (req, res) => {
  const notif = req.body || {};
  if (!notif.id) return res.status(400).json({ error: "notif.id required" });

  db.run(
    "INSERT INTO notifications (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
    [notif.id, JSON.stringify(notif)],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ok: true });
    }
  );
});

app.post("/api/notifs/replaceAll", (req, res) => {
  const notifs = req.body || [];
  db.serialize(() => {
    db.run("DELETE FROM notifications");
    const stmt = db.prepare("INSERT INTO notifications (id, data) VALUES (?, ?)");
    for (const n of notifs) stmt.run(n.id, JSON.stringify(n));
    stmt.finalize(() => res.json({ ok: true, count: notifs.length }));
  });
});

// --------------------
const PORT = 5000;
app.listen(PORT, () => console.log(`✅ Backend running on http://localhost:${PORT}`));