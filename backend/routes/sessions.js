// backend/routes/sessions.js
import fs from "fs/promises";
import path from "path";
import express from "express";

// Adjust if your server has a different base
export const sessionsRouter = express.Router();

const TPL_DIR = path.join(process.cwd(), "backend", "templates");

// Map org/role to scenario files
const SCENARIOS = {
  sga: {
    swe: "sga/sga-software-engineer.json",
    de:  "sga/sga-data-engineer.json",
    ml:  "sga/sga-ml-engineer.json",
  },
};

// Utility: load JSON file
async function loadScenario(org, role) {
  const file = SCENARIOS[org]?.[role];
  if (!file) throw new Error(`No scenario for ${org}/${role}`);
  const full = path.join(TPL_DIR, file);
  const raw = await fs.readFile(full, "utf-8");
  return JSON.parse(raw);
}

// Stub: create a session object from scenario
// Replace with your real bootstrapping (channels, seeding, socket rooms, etc.)
async function createSessionFromScenario(scenario, opts = {}) {
  // minimal channel skeleton: name/topic + empty history (server can seed async)
  const channels = (scenario.channels || []).map((c) => ({
    name: c.name,
    topic: c.topic,
    history: c.seed ? c.seed.map(s => ({ sender: s.sender, text: s.text, ts: Date.now() })) : [],
  }));

  // In your real server, you would:
  // - persist a session record
  // - join a socket room
  // - emit each seed message (and for any seed with taskId, also emit "task:assign" with the task object)
  // Here we just return a mock session id + initial channel state.
  return {
    id: `sess_${Date.now().toString(36)}`,
    channels,
    scenario,
    meta: { postingId: opts.postingId || null, applicationId: opts.applicationId || null },
  };
}

// POST /sessions — create from URL-provided params (Option A)
sessionsRouter.post("/sessions", async (req, res) => {
  try {
    const { org = "sga", role = "swe", postingId, applicationId } = req.body || {};
    const scenario = await loadScenario(String(org).toLowerCase(), String(role).toLowerCase());

    const session = await createSessionFromScenario(scenario, { postingId, applicationId });

    // IMPORTANT: if you seed via sockets, do that here (not shown).
    // Also emit task assignments for any seed with taskId:
    // for (const ch of scenario.channels) { for (const msg of ch.seed||[]) { if (msg.taskId) { ...emit("task:assign", { task }) } } }

    res.json({ sessionId: session.id, channels: session.channels });
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message || "Failed to create session" });
  }
});

// Optional: start endpoint
sessionsRouter.post("/sessions/:sessionId/start", async (_req, res) => {
  res.json({ ok: true });
});
