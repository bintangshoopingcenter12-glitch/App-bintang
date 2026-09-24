import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";

import LoginPage from "@/pages/LoginPage";
import AppLayout from "@/components/AppLayout";
import DashboardPage from "@/pages/admin/DashboardPage";
import MasterBarangPage from "@/pages/admin/MasterBarangPage";
import BarangMasukPage from "@/pages/admin/BarangMasukPage";
import PenugasanPage from "@/pages/admin/PenugasanPage";
import UsersPage from "@/pages/admin/UsersPage";
import SummaryPage from "@/pages/admin/SummaryPage";
import MyTasksPage from "@/pages/employee/MyTasksPage";

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
    return <Navigate to={user.role === "admin" ? "/admin/dashboard" : "/employee/my-tasks"} replace />;
  }
  return children;
}

function RootRedirect() {
  const { user } = useAuth();
  if (user === null) return <FullLoader />;
  if (user === false) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === "admin" ? "/admin/dashboard" : "/employee/my-tasks"} replace />;
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
              <Route path="/admin/barang-masuk" element={<BarangMasukPage />} />
              <Route path="/admin/penugasan" element={<PenugasanPage />} />
              <Route path="/admin/karyawan" element={<UsersPage />} />
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
            </Route>

            <Route path="*" element={<RootRedirect />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}

export default App;
