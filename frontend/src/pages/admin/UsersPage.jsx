import { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Users, KeyRound, Trash2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ username: "", name: "", password: "" });
  const [resetUser, setResetUser] = useState(null);
  const [newPass, setNewPass] = useState("");
  const [delUser, setDelUser] = useState(null);

  const load = () => api.get("/users").then((r) => setUsers(r.data)).catch((e) => toast.error(apiError(e)));
  useEffect(() => { load(); }, []);

  const create = async () => {
    try {
      await api.post("/users", { ...form, role: "employee" });
      toast.success("Karyawan dibuat");
      setOpen(false); setForm({ username: "", name: "", password: "" });
      load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const doReset = async () => {
    try {
      await api.put(`/users/${resetUser.id}`, { password: newPass });
      toast.success("Password direset");
      setResetUser(null); setNewPass("");
    } catch (e) { toast.error(apiError(e)); }
  };

  const remove = async () => {
    try { await api.delete(`/users/${delUser.id}`); toast.success("Karyawan dihapus"); setDelUser(null); load(); }
    catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div className="space-y-6" data-testid="users-page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-slate-900">Kelola Karyawan</h1>
          <p className="mt-1 text-sm text-slate-500">Buat akun, reset password, atau hapus akun karyawan.</p>
        </div>
        <Button onClick={() => setOpen(true)} data-testid="btn-add-user" className="gap-2 bg-indigo-600 hover:bg-indigo-700">
          <Plus className="h-4 w-4" /> Tambah Karyawan
        </Button>
      </div>

      <Card className="overflow-hidden border-slate-200">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>Nama</TableHead><TableHead>Username</TableHead>
              <TableHead>Role</TableHead><TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id} data-testid={`user-row-${u.username}`}>
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell className="font-mono text-xs">{u.username}</TableCell>
                <TableCell>
                  <Badge className={u.role === "admin" ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-100" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"}>
                    {u.role === "admin" ? "Admin" : "Karyawan"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" className="gap-1 text-xs" onClick={() => setResetUser(u)} data-testid={`reset-pass-${u.username}`}>
                      <KeyRound className="h-3.5 w-3.5" /> Reset
                    </Button>
                    {u.role !== "admin" && (
                      <Button size="icon" variant="ghost" onClick={() => setDelUser(u)} data-testid={`delete-user-${u.username}`}>
                        <Trash2 className="h-4 w-4 text-rose-500" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {users.length === 0 && (
              <TableRow><TableCell colSpan={4} className="py-10 text-center text-slate-400">
                <Users className="mx-auto mb-2 h-8 w-8" />Belum ada pengguna
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Card className="border-slate-200 p-6" data-testid="users-change-password-card">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <p className="font-heading font-bold text-slate-900">Ubah Password Saya</p>
            <p className="text-xs text-slate-500">Ganti password akun admin Anda sendiri.</p>
          </div>
        </div>
        <div className="max-w-md">
          <ChangePasswordForm />
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="user-form-dialog">
          <DialogHeader><DialogTitle>Tambah Karyawan</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Nama Lengkap</Label>
              <Input data-testid="user-name-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Username</Label>
              <Input data-testid="user-username-input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Password</Label>
              <Input type="password" data-testid="user-password-input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={create} data-testid="save-user-btn" className="bg-indigo-600 hover:bg-indigo-700">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetUser} onOpenChange={(o) => !o && setResetUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reset Password — {resetUser?.name}</DialogTitle></DialogHeader>
          <div className="space-y-1.5"><Label>Password Baru</Label>
            <Input type="password" data-testid="reset-password-input" value={newPass} onChange={(e) => setNewPass(e.target.value)} /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetUser(null)}>Batal</Button>
            <Button onClick={doReset} data-testid="confirm-reset-btn" className="bg-indigo-600 hover:bg-indigo-700">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delUser} onOpenChange={(o) => !o && setDelUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus karyawan?</AlertDialogTitle>
            <AlertDialogDescription>"{delUser?.name}" dan semua penugasannya akan dihapus.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={remove} data-testid="confirm-delete-user" className="bg-rose-600 hover:bg-rose-700">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
