import { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { UserCheck, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

export default function PenugasanPage() {
  const [tugas, setTugas] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selBarang, setSelBarang] = useState("");
  const [selBarangLabel, setSelBarangLabel] = useState("");
  const [barangQuery, setBarangQuery] = useState("");
  const [barangResults, setBarangResults] = useState([]);
  const [selEmp, setSelEmp] = useState("");
  const [filterEmp, setFilterEmp] = useState("all");

  const load = () => {
    api.get("/penugasan").then((r) => setTugas(r.data)).catch((e) => toast.error(apiError(e)));
  };
  useEffect(() => {
    load();
    api.get("/users").then((r) => setEmployees(r.data.filter((u) => u.role === "employee"))).catch(() => {});
  }, []);

  useEffect(() => {
    if (!barangQuery.trim()) { setBarangResults([]); return; }
    const t = setTimeout(() => {
      api.get("/barang/search", { params: { q: barangQuery, limit: 8 } })
        .then((r) => setBarangResults(r.data.items)).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [barangQuery]);

  const assign = async () => {
    if (!selBarang || !selEmp) { toast.error("Pilih barang dan karyawan"); return; }
    try {
      await api.post("/penugasan", { barang_id: selBarang, employee_id: selEmp });
      toast.success("Barang ditugaskan");
      setSelBarang(""); setSelBarangLabel(""); setBarangQuery(""); setBarangResults([]); setSelEmp("");
      load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const remove = async (id) => {
    try { await api.delete(`/penugasan/${id}`); toast.success("Penugasan dihapus"); load(); }
    catch (e) { toast.error(apiError(e)); }
  };

  const filtered = filterEmp === "all" ? tugas : tugas.filter((t) => t.employee_id === filterEmp);

  return (
    <div className="space-y-6" data-testid="penugasan-page">
      <div>
        <h1 className="font-heading text-2xl font-bold text-slate-900">Penugasan Karyawan</h1>
        <p className="mt-1 text-sm text-slate-500">Assign barang untuk dicek oleh karyawan tertentu.</p>
      </div>

      <Card className="border-slate-200 p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative min-w-[240px] flex-1 space-y-1.5">
            <label className="text-xs font-medium text-slate-600">Barang</label>
            <Input
              data-testid="assign-barang-search"
              placeholder="Ketik kode / nama / barcode..."
              value={selBarang ? selBarangLabel : barangQuery}
              onChange={(e) => { setSelBarang(""); setSelBarangLabel(""); setBarangQuery(e.target.value); }}
            />
            {barangResults.length > 0 && !selBarang && (
              <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg" data-testid="assign-barang-results">
                {barangResults.map((b) => (
                  <button
                    type="button"
                    key={b.id}
                    data-testid={`assign-barang-option-${b.kode}`}
                    onClick={() => { setSelBarang(b.id); setSelBarangLabel(`${b.kode} — ${b.nama}`); setBarangResults([]); }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                  >
                    <span className="font-mono text-xs text-slate-500">{b.kode}</span> — {b.nama}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="min-w-[200px] flex-1 space-y-1.5">
            <label className="text-xs font-medium text-slate-600">Karyawan</label>
            <Select value={selEmp} onValueChange={setSelEmp}>
              <SelectTrigger data-testid="assign-employee-select"><SelectValue placeholder="Pilih karyawan" /></SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={assign} data-testid="assign-submit-btn" className="gap-2 bg-indigo-600 hover:bg-indigo-700">
            <Plus className="h-4 w-4" /> Tugaskan
          </Button>
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-600">Filter karyawan:</span>
        <Select value={filterEmp} onValueChange={setFilterEmp}>
          <SelectTrigger className="w-56" data-testid="penugasan-filter-employee"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Karyawan</SelectItem>
            {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden border-slate-200">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Karyawan</TableHead><TableHead>Kode</TableHead>
                <TableHead>Nama Barang</TableHead><TableHead>Rak</TableHead>
                <TableHead>Status</TableHead><TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => (
                <TableRow key={t.id} data-testid={`penugasan-row-${t.id}`}>
                  <TableCell className="font-medium">{t.employee_name}</TableCell>
                  <TableCell className="font-mono text-xs">{t.kode}</TableCell>
                  <TableCell>{t.nama}</TableCell>
                  <TableCell className="font-mono text-xs">{t.lokasi_rak || "-"}</TableCell>
                  <TableCell>
                    {t.status === "dicek"
                      ? <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Sudah Dicek</Badge>
                      : <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Belum Dicek</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => remove(t.id)} data-testid={`delete-penugasan-${t.id}`}>
                      <Trash2 className="h-4 w-4 text-rose-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-slate-400">
                  <UserCheck className="mx-auto mb-2 h-8 w-8" />Belum ada penugasan
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
