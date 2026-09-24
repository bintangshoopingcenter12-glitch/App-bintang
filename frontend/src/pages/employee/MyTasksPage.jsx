import { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  ClipboardCheck, CheckCircle2, Clock, MapPin, Tag, Lock, ScanLine, Barcode, Search,
} from "lucide-react";
import { toast } from "sonner";

export default function MyTasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [active, setActive] = useState(null);
  const [stok, setStok] = useState("");
  const [catatan, setCatatan] = useState("");
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");

  const load = () => api.get("/my-tasks").then((r) => setTasks(r.data)).catch((e) => toast.error(apiError(e)));
  useEffect(() => { load(); }, []);

  const openCheck = (t) => {
    setActive(t);
    setStok(t.stok_fisik != null ? String(t.stok_fisik) : "");
    setCatatan(t.catatan || "");
  };

  const submit = async () => {
    if (stok === "" || parseInt(stok) < 0) { toast.error("Masukkan stok fisik yang valid"); return; }
    setSaving(true);
    try {
      await api.post(`/my-tasks/${active.id}/check`, { stok_fisik: parseInt(stok), catatan });
      toast.success("Hasil cek tersimpan");
      setActive(null);
      load();
    } catch (e) { toast.error(apiError(e)); }
    finally { setSaving(false); }
  };

  const done = tasks.filter((t) => t.status === "dicek").length;
  const pending = tasks.length - done;
  const filtered = tasks.filter((t) =>
    [t.nama, t.kode, t.barcode].some((v) => (v || "").toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <div className="space-y-6" data-testid="my-tasks-page">
      <div>
        <h1 className="font-heading text-2xl font-bold text-slate-900" data-testid="my-tasks-title">
          Stock Check - {user?.name}
        </h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
          <Lock className="h-3.5 w-3.5" /> Blind count — jumlah stok sistem sengaja disembunyikan.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="border-slate-200"><CardContent className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600"><ClipboardCheck className="h-5 w-5" /></div>
          <div><p className="text-xl font-bold">{tasks.length}</p><p className="text-xs text-slate-500">Total Tugas</p></div>
        </CardContent></Card>
        <Card className="border-slate-200"><CardContent className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><CheckCircle2 className="h-5 w-5" /></div>
          <div><p className="text-xl font-bold">{done}</p><p className="text-xs text-slate-500">Sudah Dicek</p></div>
        </CardContent></Card>
        <Card className="border-slate-200"><CardContent className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600"><Clock className="h-5 w-5" /></div>
          <div><p className="text-xl font-bold">{pending}</p><p className="text-xs text-slate-500">Belum Dicek</p></div>
        </CardContent></Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input data-testid="my-tasks-search" className="pl-9" placeholder="Cari / scan barcode, kode, atau nama..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((t) => (
          <Card key={t.id} data-testid={`task-card-${t.kode}`} className="group border-slate-200 transition-shadow hover:shadow-md">
            <CardContent className="space-y-3 p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-[11px] text-slate-400">{t.kode}</p>
                  <p className="font-heading font-semibold leading-tight text-slate-900">{t.nama}</p>
                </div>
                {t.status === "dicek"
                  ? <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Dicek</Badge>
                  : <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Belum</Badge>}
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1 font-mono"><Barcode className="h-3.5 w-3.5" />{t.barcode || "-"}</span>
                <span className="flex items-center gap-1"><Tag className="h-3.5 w-3.5" />{t.kategori || "-"}</span>
                <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{t.lokasi_rak || "-"}</span>
              </div>
              {t.status === "dicek" && (
                <div className="rounded-lg bg-slate-50 p-2 text-xs">
                  <span className="text-slate-500">Stok fisik tercatat: </span>
                  <span className="font-semibold text-slate-900">{t.stok_fisik}</span>
                </div>
              )}
              <Button
                onClick={() => openCheck(t)}
                data-testid={`employee-save-stock-btn-${t.kode}`}
                variant={t.status === "dicek" ? "outline" : "default"}
                className={`w-full gap-2 ${t.status !== "dicek" ? "bg-indigo-600 hover:bg-indigo-700" : ""}`}
              >
                <ScanLine className="h-4 w-4" /> {t.status === "dicek" ? "Ubah Hasil" : "Input Cek Fisik"}
              </Button>
            </CardContent>
          </Card>
        ))}
        {tasks.length === 0 && (
          <div className="col-span-full py-16 text-center text-slate-400">
            <ClipboardCheck className="mx-auto mb-2 h-10 w-10" />Belum ada tugas cek stok untuk Anda.
          </div>
        )}
        {tasks.length > 0 && filtered.length === 0 && (
          <div className="col-span-full py-16 text-center text-slate-400">
            <Search className="mx-auto mb-2 h-10 w-10" />Tidak ada tugas yang cocok dengan pencarian.
          </div>
        )}
      </div>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent data-testid="check-dialog">
          <DialogHeader>
            <DialogTitle>{active?.nama}</DialogTitle>
            <DialogDescription className="font-mono text-xs">
              {active?.kode} · Rak {active?.lokasi_rak || "-"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-500">
              <Lock className="h-4 w-4" /> Stok sistem tidak ditampilkan (blind count).
            </div>
            <div className="space-y-1.5">
              <Label>Stok Fisik (Jumlah Aktual)</Label>
              <Input type="number" min="0" data-testid={`employee-physical-stock-input-${active?.kode}`}
                     value={stok} onChange={(e) => setStok(e.target.value)} placeholder="Masukkan hasil hitung fisik" />
            </div>
            <div className="space-y-1.5">
              <Label>Catatan / Keterangan (opsional)</Label>
              <Textarea data-testid="employee-notes-input" value={catatan}
                        onChange={(e) => setCatatan(e.target.value)} placeholder="mis. 2 unit rusak, salah rak..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActive(null)}>Batal</Button>
            <Button onClick={submit} disabled={saving} data-testid="submit-check-btn" className="bg-indigo-600 hover:bg-indigo-700">
              Simpan Hasil Cek
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
