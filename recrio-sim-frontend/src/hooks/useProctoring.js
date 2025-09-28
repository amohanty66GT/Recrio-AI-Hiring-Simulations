// src/hooks/useProctoring.js
import { useEffect, useRef, useState } from "react";
import { FilesetResolver, FaceDetector } from "@mediapipe/tasks-vision";

export function useProctoring({ socketRef, enabled, modelPath = "/models/face_detection_short_range.tflite" }) {
  const videoRef = useRef(null);
  const detectorRef = useRef(null);
  const streamRef = useRef(null);
  const timersRef = useRef({ noFace: null, multiFace: null });
  const [status, setStatus] = useState({ camera: "idle", faces: 0, fullscreen: false });

  // helper to emit events
  const emit = (type, extra = {}) =>
    socketRef?.current?.emit("proctor:event", { type, ...extra, ts: Date.now() });

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let rafId;

    async function initCameraAndDetector() {
      try {
        setStatus(s => ({ ...s, camera: "requesting" }));
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 360 }, audio: false });
        if (cancelled) return;
        streamRef.current = stream;

        // Attach to a hidden video element (created if not provided)
        if (!videoRef.current) {
          const v = document.createElement("video");
          v.setAttribute("playsinline", "");
          v.muted = true;
          v.autoplay = true;
          v.style.position = "fixed";
          v.style.bottom = "16px";
          v.style.right = "16px";
          v.style.width = "240px";
          v.style.height = "135px";
          v.style.objectFit = "cover";
          v.style.zIndex = "9999";
          v.style.border = "2px solid rgba(255,0,0,0.4)";
          v.style.borderRadius = "8px";
          v.id = "proctor-preview";
          document.body.appendChild(v);
          videoRef.current = v;
        }
        videoRef.current.srcObject = stream;

        setStatus(s => ({ ...s, camera: "ok" }));
        emit("camera-ok");

        // Load face detector
        const filesetResolver = await FilesetResolver.forVisionTasks(
          // will fetch wasm + support files from default CDN; fine for a start
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        const detector = await FaceDetector.createFromOptions(filesetResolver, {
          baseOptions: { modelAssetPath: modelPath },
          runningMode: "VIDEO",
          minDetectionConfidence: 0.5
        });
        detectorRef.current = detector;

        // Start loop
        const loop = async () => {
          if (cancelled || !videoRef.current) return;
          const faces = await detectorRef.current.detectForVideo(videoRef.current, performance.now());
          const count = faces?.detections?.length || 0;

          setStatus(s => ({ ...s, faces: count }));

          // debounce and emit events for state changes
          if (count === 0) {
            if (!timersRef.current.noFace) {
              timersRef.current.noFace = setTimeout(() => emit("no-face-5s"), 5000);
            }
          } else {
            if (timersRef.current.noFace) {
              clearTimeout(timersRef.current.noFace);
              timersRef.current.noFace = null;
            }
          }

          if (count >= 2) {
            if (!timersRef.current.multiFace) {
              timersRef.current.multiFace = setTimeout(() => emit("multiple-faces-2s", { count }), 2000);
            }
          } else {
            if (timersRef.current.multiFace) {
              clearTimeout(timersRef.current.multiFace);
              timersRef.current.multiFace = null;
            }
          }

          rafId = requestAnimationFrame(loop);
        };
        rafId = requestAnimationFrame(loop);
      } catch (err) {
        setStatus(s => ({ ...s, camera: "error" }));
        emit("camera-error", { message: String(err) });
      }
    }

    // Fullscreen lock (soft)
    async function enterFullscreen() {
      const el = document.documentElement;
      if (!document.fullscreenElement && el.requestFullscreen) {
        try { await el.requestFullscreen(); } catch {}
      }
      setStatus(s => ({ ...s, fullscreen: !!document.fullscreenElement }));
    }

    function onFullscreenChange() {
      const on = !!document.fullscreenElement;
      setStatus(s => ({ ...s, fullscreen: on }));
      emit(on ? "fullscreen-enter" : "fullscreen-exit");
    }

    // Tab/lookup deterrents + shortcuts
    function onVis() { emit(document.hidden ? "tab-hidden" : "tab-visible"); }
    function onBlur() { emit("window-blur"); }
    function onFocus() { emit("window-focus"); }
    function onCopy(e) { e.preventDefault(); emit("copy-blocked"); }
    function onPaste(e) { e.preventDefault(); emit("paste-blocked"); }
    function onCtx(e) { e.preventDefault(); emit("contextmenu-blocked"); }
    function onKey(e) {
      // Block common “lookup/switch” keys; can’t block Alt+Tab, but we detect blur/visibility above
      const combo =
        (e.ctrlKey || e.metaKey) &&
        ["l","k","t","n","w","r","p","f"].includes(e.key.toLowerCase());
      const devtools = (e.ctrlKey || e.metaKey) && e.shiftKey && ["i","c","j"].includes(e.key.toLowerCase());
      const f12 = e.key === "F12";
      if (combo || devtools || f12) {
        e.preventDefault();
        e.stopPropagation();
        emit("shortcut-blocked", { key: e.key, ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey });
      }
    }

    initCameraAndDetector();
    enterFullscreen();

    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    document.addEventListener("copy", onCopy);
    document.addEventListener("paste", onPaste);
    window.addEventListener("contextmenu", onCtx, { capture: true });
    window.addEventListener("keydown", onKey, { capture: true });

    // prevent accidental unload
    const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ""; emit("beforeunload"); };
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      Object.values(timersRef.current).forEach(t => t && clearTimeout(t));
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("paste", onPaste);
      window.removeEventListener("contextmenu", onCtx, { capture: true });
      window.removeEventListener("keydown", onKey, { capture: true });
      window.removeEventListener("beforeunload", onBeforeUnload);
      // stop camera
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      // remove preview
      const v = document.getElementById("proctor-preview");
      if (v?.parentNode) v.parentNode.removeChild(v);
    };
  }, [enabled, modelPath, socketRef]);

  return status; // { camera: 'ok'|'error'|..., faces, fullscreen }
}
