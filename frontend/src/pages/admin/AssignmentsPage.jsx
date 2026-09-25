import { useEffect, useState, useCallback } from "react";
import api, { apiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Users, Clock, Plus, Trash2, Layers } from "lucide-react";
import { toast } from "sonner";

const today = () => new Date().toISOString().slice(0, 10);
const statusStyle = {
  pending: "bg-amber-100 text-amber-700",
  progress: "bg-blue-100 text-blue-700",
  done: "bg-emerald-100 text-emerald-700",
};
const statusLabel = { pending: "Pending", progress: "Progress", done: "Selesai" };

function ProgressBar({ value }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${value}%` }} />
    </div>
  );
}

export default function AssignmentsPage() {
  const [rows, setRows] = useState([]);
  const [locations, setLocations] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [zonas, setZonas] = useState([]);
  const [f, setF] = useState({ tanggal: today(), shift: "all", zona: "all", status: "all" });
  const [form, setForm] = useState({ user_id: "", kode_rak: "", shift: "pagi", jenis_tugas: "cek_stok" });

  const load = useCallback(() => {
    api.get("/assignments", { params: f }).then((r) => setRows(r.data)).catch((e) => toast.error(apiError(e)));
  }, [f]);

  useEffect(() => {
    api.get("/locations").then((r) => setLocations(r.data)).catch(() => {});
    api.get("/locations/zonas").then((r) => setZonas(r.data)).catch(() => {});
    api.get("/users").then((r) => setEmployees(r.data.filter((u) => u.role === "employee"))).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!form.user_id || !form.kode_rak) { toast.error("Pilih karyawan & rak"); return; }
    try {
      await api.post("/assignments", { ...form, tanggal: f.tanggal });
      toast.success("Rak ditugaskan — semua barang di rak otomatis jadi tugas karyawan");
      setForm({ user_id: "", kode_rak: "", shift: "pagi", jenis_tugas: "cek_stok" });
      load();
    } catch (e) { toast.error(apiError(e)); }
  };
  const remove = async (id) => {
    try { await api.delete(`/assignments/${id}`); toast.success("Dihapus"); load(); }
    catch (e) { toast.error(apiError(e)); }
  };

  // groupings
  const byRak = Object.values(rows.reduce((m, r) => { (m[r.kode_rak] ||= { ...r, list: [] }).list.push(r); return m; }, {}));
  const byEmp = Object.values(rows.reduce((m, r) => {
    m[r.user_id] ||= { employee_name: r.employee_name, list: [] };
    m[r.user_id].list.push(r); return m;
  }, {}));
  const byShift = ["pagi", "siang", "malam"].map((s) => ({ shift: s, list: rows.filter((r) => r.shift === s) }));

  return (
    <div className="space-y-6" data-testid="assignments-page">
      <div>
        <h1 className="font-heading text-2xl font-bold text-slate-900">Penugasan per Rak</h1>
        <p className="mt-1 text-sm text-slate-500">Tugaskan 1 rak ke karyawan — semua barang di rak itu otomatis jadi tugasnya (tanpa assign satu-satu).</p>
      </div>

      {/* Create */}
      <Card className="border-slate-200 p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[180px] flex-1 space-y-1.5">
            <label className="text-xs font-medium text-slate-600">Karyawan</label>
            <Select value={form.user_id} onValueChange={(v) => setForm({ ...form, user_id: v })}>
              <SelectTrigger data-testid="assign-employee-select"><SelectValue placeholder="Pilih karyawan" /></SelectTrigger>
              <SelectContent>{employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="min-w-[140px] flex-1 space-y-1.5">
            <label className="text-xs font-medium text-slate-600">Rak</label>
            <Select value={form.kode_rak} onValueChange={(v) => setForm({ ...form, kode_rak: v })}>
              <SelectTrigger data-testid="assign-rak-select"><SelectValue placeholder="Pilih rak" /></SelectTrigger>
              <SelectContent>{locations.map((l) => <SelectItem key={l.id} value={l.kode_rak}>{l.kode_rak} · {l.product_count} brg</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="min-w-[120px] space-y-1.5">
            <label className="text-xs font-medium text-slate-600">Shift</label>
            <Select value={form.shift} onValueChange={(v) => setForm({ ...form, shift: v })}>
              <SelectTrigger data-testid="assign-shift-select"><SelectValue /></SelectTrigger>
              <SelectContent>{["pagi", "siang", "malam"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="min-w-[130px] space-y-1.5">
            <label className="text-xs font-medium text-slate-600">Jenis</label>
            <Select value={form.jenis_tugas} onValueChange={(v) => setForm({ ...form, jenis_tugas: v })}>
              <SelectTrigger data-testid="assign-jenis-select"><SelectValue /></SelectTrigger>
              <SelectContent>{["cek_stok", "opname", "restock", "kebersihan"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button onClick={create} data-testid="assign-submit-btn" className="gap-2 bg-indigo-600 hover:bg-indigo-700"><Plus className="h-4 w-4" /> Tugaskan Rak</Button>
        </div>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Input type="date" value={f.tanggal} onChange={(e) => setF({ ...f, tanggal: e.target.value })} className="w-40" data-testid="filter-tanggal" />
        <Select value={f.shift} onValueChange={(v) => setF({ ...f, shift: v })}><SelectTrigger className="w-32" data-testid="filter-shift"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Semua Shift</SelectItem>{["pagi", "siang", "malam"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
        <Select value={f.zona} onValueChange={(v) => setF({ ...f, zona: v })}><SelectTrigger className="w-32" data-testid="filter-zona"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Semua Zona</SelectItem>{zonas.map((z) => <SelectItem key={z} value={z}>Zona {z}</SelectItem>)}</SelectContent></Select>
        <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}><SelectTrigger className="w-36" data-testid="filter-status"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Semua Status</SelectItem>{["pending", "progress", "done"].map((s) => <SelectItem key={s} value={s}>{statusLabel[s]}</SelectItem>)}</SelectContent></Select>
      </div>

      <Tabs defaultValue="rak">
        <TabsList className="bg-slate-100">
          <TabsTrigger value="rak" data-testid="tab-per-rak"><MapPin className="mr-1.5 h-4 w-4" />Per Rak</TabsTrigger>
          <TabsTrigger value="karyawan" data-testid="tab-per-karyawan"><Users className="mr-1.5 h-4 w-4" />Per Karyawan</TabsTrigger>
          <TabsTrigger value="shift" data-testid="tab-per-shift"><Clock className="mr-1.5 h-4 w-4" />Per Shift</TabsTrigger>
        </TabsList>

        <TabsContent value="rak" className="mt-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {byRak.map((r) => (
              <Card key={r.id} data-testid={`rak-card-${r.kode_rak}`} className="border-slate-200 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-heading text-lg font-bold text-slate-900">{r.kode_rak}</p>
                    <p className="text-xs text-slate-500">{r.nama_rak} · Zona {r.zona}</p>
                  </div>
                  <Badge className={`${statusStyle[r.status]} hover:${statusStyle[r.status]}`}>{statusLabel[r.status]}</Badge>
                </div>
                <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-600"><Users className="h-3.5 w-3.5" />{r.employee_name}</p>
                <p className="mt-1 text-xs text-slate-500">{r.done_count}/{r.product_count} barang selesai · {r.jenis_tugas}</p>
                <div className="mt-2"><ProgressBar value={r.progress} /></div>
                <div className="mt-3 flex justify-end">
                  <Button size="sm" variant="ghost" onClick={() => remove(r.id)} data-testid={`del-assign-${r.id}`}><Trash2 className="h-4 w-4 text-rose-500" /></Button>
                </div>
              </Card>
            ))}
            {byRak.length === 0 && <p className="col-span-full py-10 text-center text-slate-400">Belum ada penugasan</p>}
          </div>
        </TabsContent>

        <TabsContent value="karyawan" className="mt-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {byEmp.map((e) => {
              const avg = Math.round(e.list.reduce((s, x) => s + x.progress, 0) / e.list.length);
              return (
                <Card key={e.employee_name} data-testid={`emp-card-${e.employee_name}`} className="border-slate-200 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-100 font-bold text-indigo-700">{e.employee_name[0]}</div>
                    <div><p className="font-semibold text-slate-900">{e.employee_name}</p><p className="text-xs text-slate-500">Shift {e.list[0].shift} · {e.list.length} rak</p></div>
                  </div>
                  <div className="mt-3"><ProgressBar value={avg} /></div>
                  <p className="mt-1 text-xs text-slate-500">Progress keseluruhan {avg}%</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">{e.list.map((x) => <span key={x.id} className={`rounded px-2 py-0.5 text-[11px] ${statusStyle[x.status]}`}>{x.kode_rak}</span>)}</div>
                </Card>
              );
            })}
            {byEmp.length === 0 && <p className="col-span-full py-10 text-center text-slate-400">Belum ada penugasan</p>}
          </div>
        </TabsContent>

        <TabsContent value="shift" className="mt-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {byShift.map((s) => (
              <Card key={s.shift} data-testid={`shift-card-${s.shift}`} className="border-slate-200 p-4">
                <h3 className="font-heading font-semibold capitalize text-slate-900"><Layers className="mr-1.5 inline h-4 w-4" />{s.shift}</h3>
                <div className="mt-3 space-y-2">
                  {s.list.map((x) => (
                    <div key={x.id} className="flex items-center justify-between rounded-lg bg-slate-50 p-2 text-sm">
                      <span>{x.kode_rak} · {x.employee_name}</span>
                      <Badge className={`${statusStyle[x.status]} hover:${statusStyle[x.status]}`}>{x.progress}%</Badge>
                    </div>
                  ))}
                  {s.list.length === 0 && <p className="text-xs text-slate-400">Tidak ada tugas</p>}
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
