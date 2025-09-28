// src/components/Navbar.jsx
import { Link } from "react-router-dom";
export default function Navbar() {
  return (
    <nav style={{ display: "flex", gap: 12, padding: 12, borderBottom: "1px solid #ddd" }}>
      <strong>Recrio</strong>
      <Link to="/">Home</Link>
      <Link to="/dashboard">Dashboard</Link>
    </nav>
  );
}
