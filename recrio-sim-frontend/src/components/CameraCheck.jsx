// src/components/CameraCheck.jsx
import React, { useEffect, useRef, useState } from "react";

export default function CameraCheck() {
  const videoRef = useRef(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let stream;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 640, height: 480 },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (e) {
        console.error("Camera error:", e);
        setErr("⚠️ Camera not available. Allow permissions.");
      }
    })();
    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        bottom: "16px",
        left: "16px",
        width: "260px",   // 👈 adjust size here
        height: "200px",
        borderRadius: "12px",
        overflow: "hidden",
        background: "#000",
        zIndex: 100,
        boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
      }}
    >
      {err ? (
        <div
          style={{
            color: "#fff",
            fontSize: "14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            padding: "8px",
            textAlign: "center",
          }}
        >
          {err}
        </div>
      ) : (
        <video
          ref={videoRef}
          playsInline
          muted
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      )}
    </div>
  );
}




