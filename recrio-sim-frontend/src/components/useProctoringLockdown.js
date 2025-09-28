// useProctoringLockdown.js
// Lightweight, in-browser "lockdown"/proctoring utilities for your simulation MVP.
// - Tracks: tab/window blur, visibility changes, right-click, copy/cut/paste, key combos,
//   window resize, rapid focus toggling, and a heuristic "DevTools open" signal.
// - Emits incidents via a provided emit function (e.g., socket.emit) and also returns
//   them via an optional onIncident callback.
// - No external deps.

import { useEffect, useRef } from "react";

const DEFAULT_FORBIDDEN_KEYS = [
  // DevTools
  { code: "F12" },
  { ctrlKey: true, shiftKey: true, key: "I" },
  { ctrlKey: true, shiftKey: true, key: "J" },
  { ctrlKey: true, shiftKey: true, key: "C" }, // open console in some browsers
  { ctrlKey: true, key: "U" }, // view source
  // Copy / paste / cut / save / find / new window
  { ctrlKey: true, key: "C" },
  { ctrlKey: true, key: "V" },
  { ctrlKey: true, key: "X" },
  { ctrlKey: true, key: "S" },
  { ctrlKey: true, key: "F" },
  { ctrlKey: true, key: "N" },
  // macOS variants (Cmd)
  { metaKey: true, shiftKey: true, key: "I" },
  { metaKey: true, shiftKey: true, key: "J" },
  { metaKey: true, shiftKey: true, key: "C" },
  { metaKey: true, key: "U" },
  { metaKey: true, key: "C" },
  { metaKey: true, key: "V" },
  { metaKey: true, key: "X" },
  { metaKey: true, key: "S" },
  { metaKey: true, key: "F" },
  { metaKey: true, key: "N" },
];

function matchCombo(e, combo) {
  return (
    (!!combo.ctrlKey === e.ctrlKey) &&
    (!!combo.shiftKey === e.shiftKey) &&
    (!!combo.altKey === e.altKey) &&
    (!!combo.metaKey === e.metaKey) &&
    ((combo.key && e.key?.toUpperCase() === combo.key.toUpperCase()) || !combo.key) &&
    ((combo.code && e.code === combo.code) || !combo.code)
  );
}

function nowTs() {
  return new Date().toISOString();
}

function devtoolsHeuristicOpen() {
  // Heuristic 1: if devtools docks, innerHeight/outerHeight gap grows drastically
  const heightGap = window.outerHeight - window.innerHeight;
  const widthGap = window.outerWidth - window.innerWidth;
  // thresholds chosen empirically
  return heightGap > 160 || widthGap > 160;
}

/**
 * useProctoringLockdown
 * @param {object} opts
 * @param {(incident: object)=>void} [opts.onIncident] - called for every incident
 * @param {(eventName: string, payload: any)=>void} [opts.emit] - e.g. (evt,p)=>socket.emit(evt,p)
 * @param {string} [opts.sessionId]
 * @param {string} [opts.channel] - logical channel/room for events
 * @param {Array}  [opts.forbiddenKeys] - override default combos
 * @param {boolean} [opts.preventContextMenu] - default true
 * @param {boolean} [opts.preventCopyPaste] - default true
 * @param {number}  [opts.focusFlipWindowMs] - time window to detect rapid focus flips
 * @param {number}  [opts.focusFlipThreshold] - number of flips in the window to flag
 */
export function useProctoringLockdown(opts = {}) {
  const {
    onIncident,
    emit,
    sessionId,
    channel = "proctoring",
    forbiddenKeys = DEFAULT_FORBIDDEN_KEYS,
    preventContextMenu = true,
    preventCopyPaste = true,
    focusFlipWindowMs = 8000,
    focusFlipThreshold = 4,
  } = opts;

  const lastVisibilityState = useRef(document.visibilityState);
  const focusTimestamps = useRef([]); // for rapid flip detection
  const devtoolsOpenRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const report = (type, details = {}) => {
      const incident = {
        type,
        ts: nowTs(),
        sessionId,
        channel,
        details,
        ua: navigator.userAgent,
      };
      try {
        onIncident?.(incident);
      } catch {}
      try {
        emit?.("proctor:incident", incident);
      } catch {}
    };

    // Initial signal that lockdown is active
    report("lockdown_started");

    // Visibility / Focus / Blur
    const onVisibility = () => {
      const curr = document.visibilityState;
      if (curr !== lastVisibilityState.current) {
        report("visibility_change", { from: lastVisibilityState.current, to: curr });
        lastVisibilityState.current = curr;
      }
      if (curr === "hidden") report("tab_hidden");
      if (curr === "visible") report("tab_visible");
    };

    const onFocus = () => {
      report("window_focus");
      // focus flip tracking
      const now = Date.now();
      focusTimestamps.current.push(now);
      // prune old entries
      focusTimestamps.current = focusTimestamps.current.filter(t => now - t <= focusFlipWindowMs);
      if (focusTimestamps.current.length >= focusFlipThreshold) {
        report("rapid_focus_toggling", {
          flips: focusTimestamps.current.length,
          windowMs: focusFlipWindowMs,
        });
        // reset, to avoid spamming
        focusTimestamps.current = [];
      }
    };

    const onBlur = () => report("window_blur");

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);

    // Context menu / copy-paste
    const stop = (e) => { e.preventDefault(); e.stopPropagation(); };

    const onContext = (e) => {
      if (!preventContextMenu) return;
      report("contextmenu_attempt", { x: e.clientX, y: e.clientY });
      stop(e);
    };

    const onCopy = (e) => {
      if (!preventCopyPaste) return;
      report("copy_attempt");
      stop(e);
    };
    const onCut = (e) => {
      if (!preventCopyPaste) return;
      report("cut_attempt");
      stop(e);
    };
    const onPaste = (e) => {
      if (!preventCopyPaste) return;
      report("paste_attempt");
      stop(e);
    };

    window.addEventListener("contextmenu", onContext, { capture: true });
    window.addEventListener("copy", onCopy, { capture: true });
    window.addEventListener("cut", onCut, { capture: true });
    window.addEventListener("paste", onPaste, { capture: true });

    // Keyboard shortcuts
    const onKeyDown = (e) => {
      // Don’t interfere with typing in inputs for common keys unless matched
      const isForbidden = forbiddenKeys.some(c => matchCombo(e, c));
      if (isForbidden) {
        report("forbidden_key_combo", {
          key: e.key,
          code: e.code,
          ctrl: e.ctrlKey,
          meta: e.metaKey,
          alt: e.altKey,
          shift: e.shiftKey,
        });
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      return true;
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });

    // Resize monitoring (possible screen-share or devtools dock)
    let resizeTimeout;
    const onResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        report("window_resize", {
          iw: window.innerWidth,
          ih: window.innerHeight,
          ow: window.outerWidth,
          oh: window.outerHeight,
        });
      }, 150);
    };
    window.addEventListener("resize", onResize);

    // DevTools heuristic polling
    const interval = setInterval(() => {
      const open = devtoolsHeuristicOpen();
      if (open && !devtoolsOpenRef.current) {
        devtoolsOpenRef.current = true;
        report("devtools_open_heuristic");
      } else if (!open && devtoolsOpenRef.current) {
        devtoolsOpenRef.current = false;
        report("devtools_closed_heuristic");
      }
    }, 1000);

    // Before unload (user attempts to close/refresh)
    const onBeforeUnload = (e) => {
      report("before_unload");
      // Optional: show confirmation dialog (may be ignored by some browsers)
      e.preventDefault();
      e.returnValue = "Are you sure you want to leave the simulation?";
      return e.returnValue;
    };
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("contextmenu", onContext, { capture: true });
      window.removeEventListener("copy", onCopy, { capture: true });
      window.removeEventListener("cut", onCut, { capture: true });
      window.removeEventListener("paste", onPaste, { capture: true });
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      window.removeEventListener("resize", onResize);
      window.removeEventListener("beforeunload", onBeforeUnload);
      clearInterval(interval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, channel, onIncident, emit, preventContextMenu, preventCopyPaste]);
}

// -----------------------------------------------------------------------------
// <ProctoringGuard/> Component
// A drop-in wrapper that enables the hook and renders an overlay banner that
// informs candidates they are being monitored. Helps with deterrence and UX.
// -----------------------------------------------------------------------------
export default function ProctoringGuard({
  children,
  emit,        // (eventName, payload) => void
  sessionId,
  channel,
  onIncident,
  showBanner = true,
  bannerText = "You are in a monitored simulation. Tab switching, copy/paste, and devtools are prohibited.",
  className = "",
}) {
  useProctoringLockdown({ emit, sessionId, channel, onIncident });

  return (
    <div className={"relative " + className}>
      {showBanner && (
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 50,
            padding: "8px 12px",
            fontSize: 12,
            background: "rgba(220, 38, 38, 0.1)",
            borderBottom: "1px solid rgba(220,38,38,0.35)",
            backdropFilter: "blur(4px)",
          }}
        >
          {bannerText}
        </div>
      )}
      {children}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Usage example (inside SimulationRunner.jsx)
// -----------------------------------------------------------------------------
// import ProctoringGuard from "./useProctoringLockdown";
//
// function SimulationRunner() {
//   const socketRef = useRef(null);
//   const sessionId = state.sessionId; // however you obtain it
//
//   useEffect(() => {
//     socketRef.current = io(API_URL); // make sure this ref is set before render paths that use it
//     return () => socketRef.current?.disconnect();
//   }, []);
//
//   const emit = (evt, payload) => socketRef.current?.emit(evt, payload);
//
//   return (
//     <ProctoringGuard emit={emit} sessionId={sessionId} channel="incident-war-room" />
//       {/* ...rest of your simulation UI... */}
//     </ProctoringGuard>
//   );
// }

// -----------------------------------------------------------------------------
// Server-side idea (Node/Socket.io)
// -----------------------------------------------------------------------------
// io.on("connection", (socket) => {
//   socket.on("proctor:incident", (incident) => {
//     // Persist or route to moderators / logs
//     // incident = {type, ts, sessionId, channel, details, ua}
//     console.log("[PROCTOR]", incident.type, incident.sessionId, incident.details);
//     // io.to(incident.channel).emit("proctor:incident", incident); // optional fanout
//   });
// });
