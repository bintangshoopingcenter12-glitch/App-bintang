import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";

import LoginPage from "@/pages/LoginPage";
import AppLayout from "@/components/AppLayout";
import DashboardPage from "@/pages/admin/DashboardPage";
import MasterBarangPage from "@/pages/admin/MasterBarangPage";
import CariBarangPage from "@/pages/admin/CariBarangPage";
import BarangMasukPage from "@/pages/admin/BarangMasukPage";
import SalesPage from "@/pages/admin/SalesPage";
import PenugasanPage from "@/pages/admin/PenugasanPage";
import UsersPage from "@/pages/admin/UsersPage";
import ProfilePage from "@/pages/admin/ProfilePage";
import SummaryPage from "@/pages/admin/SummaryPage";
import MyTasksPage from "@/pages/employee/MyTasksPage";
import MyRacksPage from "@/pages/employee/MyRacksPage";
import AssignmentsPage from "@/pages/admin/AssignmentsPage";
import NotFoundPage from "@/pages/NotFoundPage";

function FullLoader() {
  return (
    <div className="flex h-screen items-center justify-center bg-slate-50">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
    </div>
  );
}

function Protected({ children, role }) {
  const { user } = useAuth();
  if (user === null) return <FullLoader />;
  if (user === false) return <Navigate to="/login" replace />;
  if (role && user.role !== role) {
    return <Navigate to={user.role === "admin" ? "/admin/dashboard" : "/employee/my-racks"} replace />;
  }
  return children;
}

function RootRedirect() {
  const { user } = useAuth();
  if (user === null) return <FullLoader />;
  if (user === false) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === "admin" ? "/admin/dashboard" : "/employee/my-racks"} replace />;
}

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <Toaster position="top-right" richColors />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<RootRedirect />} />

            <Route
              element={
                <Protected role="admin">
                  <AppLayout />
                </Protected>
              }
            >
              <Route path="/admin/dashboard" element={<DashboardPage />} />
              <Route path="/admin/master-barang" element={<MasterBarangPage />} />
              <Route path="/admin/cari-barang" element={<CariBarangPage />} />
              <Route path="/admin/barang-masuk" element={<BarangMasukPage />} />
              <Route path="/admin/penjualan" element={<SalesPage />} />
              <Route path="/admin/penugasan" element={<PenugasanPage />} />
              <Route path="/admin/assignments" element={<AssignmentsPage />} />
              <Route path="/admin/karyawan" element={<UsersPage />} />
              <Route path="/admin/profil" element={<ProfilePage />} />
              <Route path="/admin/summary" element={<SummaryPage />} />
            </Route>

            <Route
              element={
                <Protected role="employee">
                  <AppLayout />
                </Protected>
              }
            >
              <Route path="/employee/my-tasks" element={<MyTasksPage />} />
              <Route path="/employee/my-racks" element={<MyRacksPage />} />
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}

export default App;
