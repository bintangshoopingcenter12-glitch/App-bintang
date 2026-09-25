import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { UserCog, ShieldCheck } from "lucide-react";

export default function ProfilePage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6" data-testid="profile-page">
      <div>
        <h1 className="font-heading text-2xl font-bold text-slate-900">Profil Saya</h1>
        <p className="mt-1 text-sm text-slate-500">Kelola akun dan ubah password Anda sendiri.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-slate-200 p-6" data-testid="profile-info-card">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100">
              <UserCog className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <p className="font-heading font-bold text-slate-900">{user?.name}</p>
              <p className="font-mono text-xs text-slate-500">{user?.username}</p>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between border-t border-slate-100 py-2">
              <span className="text-slate-500">Role</span>
              <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100">
                {user?.role === "admin" ? "Admin" : "Karyawan"}
              </Badge>
            </div>
            {user?.email && (
              <div className="flex items-center justify-between border-t border-slate-100 py-2">
                <span className="text-slate-500">Email</span>
                <span className="font-medium text-slate-700">{user.email}</span>
              </div>
            )}
          </div>
        </Card>

        <Card className="border-slate-200 p-6" data-testid="profile-change-password-card">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="font-heading font-bold text-slate-900">Ubah Password</p>
              <p className="text-xs text-slate-500">Sesi lain akan otomatis keluar.</p>
            </div>
          </div>
          <ChangePasswordForm />
        </Card>
      </div>
    </div>
  );
}
