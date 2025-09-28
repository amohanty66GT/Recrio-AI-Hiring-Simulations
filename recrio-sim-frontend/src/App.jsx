import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import Sidebar from "./components/Sidebar.jsx";
import Footer from "./components/Footer.jsx";

import Home from "./pages/Home.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import SimulationRunner from "./SimulationRunner.jsx"; // ← NEW

function AppShell({ children }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", minHeight: "100vh" }}>
      <aside style={{ borderRight: "1px solid #eee", background: "#fafafa" }}>
        <Sidebar />
      </aside>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <header style={{ background: "#fff", borderBottom: "1px solid #eee" }}>
          <Navbar />
        </header>
        <main style={{ padding: 0, flex: 1 }}>{children}</main>
        <footer style={{ background: "#fafafa", borderTop: "1px solid #eee" }}>
          <Footer />
        </footer>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/simulate" element={<SimulationRunner />} /> {/* ← NEW */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
