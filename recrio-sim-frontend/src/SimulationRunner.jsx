import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import io from "socket.io-client";
import { EscalationDashboard } from "./components/EscalationDashboard";
import TaskPanel from "./components/TaskPanel";
import { getScenarioParams } from "./utils/getScenarioParams";
import "./pages/styles/sim.css";
import "./pages/styles/task-styles.css";
import { naturalExtract } from "./data/naturalBank.js";
import { useProctoring } from "./hooks/useProctoring";

const MAX_BOT_TURNS = 9;
function isWaffly(text) {
  if (!text) return true;
  const hedges = /(maybe|might|could|probably|i think|not sure|idk|we(’|'|)ll see|unsure)/i;
  const hasNumberOrUnit = /(\d+(\.\d+)?)(ms|s|%|\/s)?/i.test(text);
  const hasAction = /(check|grep|run|trace|explain|rollback|toggle|purge|sample|profile|measure|query|curl|kubectl|explain analyze|vacuum|analyze)/i.test(text);
  const hasArtifact = /(p95|p99|5xx|status\s*5\d{2}|cache hit|ttl|plan|explain|query plan|route|pool|token|lock wait|blocked pid)/i.test(text);
  const tooShort = text.trim().length < 15;
  const hedgy = hedges.test(text);
  const concrete = hasNumberOrUnit || hasAction || hasArtifact;
  return hedgy || tooShort || !concrete;
}

// --- Utility functions ---
function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStringToInt(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return Math.abs(h | 0);
}
function pickRandomQuestions(arr, max, rng = Math) {
  const n = Math.min(max, Array.isArray(arr) ? arr.length : 0);
  if (!n) return [];
  const rand = typeof rng === "function"
    ? rng
    : (rng && typeof rng.random === "function" ? () => rng.random() : Math.random);
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

function getRoleFromUrl() {
  const path = window.location.pathname.toLowerCase();
  if (path.includes("ml-engineer")) return "ml-engineer";
  if (path.includes("data-engineer")) return "data-engineer";
  if (path.includes("swe")) return "swe";
  return "swe"; // default
}

const API_BASE = import.meta.env.VITE_API_BASE || "";

export default function SimulationRunner() {
  const socketRef = useRef(null);
  const [sessionId, setSessionId] = useState(null);
  const [channels, setChannels] = useState([]);
  const [active, setActive] = useState(null);
  const [history, setHistory] = useState({});
  const [locked, setLocked] = useState({});
  const [unread, setUnread] = useState({});
  const [blinking, setBlinking] = useState({});
  const [input, setInput] = useState("");
  const [timeRemaining, setTimeRemaining] = useState(1800); // 30 minutes
  const [simulationEnded, setSimulationEnded] = useState(false);

  // camera & dashboard state (unchanged)
  const [violations, setViolations] = useState(0);
  const [prompts, setPrompts] = useState([]);
  const [resolvedIdxSet, setResolvedIdxSet] = useState(new Set());
  const [taskMap, setTaskMap] = useState({});
  const [openTaskId, setOpenTaskId] = useState(null);

  const [started, setStarted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const scrollerRef = useRef(null);
  const emit = useCallback((event, payload = {}) => {
    socketRef.current?.emit(event, payload);
  }, []);

  const proctor = useProctoring({
    socketRef,
    enabled: started,
    modelPath: "/models/face_detection_short_range.tflite"
  });
  const blobURLsRef = useRef(new Set());
  const sessionSeedRef = useRef(hashStringToInt(String(Date.now())));
  const [sessionQuestions, setSessionQuestions] = useState([]);
  const [conversationState, setConversationState] = useState({ qIdx: 0, fIdx: -1 });
  const [initialPrompt, setInitialPrompt] = useState("");

  const role = getRoleFromUrl();

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [history[active]?.length, active]);

  // Lock-on-tab/blur listeners
  const lockActiveAndAdvance = useCallback((reason, channelName) => {
    const ch = channelName || active;
    if (!ch) return;
    setLocked((L) => ({ ...L, [ch]: true }));
    socketRef.current?.emit?.("proctor:event", {
      type: "lock",
      reason,
      channel: ch,
      sessionId,
      ts: Date.now()
    });
    socketRef.current?.emit?.("session:lock", { sessionId, channel: ch, reason });
    setHistory((prev) => ({
      ...prev,
      [ch]: [
        ...(prev[ch] || []),
        { sender: "system", text: "Section locked due to tab/app switch.", ts: Date.now() }
      ]
    }));
    const idx = channels.findIndex((c) => c.name === ch);
    const total = channels.length;
    if (idx >= 0 && total > 1) {
      const nextIdx = (idx + 1) % total;
      const nextName = channels[nextIdx]?.name;
      if (nextName && nextName !== ch) setActive(nextName);
    }
  }, [active, channels, sessionId, socketRef, setHistory, setLocked, setActive]);
// NEW: soft-penalty on proctor violation (no locking, just skip Q and +1 violation)
const handleViolationSkip = useCallback((reason, channelName) => {
  const ch = channelName || active;
  if (!ch) return;

  // 1) Count the violation
  setViolations(v => v + 1);

  // 2) Tell backend (keeps your existing telemetry)
  socketRef.current?.emit?.("proctor:event", {
    type: "violation",
    reason,
    channel: ch,
    sessionId,
    ts: Date.now(),
  });

  // 3) Advance the conversation to the next question
  setConversationState(prev => {
    let { qIdx, fIdx } = prev;
    let remaining = (prev.remaining ?? MAX_BOT_TURNS);

    const nextIdx = qIdx + 1;
    const hasNext = !!sessionQuestions[nextIdx];

    if (hasNext && remaining > 0) {
      const nq = sessionQuestions[nextIdx];
      const nextText = nq?.text ?? nq?.prompt ?? "";
      const nextName = nq?.sender || "Interviewer";

      // Post a system note and the next question
      setHistory(prevH => ({
        ...prevH,
        [ch]: [
          ...(prevH[ch] || []),
          { sender: "system", text: "Tab switch detected — current question skipped.", ts: Date.now() },
          { sender: "bot:interviewer", name: nextName, text: nextText, ts: Date.now() },
        ],
      }));

      // One bot turn consumed when we post the next question
      return { qIdx: nextIdx, fIdx: -1, remaining: Math.max(0, remaining - 1) };
    }

    // No more questions to skip — just note it
    setHistory(prevH => ({
      ...prevH,
      [ch]: [
        ...(prevH[ch] || []),
        { sender: "system", text: "Tab switch detected — no more questions to skip.", ts: Date.now() },
      ],
    }));
    return prev;
  });
}, [active, sessionId, sessionQuestions, setHistory]);

  // Create session
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { org, role, postingId, applicationId, ts, sig } = getScenarioParams();

        const res = await fetch(`${API_BASE}/sessions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ org, role, postingId, applicationId, ts, sig }),
        });
        if (!res.ok) throw new Error(`Failed to create session (${res.status})`);
        const data = await res.json();
        if (cancelled) return;

        // Lock the restricted channels
        const lockedChannels = {};
        (data.channels || []).forEach(c => {
          if (c.name === "realtime-inference" || c.name === "exec-debrief") {
            lockedChannels[c.name] = true;
          }
        });
        setLocked(lockedChannels);

        setSessionId(data.sessionId);
        setChannels(data.channels || []);
        // Only allow interaction with the first channel
        if (data.channels?.[0]?.name) setActive(data.channels[0].name);

        const initial = {};
        for (const c of data.channels || []) initial[c.name] = c.history || [];
        setHistory(initial);

        const s = io(API_BASE || undefined, { transports: ["websocket"] });
        socketRef.current = s;

        s.on("connect", () => s.emit("session:join", { sessionId: data.sessionId, as: "candidate" }));
        s.on("session:state", (payload) => {
          const map = {};
          for (const ch of payload.channels || []) map[ch.name] = ch.history || [];
          setHistory(map);
          if (payload.locked) setLocked((L) => ({ ...L, ...payload.locked }));
          if (payload.started) setStarted(payload.started);
        });
        s.on("session:started", () => setStarted(true));

        s.on("chat:append", ({ channel, sender, text, ts }) => {
          // Only add message if not already present (prevents double-print)
          setHistory((prev) => {
            const existing = prev[channel] || [];
            const alreadyExists = existing.some(m => m.sender === sender && m.text === text && m.ts === ts);
            if (alreadyExists) return prev;
            return {
              ...prev,
              [channel]: [...existing, { sender, text, ts }]
            };
          });
          if (channel !== active) {
            setUnread((u) => ({ ...u, [channel]: (u[channel] || 0) + 1 }));
            blinkChannel(channel);
            try { new Audio("/ping.mp3").play(); } catch {}
          } else {
            setUnread((u) => ({ ...u, [channel]: 0 }));
          }
        });

        s.on("channel:ping", ({ channel }) => {
          if (channel !== active && !locked[channel]) {
            blinkChannel(channel);
            setUnread((u) => ({ ...u, [channel]: (u[channel] || 0) + 1 }));
            try { new Audio("/ping.mp3").play(); } catch {}
          }
        });

        s.on("channel:locked", ({ channel }) => setLocked((L) => ({ ...L, [channel]: true })));

        s.on("task:assign", async ({ channel, task }) => {
          const ensureArtifact = async (t) => {
            if (t?.asset?.kind === "image" && t.asset.url) return t;
            const seed = hashStringToInt(`${sessionSeedRef.current}:${t.id}`);
            return t;
          };

          try {
            const withArtifact = await ensureArtifact(task);
            setTaskMap((m) => ({ ...m, [withArtifact.id]: withArtifact }));
            setHistory((prev) => ({
              ...prev,
              [channel]: [
                ...(prev[channel] || []),
                {
                  sender: "system",
                  text: "New task assigned.",
                  ts: Date.now(),
                  taskSummary: {
                    id: withArtifact.id,
                    title: withArtifact.title,
                    prompt: withArtifact.prompt,
                    thumb: withArtifact.asset?.kind === "image" ? withArtifact.asset.url : null,
                  },
                },
              ],
            }));
            if (channel !== active) {
              setUnread((u) => ({ ...u, [channel]: (u[channel] || 0) + 1 }));
              blinkChannel(channel);
            }
          } catch (e) {
            console.error("artifact generation failed", e);
          }
        });

        s.on("task:result", ({ taskId, score, detail }) => {
          const t = taskMap[taskId];
          const text = t ? `Task "${t.title}" scored ${score}. ${detail || ""}` : `Task ${taskId} scored ${score}.`;
          setHistory((prev) => ({ ...prev, [active]: [...(prev[active] || []), { sender: "system", text, ts: Date.now() }] }));
        });

        s.on("error", (e) => console.error("socket error", e));
      } catch (e) {
        console.error(e);
        alert("Failed to start simulation. Check VITE_API_BASE and your backend.");
      }
    })();

    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
      socketRef.current = null;
      for (const url of blobURLsRef.current) URL.revokeObjectURL(url);
      blobURLsRef.current.clear();
    };
  }, []);

  useEffect(() => {
  if (!started || !active) return;
  const onceRef = { current: false };

  const tripOnce = (reason) => {
    if (onceRef.current) return;
    onceRef.current = true;
    // Soft penalty: count violation + skip question (NO locking)
    handleViolationSkip(reason, active);
  };

  const onVis = () => {
    if (document.hidden) tripOnce("visibility:hidden");
  };
  const onBlur = () => {
    tripOnce("window:blur");
  };
  const onFocus = () => {
    // Allow future penalties after the user returns
    onceRef.current = false;
  };

  document.addEventListener("visibilitychange", onVis);
  window.addEventListener("blur", onBlur);
  window.addEventListener("focus", onFocus);
  return () => {
    document.removeEventListener("visibilitychange", onVis);
    window.removeEventListener("blur", onBlur);
    window.removeEventListener("focus", onFocus);
  };
}, [started, active, handleViolationSkip]);


  // --- Random scenario and questions selection ---
  useEffect(() => {
    if (!role) return;
    const sessionSeed = hashStringToInt(String(sessionId || Date.now()));
    const rngFn = mulberry32(sessionSeed);
    const rng = { random: rngFn }

    const pool = (naturalExtract || []).filter(s => !s.channel || s.channel === active);
    const scenarioIdx = Math.floor(rngFn() * pool.length);
    const scenario = pool[scenarioIdx] || {};

    const MAX_Q = 9;
    const base = scenario.roles[role] || [];
    const sampled = pickRandomQuestions(base, MAX_Q, rng);
    const sessionQuestions = sampled.slice(0, MAX_Q);

    setInitialPrompt(scenario.prompt);
    setSessionQuestions(sessionQuestions);
    setConversationState({ qIdx: 0, fIdx: -1, remaining: MAX_BOT_TURNS - 1 });
  }, [role, started, sessionId, active]);

  useEffect(() => {
    if (started && sessionQuestions.length) {
      setHistory((prev) => {
        const firstQ = sessionQuestions[0]?.text || sessionQuestions[0]?.prompt || "";
        const firstName = sessionQuestions[0]?.sender || "Interviewer";
        const existing = prev[active] || [];
        const alreadyPosted = existing.some(
          m => m.sender?.startsWith?.("bot:") && m.text === firstQ
        );
        if (alreadyPosted) return prev;
        return {
          ...prev,
          [active]: [
            ...existing,
            { sender: "system", text: initialPrompt, ts: Date.now() },
            { sender: "bot:interviewer", name: firstName, text: firstQ, ts: Date.now() }
          ]
        };
      });
    }
  }, [started, sessionQuestions.length, initialPrompt, active]);

  function blinkChannel(name) {
    setBlinking((b) => ({ ...b, [name]: true }));
    setTimeout(() => setBlinking((b) => ({ ...b, [name]: false })), 1500);
  }

  const msgs = useMemo(() => history[active] || [], [history, active]);

  function sendLike() {
    if (!sessionId || !active || locked[active]) return;
    const text = input.trim();
    if (!text) return;

    setHistory((prev) => ({
      ...prev,
      [active]: [...(prev[active] || []), { sender: "candidate", text, ts: Date.now() }]
    }));
    setInput("");

    socketRef.current?.emit("chat:message", { sessionId, channel: active, text });

    setConversationState((prev) => {
      let { qIdx, fIdx } = prev;
      let remaining = (prev.remaining ?? MAX_BOT_TURNS);
      if (!sessionQuestions || !sessionQuestions[qIdx]) return { qIdx, fIdx, remaining };
      if (remaining <= 0) {
        setTimeout(() => {
          setHistory((prev2) => ({
            ...prev2,
            [active]: [
              ...(prev2[active] || []),
              { sender: "system", text: "👍 End of this simulation, you may submit your responses.", ts: Date.now() }
            ]
          }));
        }, 300);
        return { qIdx, fIdx, remaining };
      }
      const q = sessionQuestions[qIdx];
      const F = Array.isArray(q.followUps) ? q.followUps : [];
      const answer = (typeof text === "string" ? text : "").trim();
      const waffly = isWaffly(answer);
      const postBot = (name, txt) => {
        setTimeout(() => {
          setHistory((prev2) => ({
            ...prev2,
            [active]: [
              ...(prev2[active] || []),
              { sender: "bot:interviewer", name: name || "Interviewer", text: txt || "", ts: Date.now() }
            ]
          }));
        }, 500);
        remaining = Math.max(0, remaining - 1);
      };
      if (!waffly) {
        if (fIdx < 0 && F.length >= 1) {
          const fu = F[0];
          postBot(fu?.sender || "Interviewer", fu?.text ?? fu);
          return { qIdx, fIdx: 0, remaining };
        } else {
          const nxtQ = qIdx + 1;
          if (sessionQuestions[nxtQ] && remaining > 0) {
            const nq = sessionQuestions[nxtQ];
            postBot(nq?.sender || "Interviewer", nq?.text ?? nq?.prompt ?? "");
            return { qIdx: nxtQ, fIdx: -1, remaining };
          } else {
            setTimeout(() => {
              setHistory((prev2) => ({
                ...prev2,
                [active]: [
                  ...(prev2[active] || []),
                  { sender: "system", text: "👍 End of this scenario. Great job — switching topics.", ts: Date.now() }
                ]
              }));
            }, 300);
            return { qIdx, fIdx, remaining };
          }
        }
      } else {
        if (fIdx < 0 && F.length >= 2) {
          const fu = F[1];
          postBot(fu?.sender || "Interviewer", fu?.text ?? fu);
          return { qIdx, fIdx: 1, remaining };
        } else if (fIdx >= 0 && fIdx < F.length - 1) {
          const nextF = fIdx + 1;
          const fu = F[nextF];
          postBot(fu?.sender || "Interviewer", fu?.text ?? fu);
          return { qIdx, fIdx: nextF, remaining };
        } else {
          const nxtQ = qIdx + 1;
          if (sessionQuestions[nxtQ] && remaining > 0) {
            const nq = sessionQuestions[nxtQ];
            postBot(nq?.sender || "Interviewer", nq?.text ?? nq?.prompt ?? "");
            return { qIdx: nxtQ, fIdx: -1, remaining };
          } else {
            setTimeout(() => {
              setHistory((prev2) => ({
                ...prev2,
                [active]: [
                  ...(prev2[active] || []),
                  { sender: "system", text: "👍 End of this scenario. Great job — switching topics.", ts: Date.now() }
                ]
              }));
            }, 300);
            return { qIdx, fIdx, remaining };
          }
        }
      }
    });
  }

  function submitTask(answerPayload) {
    if (!openTaskId) return;
    socketRef.current?.emit("task:submit", { sessionId, taskId: openTaskId, answer: answerPayload });
    setOpenTaskId(null);
  }

  useEffect(() => {
    setPrompts([
      { id: "e1", title: "Check the slow page" },
      { id: "e2", title: "Pick a short-term fix" },
      { id: "e3", title: "Write a one-liner update" },
    ]);
  }, []);
  const dashboardItems = useMemo(
    () => prompts.map((p, i) => ({ id: p.id, title: p.title, done: resolvedIdxSet.has(i) })),
    [prompts, resolvedIdxSet]
  );

  // Timer logic
  useEffect(() => {
    if (!started) return;
    setTimeRemaining(1800); // Reset timer to 30 minutes on start
    setSimulationEnded(false);
    const timer = setInterval(() => {
      setTimeRemaining((t) => {
        if (t <= 1) {
          setSimulationEnded(true);
          clearInterval(timer);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [started]);

  // Submit simulation
  function handleSubmitSimulation() {
    setSubmitted(true);
    setSimulationEnded(true);
    setHistory((prev) => ({
      ...prev,
      [active]: [
        ...(prev[active] || []),
        { sender: "system", text: "Simulation submitted. You may close your window.", ts: Date.now() }
      ]
    }));
    // Optionally emit to backend:
    // socketRef.current?.emit("simulation:submit", { sessionId });
  }

  return (
    <div className="sim">
      {!started && (
        <div className="sim__overlay">
          <div className="panel">
            <div className="panel__title">Ready to begin?</div>
            <p>
              <strong>Basic Rules:</strong><br />
              • You have <strong>30 minutes</strong> to complete the simulation.<br />
              • It is preferred you stay in full screen, as you may risk switching tabs or misclicking which will end your exam.<br />
              • This test measures your decision-making abilities and knowledge in scenarios you may face on the job.<br />
              • You will be working with various memebers of a team in this simulation, so try your best to resolve their concerns.<br />
              • The other two channels are locked for now, as is this is simply a beta testing.<br />
              • Once you are done with the simulation, you submit your responses.<br />
            </p>
            <div className="panel__body">Click Start to begin the simulation.</div>
            <div className="panel__actions">
              <button className="btn btn--primary" onClick={() => setStarted(true)}>▶ Start Simulation</button>
            </div>
          </div>
        </div>
      )}

      <EscalationDashboard
        timeRemaining={timeRemaining}
        simulationEnded={simulationEnded}
      />

      <aside className="sim__sidebar">
        <div className="sim__brand">Recrio</div>
        <div className="sim__section">Simulation</div>
        <ul className="sim__chanlist">
          {channels.map((c, idx) => {
            const isActive = active === c.name;
            const unreadCount = unread[c.name] || 0;
            const isLocked =
              c.name === "realtime-inference" ||
              c.name === "exec-debrief" ||
              locked[c.name];
            const blink = blinking[c.name];
            // Only allow interaction with the first channel
            const isDisabled = idx !== 0 || isLocked;
            return (
              <li
                key={c.name}
                className={`sim__chan ${isActive ? "is-active" : ""} ${isLocked ? "is-locked" : ""}`}
                title={c.topic}
                onClick={() => {
                  if (!isDisabled) {
                    setActive(c.name);
                    setUnread((u) => ({ ...u, [c.name]: 0 }));
                  }
                }}
                style={isDisabled ? { pointerEvents: "none", opacity: 0.5 } : {}}
              >
                <div className="sim__chan-left">
                  {blink && !isLocked && <span className="sim__blink" />}
                  <span className="sim__chan-name">#{c.name}</span>
                </div>
                <div className="sim__chan-right">
                  {isLocked && <span className="sim__lock">🔒</span>}
                  {unreadCount ? <span className="sim__badge">{unreadCount}</span> : null}
                </div>
              </li>
            );
          })}
        </ul>
      </aside>

      <main className="sim__main">
        <header className="sim__header" style={{ display: "flex", alignItems: "center" }}>
          <div className="sim__header-title">
            <span className="sim__hash">#</span>
            <span className="sim__title">{active || "…"}</span>
            {locked[active] && <span className="sim__header-lock">— locked</span>}
          </div>
          <div className="badge" style={{ marginLeft: 16 }}>Violations: {violations}</div>
          {/* Submit button in header, top right */}
          <button
            className="btn btn--success"
            style={{
              marginLeft: "auto",
              fontSize: "1rem",
              padding: "6px 18px",
              height: "32px",
              alignSelf: "center"
            }}
            onClick={handleSubmitSimulation}
            disabled={submitted}
          >
            Submit Simulation
          </button>
        </header>

        <div className="sim__feed" ref={scrollerRef}>
          {(msgs.length ? msgs : [{ sender: "system", text: "Loading…" }]).map((m, i) => (
            <Bubble
              key={`${m.ts || i}-${i}`}
              sender={m.sender}
              name={m.name}
              text={m.text}
              taskSummary={m.taskSummary}
              onOpenTask={() => m.taskSummary && setOpenTaskId(m.taskSummary.id)}
            />
          ))}
          {locked[active] && <div className="locknote">This channel is locked. Switch to another channel.</div>}
        </div>

        <footer className="sim__composer">
          <div className={`composer ${locked[active] ? "is-disabled" : ""}`}>
            <textarea
              className="composer__input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendLike();
                }
              }}
              placeholder={
                locked[active]
                  ? "Channel locked — switch to another channel"
                  : "Type your response… (Enter to send)"
              }
              disabled={locked[active] || submitted}
            />
            <button
              className={`btn ${input.trim() && !locked[active] && !submitted ? "btn--primary" : "btn--disabled"}`}
              onClick={sendLike}
              disabled={!input.trim() || locked[active] || submitted}
            >
              Send
            </button>
          </div>
        </footer>
      </main>

      {openTaskId && (
        <TaskPanel
          task={taskMap[openTaskId]}
          onClose={() => setOpenTaskId(null)}
          onSubmit={submitTask}
        />
      )}
    </div>
  );
}

function Bubble({ sender, name, text, taskSummary, onOpenTask }) {
  const isUser = sender === "candidate";
  const isBot = sender?.startsWith?.("bot:");
  const label = name
    ? name
    : isUser
    ? "You"
    : isBot
    ? sender.replace("bot:", "")
    : sender;
  if (!taskSummary) {
    return (
      <div className={`bubble ${isUser ? "bubble--me" : ""}`}>
        <div className="bubble__meta">{label}</div>
        <div className="bubble__text">{text}</div>
      </div>
    );
  }

  return (
    <div className="bubble">
      <div className="bubble__meta">{label}</div>
      <div className="bubble__text">
        <div className="taskcard">
          <div className="taskcard__title">{taskSummary.title}</div>
          <div className="taskcard__prompt">{taskSummary.prompt}</div>
          {taskSummary.thumb && (
            <img
              src={taskSummary.thumb}
              alt="task"
              className="taskcard__thumb"
              onLoad={(e)=>{ try { e.currentTarget.decode?.(); } catch {} }}
            />
          )}
          <button className="btn btn--primary" onClick={onOpenTask}>Open Task</button>
        </div>
      </div>
    </div>
  );
}