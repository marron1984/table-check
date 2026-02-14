import { useState, useCallback } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { TodayReservations } from "./pages/TodayReservations";
import { ReservationDetail } from "./pages/ReservationDetail";
import { CustomerSearch } from "./pages/CustomerSearch";
import { CustomerDetail } from "./pages/CustomerDetail";
import { DuplicateQueue } from "./pages/DuplicateQueue";
import { TagManagement } from "./pages/TagManagement";
import { SyncStatus } from "./pages/SyncStatus";

export function App() {
  const [loggedIn, setLoggedIn] = useState(() => !!localStorage.getItem("staffId"));
  const [staffName, setStaffName] = useState(() => localStorage.getItem("staffName") || "");

  const handleLogin = useCallback((staffId: string, name: string) => {
    localStorage.setItem("staffId", staffId);
    localStorage.setItem("staffName", name);
    setStaffName(name);
    setLoggedIn(true);
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem("staffId");
    localStorage.removeItem("staffName");
    setLoggedIn(false);
    setStaffName("");
  }, []);

  if (!loggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <Routes>
      <Route element={<Layout staffName={staffName} onLogout={handleLogout} />}>
        <Route path="/" element={<Navigate to="/reservations/today" replace />} />
        <Route path="/reservations/today" element={<TodayReservations />} />
        <Route path="/reservations/:id" element={<ReservationDetail />} />
        <Route path="/customers" element={<CustomerSearch />} />
        <Route path="/customers/:id" element={<CustomerDetail />} />
        <Route path="/duplicates" element={<DuplicateQueue />} />
        <Route path="/tags" element={<TagManagement />} />
        <Route path="/sync" element={<SyncStatus />} />
      </Route>
    </Routes>
  );
}
