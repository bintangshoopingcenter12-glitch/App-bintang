import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard, Package, ArrowDownLeft, UserCheck, BarChart3,
  ClipboardCheck, Users, LogOut, Menu, X, Boxes, ShoppingCart, Search, UserCog,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const adminNav = [
  { label: "Dashboard", path: "/admin/dashboard", icon: LayoutDashboard, tid: "nav-dashboard" },
  { label: "Master Data Barang", path: "/admin/master-barang", icon: Package, tid: "nav-master-barang" },
  { label: "Cari Barang", path: "/admin/cari-barang", icon: Search, tid: "nav-cari-barang" },
  { label: "Barang Masuk", path: "/admin/barang-masuk", icon: ArrowDownLeft, tid: "nav-barang-masuk" },
  { label: "Penjualan", path: "/admin/penjualan", icon: ShoppingCart, tid: "nav-penjualan" },
  { label: "Penugasan Rak", path: "/admin/assignments", icon: UserCheck, tid: "nav-assignments" },
  { label: "Kelola Karyawan", path: "/admin/karyawan", icon: Users, tid: "nav-karyawan" },
  { label: "Profil / Password", path: "/admin/profil", icon: UserCog, tid: "nav-profil" },
  { label: "Rangkuman Cek Stok", path: "/admin/summary", icon: BarChart3, tid: "nav-admin-summary-button", primary: true },
];

const employeeNav = [
  { label: "Tugas Rak Saya", path: "/employee/my-racks", icon: ClipboardCheck, tid: "nav-my-racks" },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const nav = user?.role === "admin" ? adminNav : employeeNav;

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform bg-slate-900 text-slate-300 transition-transform duration-300 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        data-testid="app-sidebar"
      >
        <div className="flex h-16 items-center gap-2.5 border-b border-slate-800 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600">
            <Boxes className="h-5 w-5 text-white" />
          </div>
          <div className="leading-tight">
            <p className="font-heading text-sm font-bold text-white">StokOpname</p>
            <p className="text-[11px] text-slate-400">Manajemen Stok</p>
          </div>
        </div>
        <nav className="space-y-1 p-3">
          {nav.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              data-testid={item.tid}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-indigo-600 text-white"
                    : item.primary
                    ? "text-amber-300 hover:bg-slate-800"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`
              }
            >
              <item.icon className="h-[18px] w-[18px]" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {open && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />
      )}

      {/* Main */}
      <div className="flex flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <button className="lg:hidden" onClick={() => setOpen(!open)} data-testid="sidebar-toggle">
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <div>
              <p className="text-xs text-slate-500">Selamat datang,</p>
              <p className="font-heading text-sm font-bold text-slate-900" data-testid="topbar-user-name">
                {user?.name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge
              data-testid="topbar-role-badge"
              className={
                user?.role === "admin"
                  ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-100"
                  : "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
              }
            >
              {user?.role === "admin" ? "Admin" : "Karyawan"}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              data-testid="logout-button"
              className="gap-1.5"
            >
              <LogOut className="h-4 w-4" /> Keluar
            </Button>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
