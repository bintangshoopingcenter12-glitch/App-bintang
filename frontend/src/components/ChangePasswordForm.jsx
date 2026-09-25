import { useState } from "react";
import api, { apiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const ChangePasswordForm = () => {
  const [form, setForm] = useState({ current_password: "", new_password: "", confirm: "" });
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (form.new_password.length < 6) {
      toast.error("Password baru minimal 6 karakter");
      return;
    }
    if (form.new_password !== form.confirm) {
      toast.error("Konfirmasi password tidak cocok");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/change-password", {
        current_password: form.current_password,
        new_password: form.new_password,
      });
      toast.success("Password berhasil diubah");
      setForm({ current_password: "", new_password: "", confirm: "" });
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" data-testid="change-password-form">
      <div className="space-y-1.5">
        <Label>Password Saat Ini</Label>
        <Input
          type="password"
          autoComplete="current-password"
          data-testid="current-password-input"
          value={form.current_password}
          onChange={(e) => setForm({ ...form, current_password: e.target.value })}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label>Password Baru</Label>
        <Input
          type="password"
          autoComplete="new-password"
          data-testid="new-password-input"
          value={form.new_password}
          onChange={(e) => setForm({ ...form, new_password: e.target.value })}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label>Konfirmasi Password Baru</Label>
        <Input
          type="password"
          autoComplete="new-password"
          data-testid="confirm-password-input"
          value={form.confirm}
          onChange={(e) => setForm({ ...form, confirm: e.target.value })}
          required
        />
      </div>
      <Button
        type="submit"
        disabled={loading}
        data-testid="submit-change-password-btn"
        className="gap-2 bg-indigo-600 hover:bg-indigo-700"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
        Ubah Password
      </Button>
    </form>
  );
};
