import { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MapPin, ChevronDown, ChevronRight, CheckCircle2, Circle, Lock, Search } from "lucide-react";
import { CameraScanButton } from "@/components/CameraScanner";
import { toast } from "sonner";

const statusStyle = { pending: "bg-amber-100 text-amber-700", progress: "bg-blue-100 text-blue-700", done: "bg-emerald-100 text-emerald-700" };
const statusLabel = { pending: "Pending", progress: "Progress", done: "Selesai" };

function ProgressBar({ value }) {
  return <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${value}%` }} /></div>;
}

function RackCard({ rack, onChanged }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [q, setQ] = useState("");

  const loadProducts = () => api.get(`/my-assignments/${rack.id}/products`).then((r) => setData(r.data)).catch((e) => toast.error(apiError(e)));
  const toggle = () => { const n = !open; setOpen(n); if (n && !data) loadProducts(); };

  const markDone = async (pid) => {
    try {
      await api.post(`/my-assignments/${rack.id}/done`, { product_id: pid });
      await loadProducts();
      onChanged();
    } catch (e) { toast.error(apiError(e)); }
  };

  const handleScan = (code) => {
    const c = (code || "").trim().toLowerCase();
    const items = data?.items || [];
    const it = items.find((x) => (x.barcode || "").toLowerCase() === c || (x.kode || "").toLowerCase() === c);
    if (!it) { toast.error(`Barang ini bukan tugas Anda (tidak ada di Rak ${rack.kode_rak})`); return; }
    if (it.done) { toast.info("Sudah ditandai selesai"); return; }
    markDone(it.id);
  };

  const items = (data?.items || []).filter((x) => [x.nama, x.kode, x.barcode].some((v) => (v || "").toLowerCase().includes(q.toLowerCase())));

  return (
    <Card className="overflow-hidden border-slate-200" data-testid={`myrack-card-${rack.kode_rak}`}>
      <button className="flex w-full items-center justify-between p-4 text-left" onClick={toggle} data-testid={`myrack-toggle-${rack.kode_rak}`}>
        <div className="flex items-center gap-3">
          {open ? <ChevronDown className="h-5 w-5 text-slate-400" /> : <ChevronRight className="h-5 w-5 text-slate-400" />}
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700"><MapPin className="h-5 w-5" /></div>
          <div>
            <p className="font-heading text-lg font-bold text-slate-900">Rak {rack.kode_rak}</p>
            <p className="text-xs text-slate-500">Zona {rack.zona} · {rack.jenis_tugas} · {rack.done_count}/{rack.product_count} selesai</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden w-28 sm:block"><ProgressBar value={rack.progress} /></div>
          <Badge className={`${statusStyle[rack.status]} hover:${statusStyle[rack.status]}`}>{statusLabel[rack.status]}</Badge>
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-100 p-4">
          <div className="mb-3 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input className="pl-9" placeholder="Cari / ketik barcode di rak ini..." value={q} onChange={(e) => setQ(e.target.value)} data-testid={`myrack-search-${rack.kode_rak}`}
                     onKeyDown={(e) => { if (e.key === "Enter") { handleScan(q); setQ(""); } }} />
            </div>
            <CameraScanButton testid={`myrack-camera-${rack.kode_rak}`} label="" onScan={handleScan} />
          </div>
          <p className="mb-2 flex items-center gap-1.5 text-xs text-slate-400"><Lock className="h-3 w-3" />Stok sistem disembunyikan (blind count)</p>
          <div className="max-h-80 space-y-2 overflow-auto">
            {items.map((it) => (
              <div key={it.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-2.5" data-testid={`myrack-item-${it.kode}`}>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{it.nama}</p>
                  <p className="font-mono text-[11px] text-slate-400">{it.kode} · {it.barcode}</p>
                </div>
                <Button size="sm" variant={it.done ? "outline" : "default"} disabled={it.done} onClick={() => markDone(it.id)}
                        data-testid={`myrack-done-${it.kode}`} className={`gap-1.5 ${it.done ? "" : "bg-emerald-600 hover:bg-emerald-700"}`}>
                  {it.done ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Circle className="h-4 w-4" />}{it.done ? "Selesai" : "Tandai"}
                </Button>
              </div>
            ))}
            {items.length === 0 && <p className="py-6 text-center text-sm text-slate-400">Tidak ada barang</p>}
          </div>
        </div>
      )}
    </Card>
  );
}

export default function MyRacksPage() {
  const { user } = useAuth();
  const [racks, setRacks] = useState([]);
  const load = () => api.get("/my-assignments").then((r) => setRacks(r.data)).catch((e) => toast.error(apiError(e)));
  useEffect(() => { load(); }, []);

  const done = racks.filter((r) => r.status === "done").length;

  return (
    <div className="space-y-6" data-testid="my-racks-page">
      <div>
        <h1 className="font-heading text-2xl font-bold text-slate-900">Tugas Rak Saya — {user?.name}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {racks.length ? `Tugas Anda hari ini: ${racks.map((r) => r.kode_rak).join(", ")}` : "Belum ada rak yang ditugaskan."}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-slate-200 p-4"><p className="text-xl font-bold">{racks.length}</p><p className="text-xs text-slate-500">Rak Ditugaskan</p></Card>
        <Card className="border-slate-200 p-4"><p className="text-xl font-bold text-emerald-600">{done}</p><p className="text-xs text-slate-500">Rak Selesai</p></Card>
        <Card className="border-slate-200 p-4"><p className="text-xl font-bold text-amber-600">{racks.length - done}</p><p className="text-xs text-slate-500">Belum Selesai</p></Card>
      </div>
      <div className="space-y-3">
        {racks.map((r) => <RackCard key={r.id} rack={r} onChanged={load} />)}
      </div>
    </div>
  );
}
