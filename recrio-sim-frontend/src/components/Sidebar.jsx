// src/components/Sidebar.jsx
import { NavLink } from "react-router-dom";
const item = ({ isActive }) => ({
  display: "block",
  padding: "8px 12px",
  margin: "4px 8px",
  borderRadius: 8,
  textDecoration: "none",
  color: isActive ? "#111" : "#3b82f6",
  background: isActive ? "#e5e7eb" : "transparent",
  fontWeight: isActive ? 700 : 500
});
export default function Sidebar() {
  return (
    <aside style={{ padding: 8 }}>
      <NavLink to="/" style={item}>Home</NavLink>
      <NavLink to="/dashboard" style={item}>Dashboard</NavLink>
      <NavLink to="/simulate" style={item}>Simulation</NavLink> {/* NEW */}
    </aside>
  );
}
