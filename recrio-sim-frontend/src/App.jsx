// App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
// ⬇️ Removed Navbar & Sidebar imports
// import Navbar from "./components/Navbar.jsx";
// import Sidebar from "./components/Sidebar.jsx";
import Footer from "./components/Footer.jsx";

import Home from "./pages/Home.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import SimulationRunner from "./SimulationRunner.jsx"; // ← keep

function AppShell({ children }) {
  // Simplified shell: no sidebar, no top nav
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <main style={{ flex: 1, padding: 0 }}>{children}</main>
      <footer style={{ background: "#fafafa", borderTop: "1px solid #eee" }}>
        <Footer />
      </footer>
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
          <Route path="/simulate" element={<SimulationRunner />} /> {/* ← keep */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
