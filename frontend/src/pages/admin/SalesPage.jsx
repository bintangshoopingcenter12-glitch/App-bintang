import { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ShoppingCart, ClipboardPaste, CheckCircle2, AlertTriangle, XCircle,
  Barcode, Plus, Save, Info,
} from "lucide-react";
import { CameraScanButton } from "@/components/CameraScanner";
import { toast } from "sonner";

const rupiah = (n) => "Rp " + (Number(n) || 0).toLocaleString("id-ID");

const statusMap = {
  ok: { cls: "bg-emerald-50", badge: "bg-emerald-100 text-emerald-700", icon: CheckCircle2, label: "Valid" },
  not_found: { cls: "bg-rose-50", badge: "bg-rose-100 text-rose-700", icon: XCircle, label: "Tidak Terdaftar" },
  invalid: { cls: "bg-amber-50", badge: "bg-amber-100 text-amber-700", icon: AlertTriangle, label: "Format Salah" },
};

export default function SalesPage() {
  const [raw, setRaw] = useState("");
  const [preview, setPreview] = useState(null);
  const [sales, setSales] = useState([]);
  const [scan, setScan] = useState({ barcode: "", qty: 1, price: "" });
  const [saving, setSaving] = useState(false);

  const loadSales = () => api.get("/sales").then((r) => setSales(r.data)).catch(() => {});
  useEffect(() => { loadSales(); }, []);

  const doPreview = async () => {
    if (!raw.trim()) { toast.error("Tempel data penjualan terlebih dahulu"); return; }
    try {
      const { data } = await api.post("/sales/preview", { raw });
      setPreview(data);
      if (data.invalid > 0) toast.warning(`${data.invalid} baris bermasalah — periksa highlight`);
      else toast.success(`${data.valid} baris valid siap disimpan`);
    } catch (e) { toast.error(apiError(e)); }
  };

  const save = async () => {
    const rows = preview.rows.filter((r) => r.status === "ok").map((r) => ({
      barcode: r.barcode || r.code, nama: r.nama, qty: r.qty, price: r.price,
      tanggal: r.tanggal, catatan: r.catatan,
    }));
    if (!rows.length) { toast.error("Tidak ada baris valid untuk disimpan"); return; }
    setSaving(true);
    try {
      const { data } = await api.post("/sales", { rows });
      toast.success(data.message);
      setRaw(""); setPreview(null);
      loadSales();
    } catch (e) { toast.error(apiError(e)); }
    finally { setSaving(false); }
  };

  const addScanLine = () => {
    if (!scan.barcode.trim()) { toast.error("Masukkan / scan barcode"); return; }
    const line = `${scan.barcode.trim()}\t\t${scan.qty}\t${scan.price || 0}`;
    setRaw((prev) => (prev ? prev + "\n" + line : line));
    setScan({ barcode: "", qty: 1, price: "" });
    toast.success("Baris ditambahkan ke area tempel");
  };

  return (
    <div className="space-y-6" data-testid="sales-page">
      <div>
        <h1 className="font-heading text-2xl font-bold text-slate-900">Penjualan (Sales Entry)</h1>
        <p className="mt-1 text-sm text-slate-500">Input massal via copy-paste dari Excel/Sheets, atau scan barcode per item.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Bulk paste */}
        <Card className="border-slate-200 p-5 lg:col-span-7">
          <div className="mb-3 flex items-center gap-2">
            <ClipboardPaste className="h-4 w-4 text-indigo-600" />
            <h3 className="font-heading font-semibold text-slate-900">Tempel Data (Bulk Copy-Paste)</h3>
          </div>
          <p className="mb-2 text-xs text-slate-500">
            Kolom: <span className="font-mono">Barcode/SKU · Nama · Qty · Harga · Tanggal · Catatan</span>. Pisah dengan Tab atau koma.
          </p>
          <Textarea
            data-testid="sales-paste-textarea"
            className="min-h-[180px] font-mono text-xs"
            placeholder={"8991234567890\tAir Mineral\t3\t5000\n8990001112223\tMie Instan\t10\t3000"}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
          />
          <div className="mt-3 flex gap-2">
            <Button onClick={doPreview} data-testid="sales-preview-btn" className="gap-2 bg-indigo-600 hover:bg-indigo-700">
              <ClipboardPaste className="h-4 w-4" /> Preview & Validasi
            </Button>
            {raw && <Button variant="ghost" onClick={() => { setRaw(""); setPreview(null); }}>Bersihkan</Button>}
          </div>
        </Card>

        {/* Scan single */}
        <Card className="border-slate-200 p-5 lg:col-span-5">
          <div className="mb-3 flex items-center gap-2">
            <Barcode className="h-4 w-4 text-indigo-600" />
            <h3 className="font-heading font-semibold text-slate-900">Scan / Input Barcode</h3>
          </div>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Barcode / SKU</Label>
              <div className="flex gap-2">
                <Input data-testid="sales-scan-barcode" className="font-mono" placeholder="Scan atau ketik barcode"
                       value={scan.barcode} onChange={(e) => setScan({ ...scan, barcode: e.target.value })}
                       onKeyDown={(e) => e.key === "Enter" && addScanLine()} />
                <CameraScanButton testid="sales-camera-btn" label="" onScan={(c) => setScan((s) => ({ ...s, barcode: c }))} />
              </div></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Qty</Label>
                <Input type="number" min="1" data-testid="sales-scan-qty" value={scan.qty}
                       onChange={(e) => setScan({ ...scan, qty: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Harga</Label>
                <Input type="number" min="0" data-testid="sales-scan-price" value={scan.price}
                       onChange={(e) => setScan({ ...scan, price: e.target.value })} /></div>
            </div>
            <Button onClick={addScanLine} data-testid="sales-scan-add" variant="outline" className="w-full gap-2">
              <Plus className="h-4 w-4" /> Tambahkan ke Area Tempel
            </Button>
            <div className="flex items-start gap-2 rounded-lg bg-indigo-50 p-2.5 text-xs text-indigo-700">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Item yang di-scan masuk ke area tempel. Klik "Preview & Validasi" untuk memproses.
            </div>
          </div>
        </Card>
      </div>

      {/* Preview */}
      {preview && (
        <Card className="overflow-hidden border-slate-200" data-testid="sales-preview-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
            <div className="flex items-center gap-3">
              <h3 className="font-heading font-semibold text-slate-900">Preview ({preview.total} baris)</h3>
              <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">{preview.valid} valid</Badge>
              {preview.invalid > 0 && <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100">{preview.invalid} bermasalah</Badge>}
            </div>
            <Button onClick={save} disabled={saving || preview.valid === 0} data-testid="sales-save-btn" className="gap-2 bg-indigo-600 hover:bg-indigo-700">
              <Save className="h-4 w-4" /> Simpan {preview.valid} Transaksi
            </Button>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow className="bg-slate-50">
                <TableHead>#</TableHead><TableHead>Barcode/SKU</TableHead><TableHead>Nama Barang</TableHead>
                <TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Harga</TableHead>
                <TableHead>Status</TableHead><TableHead>Keterangan</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {preview.rows.map((r) => {
                  const st = statusMap[r.status];
                  return (
                    <TableRow key={r.row} className={st.cls} data-testid={`sales-preview-row-${r.row}`}>
                      <TableCell className="text-slate-400">{r.row}</TableCell>
                      <TableCell className="font-mono text-xs">{r.code}</TableCell>
                      <TableCell className="font-medium">{r.nama || r.input_nama || "-"}</TableCell>
                      <TableCell className="text-right">{r.qty}</TableCell>
                      <TableCell className="text-right">{rupiah(r.price)}</TableCell>
                      <TableCell><Badge className={`${st.badge} hover:${st.badge} gap-1`}><st.icon className="h-3 w-3" />{st.label}</Badge></TableCell>
                      <TableCell className="text-xs text-rose-600">{r.errors.join(", ")}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Sales report */}
      <Card className="overflow-hidden border-slate-200">
        <div className="flex items-center gap-2 border-b border-slate-100 p-4">
          <ShoppingCart className="h-4 w-4 text-slate-500" />
          <h3 className="font-heading font-semibold text-slate-900">Laporan Penjualan</h3>
        </div>
        <div className="max-h-[420px] overflow-auto">
          <Table>
            <TableHeader><TableRow className="bg-slate-50">
              <TableHead>Barcode</TableHead><TableHead>Kode</TableHead><TableHead>Nama</TableHead>
              <TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Harga</TableHead>
              <TableHead className="text-right">Total</TableHead><TableHead>Oleh</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {sales.map((s) => (
                <TableRow key={s.id} data-testid={`sales-row-${s.id}`}>
                  <TableCell className="font-mono text-xs">{s.barcode || "-"}</TableCell>
                  <TableCell className="font-mono text-xs">{s.kode}</TableCell>
                  <TableCell className="font-medium">{s.nama}</TableCell>
                  <TableCell className="text-right">{s.qty}</TableCell>
                  <TableCell className="text-right">{rupiah(s.price)}</TableCell>
                  <TableCell className="text-right font-semibold text-emerald-600">{rupiah(s.total)}</TableCell>
                  <TableCell className="text-xs text-slate-500">{s.created_by}</TableCell>
                </TableRow>
              ))}
              {sales.length === 0 && (
                <TableRow><TableCell colSpan={7} className="py-10 text-center text-slate-400">
                  <ShoppingCart className="mx-auto mb-2 h-8 w-8" />Belum ada transaksi penjualan
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
