import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { TodayReservations } from "./pages/TodayReservations";
import { ReservationDetail } from "./pages/ReservationDetail";
import { CustomerSearch } from "./pages/CustomerSearch";
import { CustomerDetail } from "./pages/CustomerDetail";
import { DuplicateQueue } from "./pages/DuplicateQueue";
import { TagManagement } from "./pages/TagManagement";

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/reservations/today" replace />} />
        <Route path="/reservations/today" element={<TodayReservations />} />
        <Route path="/reservations/:id" element={<ReservationDetail />} />
        <Route path="/customers" element={<CustomerSearch />} />
        <Route path="/customers/:id" element={<CustomerDetail />} />
        <Route path="/duplicates" element={<DuplicateQueue />} />
        <Route path="/tags" element={<TagManagement />} />
      </Route>
    </Routes>
  );
}
