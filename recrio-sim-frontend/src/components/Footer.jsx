// src/components/Footer.jsx
export default function Footer() {
  return (
    <div style={{ padding: 8, fontSize: 12, color: "#666", borderTop: "1px solid #ddd" }}>
      © {new Date().getFullYear()} Recrio
    </div>
  );
}
