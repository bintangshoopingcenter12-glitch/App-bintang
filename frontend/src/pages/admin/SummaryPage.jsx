import { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Package, CheckCircle2, Clock, AlertTriangle, XCircle, TrendingDown, Users,
} from "lucide-react";
import { toast } from "sonner";

const cards = [
  { key: "total_assigned", label: "Total Item Ditugaskan", icon: Package, cls: "bg-indigo-50 text-indigo-600", tid: "metric-total-assigned" },
  { key: "total_checked", label: "Total Sudah Dicek", icon: CheckCircle2, cls: "bg-emerald-50 text-emerald-600", tid: "metric-total-checked" },
  { key: "total_unchecked", label: "Total Belum Dicek", icon: Clock, cls: "bg-amber-50 text-amber-600", tid: "metric-total-unchecked" },
  { key: "total_discrepancy", label: "Total Item Selisih", icon: AlertTriangle, cls: "bg-rose-50 text-rose-600", tid: "metric-total-discrepancy" },
];

function fmtDate(iso) {
  if (!iso) return "-";
  try { return new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); }
  catch { return iso; }
}

function EmptyRow({ span, text }) {
  return <TableRow><TableCell colSpan={span} className="py-10 text-center text-slate-400">{text}</TableCell></TableRow>;
}

export default function SummaryPage() {
  const [data, setData] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [filterEmp, setFilterEmp] = useState("all");

  const load = (emp) => {
    const params = emp && emp !== "all" ? { employee_id: emp } : {};
    api.get("/summary", { params }).then((r) => setData(r.data)).catch((e) => toast.error(apiError(e)));
  };
  useEffect(() => {
    api.get("/users").then((r) => setEmployees(r.data.filter((u) => u.role === "employee"))).catch(() => {});
  }, []);
  useEffect(() => { load(filterEmp); }, [filterEmp]);

  const ov = data?.overview;

  return (
    <div className="space-y-6" data-testid="summary-page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-slate-900">Rangkuman Cek Stok</h1>
          <p className="mt-1 text-sm text-slate-500">Analitik cek stok, breakdown per karyawan, dan tabel pengecualian.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">Karyawan:</span>
          <Select value={filterEmp} onValueChange={setFilterEmp}>
            <SelectTrigger className="w-52" data-testid="summary-filter-employee"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Karyawan</SelectItem>
              {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.key} data-testid={c.tid} className="border-slate-200">
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${c.cls}`}><c.icon className="h-6 w-6" /></div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{ov ? ov[c.key] : "–"}</p>
                <p className="text-xs font-medium text-slate-500">{c.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="breakdown">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-slate-100 p-1">
          <TabsTrigger value="breakdown" data-testid="tab-breakdown">Rangkuman Per Karyawan</TabsTrigger>
          <TabsTrigger value="unchecked" data-testid="tab-unchecked">Belum Dicek</TabsTrigger>
          <TabsTrigger value="oos" data-testid="tab-out-of-stock">Barang Habis</TabsTrigger>
          <TabsTrigger value="low" data-testid="tab-low-stock">Sisa Stok Sedikit</TabsTrigger>
          <TabsTrigger value="disc" data-testid="tab-discrepancy-items">Barang Selisih</TabsTrigger>
        </TabsList>

        {/* Breakdown */}
        <TabsContent value="breakdown" className="mt-4">
          <Card className="overflow-hidden border-slate-200">
            <Table>
              <TableHeader><TableRow className="bg-slate-50">
                <TableHead>Karyawan</TableHead><TableHead className="text-right">Ditugaskan</TableHead>
                <TableHead className="text-right">Sudah Dicek</TableHead><TableHead className="text-right">Belum Dicek</TableHead>
                <TableHead className="text-right">Selisih</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {data?.breakdown?.map((b) => (
                  <TableRow key={b.employee_id} data-testid={`breakdown-row-${b.username}`}>
                    <TableCell className="font-medium"><div className="flex items-center gap-2"><Users className="h-4 w-4 text-slate-400" />{b.employee_name}</div></TableCell>
                    <TableCell className="text-right">{b.assigned}</TableCell>
                    <TableCell className="text-right text-emerald-600">{b.checked}</TableCell>
                    <TableCell className="text-right text-amber-600">{b.unchecked}</TableCell>
                    <TableCell className="text-right text-rose-600 font-semibold">{b.discrepancy}</TableCell>
                  </TableRow>
                ))}
                {!data?.breakdown?.length && <EmptyRow span={5} text="Belum ada data" />}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Unchecked */}
        <TabsContent value="unchecked" className="mt-4">
          <Card className="overflow-hidden border-slate-200">
            <div className="overflow-x-auto"><Table>
              <TableHeader><TableRow className="bg-slate-50">
                <TableHead>Nama Barang</TableHead><TableHead>SKU</TableHead><TableHead>Lokasi Rak</TableHead>
                <TableHead>Karyawan</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {data?.unchecked?.map((r) => (
                  <TableRow key={r.id} data-testid={`unchecked-row-${r.id}`}>
                    <TableCell className="font-medium">{r.nama}</TableCell>
                    <TableCell className="font-mono text-xs">{r.kode}</TableCell>
                    <TableCell className="font-mono text-xs">{r.lokasi_rak || "-"}</TableCell>
                    <TableCell>{r.employee_name}</TableCell>
                    <TableCell><Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Belum Dicek</Badge></TableCell>
                  </TableRow>
                ))}
                {!data?.unchecked?.length && <EmptyRow span={5} text="Semua item sudah dicek 🎉" />}
              </TableBody>
            </Table></div>
          </Card>
        </TabsContent>

        {/* Out of stock */}
        <TabsContent value="oos" className="mt-4">
          <Card className="overflow-hidden border-slate-200">
            <div className="overflow-x-auto"><Table>
              <TableHeader><TableRow className="bg-slate-50">
                <TableHead>Nama Barang</TableHead><TableHead>SKU</TableHead><TableHead>Lokasi Rak</TableHead>
                <TableHead>Tgl Dicek</TableHead><TableHead>Diperiksa Oleh</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {data?.out_of_stock?.map((r) => (
                  <TableRow key={r.id} data-testid={`oos-row-${r.id}`}>
                    <TableCell className="font-medium"><div className="flex items-center gap-2"><XCircle className="h-4 w-4 text-rose-500" />{r.nama}</div></TableCell>
                    <TableCell className="font-mono text-xs">{r.kode}</TableCell>
                    <TableCell className="font-mono text-xs">{r.lokasi_rak || "-"}</TableCell>
                    <TableCell className="text-xs text-slate-500">{fmtDate(r.checked_at)}</TableCell>
                    <TableCell>{r.employee_name}</TableCell>
                  </TableRow>
                ))}
                {!data?.out_of_stock?.length && <EmptyRow span={5} text="Tidak ada barang habis" />}
              </TableBody>
            </Table></div>
          </Card>
        </TabsContent>

        {/* Low stock */}
        <TabsContent value="low" className="mt-4">
          <Card className="overflow-hidden border-slate-200">
            <div className="overflow-x-auto"><Table>
              <TableHeader><TableRow className="bg-slate-50">
                <TableHead>Nama Barang</TableHead><TableHead>SKU</TableHead><TableHead>Lokasi Rak</TableHead>
                <TableHead className="text-right">Stok Fisik</TableHead><TableHead className="text-right">Min. Threshold</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {data?.low_stock?.map((r) => (
                  <TableRow key={r.id} data-testid={`low-row-${r.id}`}>
                    <TableCell className="font-medium"><div className="flex items-center gap-2"><TrendingDown className="h-4 w-4 text-amber-500" />{r.nama}</div></TableCell>
                    <TableCell className="font-mono text-xs">{r.kode}</TableCell>
                    <TableCell className="font-mono text-xs">{r.lokasi_rak || "-"}</TableCell>
                    <TableCell className="text-right font-semibold text-amber-600">{r.stok_fisik}</TableCell>
                    <TableCell className="text-right text-slate-500">{r.stok_minimum}</TableCell>
                  </TableRow>
                ))}
                {!data?.low_stock?.length && <EmptyRow span={5} text="Tidak ada stok sedikit" />}
              </TableBody>
            </Table></div>
          </Card>
        </TabsContent>

        {/* Discrepancy */}
        <TabsContent value="disc" className="mt-4">
          <Card className="overflow-hidden border-slate-200">
            <div className="overflow-x-auto"><Table>
              <TableHeader><TableRow className="bg-slate-50">
                <TableHead>Nama Barang</TableHead><TableHead>SKU</TableHead><TableHead>Rak</TableHead>
                <TableHead className="text-right">Stok Sistem</TableHead><TableHead className="text-right">Stok Fisik</TableHead>
                <TableHead className="text-right">Selisih</TableHead><TableHead>Catatan</TableHead><TableHead>Diperiksa Oleh</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {data?.discrepancies?.map((r) => (
                  <TableRow key={r.id} data-testid={`disc-row-${r.id}`}>
                    <TableCell className="font-medium">{r.nama}</TableCell>
                    <TableCell className="font-mono text-xs">{r.kode}</TableCell>
                    <TableCell className="font-mono text-xs">{r.lokasi_rak || "-"}</TableCell>
                    <TableCell className="text-right">{r.stok_sistem}</TableCell>
                    <TableCell className="text-right font-semibold">{r.stok_fisik}</TableCell>
                    <TableCell className="text-right font-bold">
                      <span className={r.variance > 0 ? "text-emerald-600" : "text-rose-600"}>
                        {r.variance > 0 ? "+" : ""}{r.variance}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate text-xs text-slate-500">{r.catatan || "-"}</TableCell>
                    <TableCell>{r.employee_name}</TableCell>
                  </TableRow>
                ))}
                {!data?.discrepancies?.length && <EmptyRow span={8} text="Tidak ada selisih" />}
              </TableBody>
            </Table></div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
