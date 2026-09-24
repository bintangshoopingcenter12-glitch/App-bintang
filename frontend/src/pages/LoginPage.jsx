import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, apiError } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Boxes, Loader2, User, Lock } from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) {
    navigate(user.role === "admin" ? "/admin/dashboard" : "/employee/my-tasks", { replace: true });
  }

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const u = await login(username.trim(), password);
      toast.success(`Selamat datang, ${u.name}`);
      navigate(u.role === "admin" ? "/admin/dashboard" : "/employee/my-tasks", { replace: true });
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left brand panel */}
      <div className="relative hidden w-1/2 flex-col justify-between bg-slate-900 p-12 text-white lg:flex">
        <div
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1586528116022-aeda1613c63d?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600">
            <Boxes className="h-6 w-6" />
          </div>
          <span className="font-heading text-xl font-bold">StokOpname</span>
        </div>
        <div className="relative space-y-4">
          <h1 className="font-heading text-4xl font-extrabold leading-tight">
            Sistem Manajemen Stok & Cek Fisik Gudang
          </h1>
          <p className="max-w-md text-slate-300">
            Blind stock count, penugasan karyawan, dan rangkuman cek stok dalam satu tempat.
          </p>
        </div>
        <p className="relative text-xs text-slate-400">© 2026 StokOpname · Warehouse Inventory Control</p>
      </div>

      {/* Right form */}
      <div className="flex w-full items-center justify-center bg-slate-50 p-6 lg:w-1/2">
        <div className="w-full max-w-sm animate-fade-up">
          <div className="mb-8 text-center lg:text-left">
            <h2 className="font-heading text-2xl font-bold text-slate-900">Login Sistem</h2>
            <p className="mt-1 text-sm text-slate-500">Masuk menggunakan akun Admin atau Karyawan</p>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="username"
                  data-testid="login-username-input"
                  className="pl-9"
                  placeholder="mis. admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="password"
                  type="password"
                  data-testid="login-password-input"
                  className="pl-9"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>
            <Button
              type="submit"
              data-testid="login-submit-button"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Masuk"}
            </Button>
          </form>
          <div className="mt-6 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600">
            <p className="mb-1 font-semibold text-slate-700">Akun demo:</p>
            <p>Admin: <code className="font-mono">admin</code> / <code className="font-mono">admin123</code></p>
            <p>Karyawan: <code className="font-mono">budi</code>, <code className="font-mono">dedi</code>, <code className="font-mono">siti</code> / <code className="font-mono">user123</code></p>
          </div>
        </div>
      </div>
    </div>
  );
}
