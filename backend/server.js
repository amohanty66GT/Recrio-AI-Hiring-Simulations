// backend/server.js — ESM, dynamic flow with follow-ups + static assets + per-session artifacts
import path from "path";
import fs from "fs";
import { promises as fsp } from "fs";
import http from "http";
import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------- Config
const PORT = process.env.PORT || 4000;
const TPL_DIR = path.join(__dirname, "templates"); // stable regardless of CWD

// Map org/role -> scenario files
const SCENARIOS = {
  sga: {
    swe: "sga/sga-software-engineer.json",
    de:  "sga/sga-data-engineer.json",
    ml:  "sga/sga-ml-engineer.json",
  },
};

// ---------- In-memory session store
const SessionStore = {
  _store: new Map(), // sessionId -> { id, started, locked:{}, channels:[{name,topic,history[]}], scenario, results:[] }

  create({ scenario, meta }) {
    const id = `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const channels = (scenario.channels || []).map((c) => ({
      name: c.name,
      topic: c.topic || "",
      history: [],
      // Add conversation flow info from the first script step
      conversationFlow: scenario.script?.[c.name]?.[0]?.conversationFlow || null,
    }));
    const rec = { id, started: false, locked: {}, channels, scenario, meta: meta || {}, results: [] };
    this._store.set(id, rec);
    return rec;
  },

  get(id) { return this._store.get(id) || null; },

  addMessage(sessionId, channelName, msg) {
    const rec = this.get(sessionId);
    if (!rec) return;
    const ch = rec.channels.find((c) => c.name === channelName);
    if (!ch) return;
    ch.history.push({ ...msg, ts: msg.ts || Date.now() });
  },

  lockChannel(sessionId, channelName) {
    const rec = this.get(sessionId);
    if (!rec) return;
    rec.locked[channelName] = true;
  },

  addTaskResult(sessionId, result) {
    const rec = this.get(sessionId);
    if (!rec) return;
    rec.results.push(result);
  }
};

// ---------- Utilities
async function loadScenario(org, role) {
  const file = SCENARIOS[String(org).toLowerCase()]?.[String(role).toLowerCase()];
  if (!file) throw new Error(`No scenario for ${org}/${role}`);
  const full = path.join(TPL_DIR, file);
  const raw = await fsp.readFile(full, "utf-8");
  return JSON.parse(raw);
}

function gradeTask(task, answer) {
  if (!task) return { score: 0, detail: "Unknown task" };
  if (task.type === "mcq") {
    const score = answer?.choice === task.correct ? (task.score || 0) : 0;
    return { score, detail: `Correct: ${task.correct}` };
  }
  if (task.answer?.kind === "freeform") {
    const text = (answer?.text || "").trim();
    let score = 0; const notes = [];
    for (const r of task.answer.rubric || []) {
      try {
        const re = new RegExp(r.match.regex, r.match.flags || "");
        if (re.test(text)) { score += r.score; if (r.why) notes.push(r.why); }
      } catch {}
    }
    const max = task.answer.maxScore ?? score;
    return { score: Math.min(score, max), detail: notes.join("; ") };
  }
  return { score: 0, detail: "Unsupported task type" };
}

// ---------- Flow engine (with follow-ups)
const FlowState = new Map(); // sessionId -> { channelName: { index } }

function getChannelScript(scenario, channelName) {
  return scenario.script?.[channelName] || [];
}

function sendSay(io, sessionId, channel, say, scenario) {
  for (const msg of say || []) {
    const base = { sender: msg.sender, text: msg.text, ts: Date.now() };
    SessionStore.addMessage(sessionId, channel, base);
    io.to(sessionId).emit("chat:append", { channel, ...base });
    if (msg.taskId) {
      const task = (scenario.tasks || []).find((t) => t.id === msg.taskId);
      if (task) io.to(sessionId).emit("task:assign", { channel, task });
    }
  }
}

function matchWhen(when, text) {
  if (!when) return true;
  if (when.otherwise) return true;
  const hay = (text || "").toLowerCase();
  if (when.containsAny) {
    return when.containsAny.some((t) => hay.includes(String(t).toLowerCase()));
  }
  if (when.regex) {
    try { return new RegExp(when.regex, when.flags || "i").test(text || ""); } catch {}
  }
  return false;
}

function advanceOnEvent(io, sess, channel, event) {
  const script = getChannelScript(sess.scenario, channel);
  if (!script.length) return;

  const stAll = FlowState.get(sess.id) || {};
  const st = stAll[channel] || { index: 0 };
  const step = script[st.index];
  if (!step) return;

  // Check if this step uses ABABAB conversation flow
  if (step.conversationFlow?.type === "ababab") {
    // Let the frontend handle ABABAB flow - don't advance backend state
    return;
  }

  // Prefer step.on[...] follow-ups
  const key =
    event.type === "task_submit" ? `taskResult:${event.taskId}` :
    event.type === "candidate_message" ? "message" : null;

  const handlerList = key ? step.on?.[key] : null;
  if (handlerList && handlerList.length) {
    const textToEval = event.type === "task_submit" ? (event.answerText || "") : (event.text || "");
    for (const h of handlerList) {
      if (matchWhen(h.when, textToEval)) {
        sendSay(io, sess.id, channel, h.say || [], sess.scenario);
        if (h.next) {
          st.index = script.findIndex((s) => s.id === h.next);
          stAll[channel] = st; FlowState.set(sess.id, stAll);
          const next = script[st.index];
          if (next) sendSay(io, sess.id, channel, next.say || [], sess.scenario);
        }
        return;
      }
    }
    return; // no branch matched: wait for more input
  }

  // Back-compat waitFor/next
  const w = step.waitFor;
  const ok =
    (w?.type === "candidate_message" && event.type === "candidate_message") ||
    (w?.type === "task_submit" && event.type === "task_submit" && w.taskId === event.taskId);
  if (ok) {
    st.index = step.next ? script.findIndex((s) => s.id === step.next) : -1;
    stAll[channel] = st; FlowState.set(sess.id, stAll);
    const next = script.find((s) => s.id === step.next);
    if (next) sendSay(io, sess.id, channel, next.say || [], sess.scenario);
  }
}

// ---------- Per-session artifact generation (SWE example)
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

async function genSWEWaterfall(sessionId) {
  const slowMs = randInt(7000, 11000);  // 7–11s
  const jsMs   = randInt(180, 350);
  const cssMs  = randInt(140, 260);
  const meMs   = randInt(120, 240);

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="780" height="160">
  <style>.t{font:12px sans-serif;fill:#111}.axis{stroke:#ccc}.bar{fill:#66a3ff}.bar.slow{fill:#ff4d4f}</style>
  <rect width="100%" height="100%" fill="#fff"/>
  <text class="t" x="12" y="20">Network Waterfall (ms) — sess ${sessionId.slice(-6)}</text>
  <line x1="150" y1="30"  x2="740" y2="30"  class="axis"/>
  <line x1="150" y1="60"  x2="740" y2="60"  class="axis"/>
  <line x1="150" y1="90"  x2="740" y2="90"  class="axis"/>
  <line x1="150" y1="120" x2="740" y2="120" class="axis"/>

  <text class="t" x="10" y="50">GET /api/me</text>
  <rect class="bar" x="150" y="38" width="${Math.round(meMs/12)}" height="14"/>
  <text class="t" x="${150+Math.round(meMs/12)+10}" y="50">~${meMs}ms</text>

  <text class="t" x="10" y="80">GET /api/stats</text>
  <rect class="bar slow" x="150" y="68" width="${Math.round(slowMs/12)}" height="14"/>
  <text class="t" x="${150+Math.round(slowMs/12)+10}" y="80">~${(slowMs/1000).toFixed(1)}s (TTFB)</text>

  <text class="t" x="10" y="110">GET /assets.js</text>
  <rect class="bar" x="150" y="98" width="${Math.round(jsMs/12)}" height="14"/>
  <text class="t" x="${150+Math.round(jsMs/12)+10}" y="110">~${jsMs}ms</text>

  <text class="t" x="10" y="140">GET /css.css</text>
  <rect class="bar" x="150" y="128" width="${Math.round(cssMs/12)}" height="14"/>
  <text class="t" x="${150+Math.round(cssMs/12)+10}" y="140">~${cssMs}ms</text>
</svg>`.trim();

  const dir = path.join(__dirname, "static", "runs", sessionId, "swe");
  await fsp.mkdir(dir, { recursive: true });
  const fp = path.join(dir, "waterfall.svg");
  await fsp.writeFile(fp, svg, "utf-8");
  return `/static/runs/${sessionId}/swe/waterfall.svg`;
}

// ---------- App + sockets
const app = express();
app.use(cors());
app.use(express.json());

// serve static artifacts
app.use("/static", express.static(path.join(__dirname, "static")));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true, credentials: true } });

io.on("connection", (socket) => {
  socket.on("session:join", ({ sessionId }) => {
    const sess = SessionStore.get(sessionId);
    if (!sess) return;
    socket.join(sessionId);
    socket.emit("session:state", {
      started: sess.started,
      locked: sess.locked,
      channels: sess.channels,
    });
  });

  socket.on("chat:message", ({ sessionId, channel, text }) => {
    const sess = SessionStore.get(sessionId);
    if (!sess) return;
    const msg = { sender: "candidate", text, ts: Date.now() };
    SessionStore.addMessage(sessionId, channel, msg);
    io.to(sessionId).emit("chat:append", { channel, ...msg });
    advanceOnEvent(io, sess, channel, { type: "candidate_message", text });
  });

  socket.on("founder:inject", ({ sessionId, channel, text }) => {
    const sess = SessionStore.get(sessionId);
    if (!sess) return;
    const msg = { sender: "founder", text: `(Founder) ${text}`, ts: Date.now() };
    SessionStore.addMessage(sessionId, channel, msg);
    io.to(sessionId).emit("chat:append", { channel, ...msg });
  });

  socket.on("channel:lock", ({ sessionId, channel }) => {
    const sess = SessionStore.get(sessionId);
    if (!sess) return;
    SessionStore.lockChannel(sessionId, channel);
    io.to(sessionId).emit("channel:locked", { channel });
  });

  socket.on("task:submit", ({ sessionId, taskId, answer }) => {
    const sess = SessionStore.get(sessionId);
    if (!sess) return;
    const task = (sess.scenario.tasks || []).find((t) => t.id === taskId);
    const result = gradeTask(task, answer);
    SessionStore.addTaskResult(sessionId, {
      taskId, answer, score: result.score, detail: result.detail, ts: Date.now()
    });
    io.to(sessionId).emit("task:result", { taskId, score: result.score, detail: result.detail });

    // Which channel referenced this task?
    for (const ch of sess.channels) {
      const script = getChannelScript(sess.scenario, ch.name);
      if (script.some(s => (s.say || []).some(m => m.taskId === taskId))) {
        const answerText =
          (answer?.text) || (typeof answer?.choice === "string" ? answer.choice : "");
        advanceOnEvent(io, sess, ch.name, { type: "task_submit", taskId, answerText });
      }
    }
  });
});

// ---------- REST
app.get("/healthz", (_req, res) => res.json({ ok: true }));

app.post("/sessions", async (req, res) => {
  try {
    const { org = "sga", role = "swe", postingId, applicationId } = req.body || {};
    const scenario = await loadScenario(org, role);
    const sess = SessionStore.create({ scenario, meta: { postingId, applicationId } });

    // Session-unique artifact example: SWE waterfall
    if (org.toLowerCase() === "sga" && role.toLowerCase() === "swe") {
      const url = await genSWEWaterfall(sess.id);
      const t = (sess.scenario.tasks || []).find((x) => x.id === "t-swe-waterfall");
      if (t?.asset) t.asset.url = url; // point task to per-session SVG
    }

    res.json({ sessionId: sess.id, channels: sess.channels });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post("/sessions/:sessionId/start", (req, res) => {
  const sess = SessionStore.get(req.params.sessionId);
  if (!sess) return res.status(404).json({ error: "Session not found" });
  if (sess.started) return res.json({ ok: true });
  sess.started = true;

  // init flow: start first scripted step per channel
  FlowState.set(sess.id, {});
  for (const ch of sess.channels) {
    const script = getChannelScript(sess.scenario, ch.name);
    if (script.length) {
      const first = script[0];
      const st = FlowState.get(sess.id);
      st[ch.name] = { index: script.findIndex((s) => s.id === first.id) };
      FlowState.set(sess.id, st);
      sendSay(io, sess.id, ch.name, first.say || [], sess.scenario);
    }
  }
  res.json({ ok: true });
});

// ---------- Boot
server.listen(PORT, () => {
  console.log(`✅ Sim backend on http://localhost:${PORT}`);
  console.log(`Templates dir: ${path.join(TPL_DIR, "sga")}`);
});
