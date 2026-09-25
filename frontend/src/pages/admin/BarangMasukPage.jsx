import { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ArrowDownLeft, Save, Info, Barcode, Search, MapPin, Plus, X } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CameraScanButton } from "@/components/CameraScanner";
import { toast } from "sonner";

const empty = { kode: "", nama: "", kategori: "", barcode: "", jumlah: 1, lokasi_rak: "", supplier: "", keterangan: "" };

export default function BarangMasukPage() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(empty);
  const [scanCode, setScanCode] = useState("");
  const [rackLoc, setRackLoc] = useState("");
  const [bulkInput, setBulkInput] = useState("");
  const [bulkCodes, setBulkCodes] = useState([]);
  const [bulkResult, setBulkResult] = useState(null);

  const addBulkCode = (c) => {
    const code = (typeof c === "string" ? c : bulkInput).trim();
    if (!code) return;
    setBulkCodes((prev) => (prev.includes(code) ? prev : [...prev, code]));
    setBulkInput("");
  };
  const removeBulkCode = (code) => setBulkCodes((prev) => prev.filter((x) => x !== code));
  const saveBulkRack = async () => {
    if (!rackLoc.trim()) { toast.error("Isi lokasi rak dulu"); return; }
    if (!bulkCodes.length) { toast.error("Scan/masukkan minimal 1 barcode"); return; }
    try {
      const { data } = await api.post("/barang/set-rack-bulk", { lokasi_rak: rackLoc.trim(), codes: bulkCodes });
      setBulkResult(data);
      toast.success(`${data.updated} barang diset ke rak ${rackLoc.trim()}`);
      setBulkCodes([]);
    } catch (e) { toast.error(apiError(e)); }
  };

  const lookup = async (codeArg) => {
    const code = (typeof codeArg === "string" ? codeArg : scanCode).trim();
    if (!code) return;
    try {
      const { data } = await api.get("/barang/lookup", { params: { code } });
      setForm((f) => ({ ...f, kode: data.kode, nama: data.nama, kategori: data.kategori || "",
        barcode: data.barcode || "", lokasi_rak: data.lokasi_rak || f.lokasi_rak }));
      toast.success(`Ditemukan: ${data.nama}`);
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const load = () => api.get("/barang-masuk").then((r) => setRows(r.data)).catch((e) => toast.error(apiError(e)));
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.lokasi_rak.trim()) { toast.error("Lokasi Rak / Shelf ID wajib diisi"); return; }
    try {
      await api.post("/barang-masuk", { ...form, jumlah: parseInt(form.jumlah) || 0 });
      toast.success("Barang masuk dicatat & master barang diperbarui");
      setForm(empty);
      load();
    } catch (err) { toast.error(apiError(err)); }
  };

  return (
    <div className="space-y-6" data-testid="barang-masuk-page">
      <div>
        <h1 className="font-heading text-2xl font-bold text-slate-900">Barang Masuk (Inbound)</h1>
        <p className="mt-1 text-sm text-slate-500">Catat penerimaan barang. Lokasi rak akan otomatis memperbarui Master Data.</p>
      </div>

      <Tabs defaultValue="masuk">
        <TabsList className="bg-slate-100">
          <TabsTrigger value="masuk" data-testid="tab-inbound">Barang Masuk</TabsTrigger>
          <TabsTrigger value="rak" data-testid="tab-bulk-rack">Set Lokasi Rak Massal</TabsTrigger>
        </TabsList>

        <TabsContent value="masuk" className="mt-4">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Card className="border-slate-200 p-5 lg:col-span-5">
          <form onSubmit={submit} className="space-y-4">
            <h3 className="font-heading font-semibold text-slate-900">Form Barang Masuk</h3>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><Barcode className="h-3.5 w-3.5" /> Scan Barcode / SKU</Label>
              <div className="flex gap-2">
                <Input data-testid="inbound-scan-input" className="font-mono" placeholder="Scan untuk isi otomatis"
                       value={scanCode} onChange={(e) => setScanCode(e.target.value)}
                       onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); lookup(); } }} />
                <Button type="button" variant="outline" data-testid="inbound-scan-btn" onClick={() => lookup()} className="gap-1.5">
                  <Search className="h-4 w-4" /> Cari
                </Button>
                <CameraScanButton testid="inbound-camera-btn" label="" onScan={(c) => { setScanCode(c); lookup(c); }} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Kode / SKU</Label>
                <Input data-testid="inbound-kode-input" value={form.kode} onChange={(e) => setForm({ ...form, kode: e.target.value })} required /></div>
              <div className="space-y-1.5"><Label>Kategori</Label>
                <Input data-testid="inbound-kategori-input" value={form.kategori} onChange={(e) => setForm({ ...form, kategori: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5"><Label>Nama Barang</Label>
              <Input data-testid="inbound-nama-input" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} required /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Jumlah Masuk</Label>
                <Input type="number" min="1" data-testid="inbound-jumlah-input" value={form.jumlah} onChange={(e) => setForm({ ...form, jumlah: e.target.value })} required /></div>
              <div className="space-y-1.5">
                <Label className="text-indigo-700">Lokasi Rak / Shelf ID *</Label>
                <Input data-testid="inbound-rack-location-input" placeholder="mis. R2-C1" value={form.lokasi_rak} onChange={(e) => setForm({ ...form, lokasi_rak: e.target.value })} required />
              </div>
            </div>
            <div className="space-y-1.5"><Label>Supplier</Label>
              <Input data-testid="inbound-supplier-input" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Keterangan</Label>
              <Textarea data-testid="inbound-keterangan-input" value={form.keterangan} onChange={(e) => setForm({ ...form, keterangan: e.target.value })} /></div>
            <div className="flex items-start gap-2 rounded-lg bg-indigo-50 p-3 text-xs text-indigo-700">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              Menyimpan akan memperbarui lokasi rak & menambah stok pada Master Barang (kode baru akan otomatis dibuat).
            </div>
            <Button type="submit" data-testid="inbound-submit-btn" className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700">
              <Save className="h-4 w-4" /> Simpan Barang Masuk
            </Button>
          </form>
        </Card>

        <Card className="overflow-hidden border-slate-200 lg:col-span-7">
          <div className="border-b border-slate-100 p-4">
            <h3 className="font-heading font-semibold text-slate-900">Riwayat Barang Masuk</h3>
          </div>
          <div className="max-h-[560px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Kode</TableHead><TableHead>Nama</TableHead>
                  <TableHead className="text-right">Jumlah</TableHead>
                  <TableHead>Rak</TableHead><TableHead>Supplier</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} data-testid={`inbound-row-${r.kode}`}>
                    <TableCell className="font-mono text-xs">{r.kode}</TableCell>
                    <TableCell className="font-medium">{r.nama}</TableCell>
                    <TableCell className="text-right font-semibold text-emerald-600">+{r.jumlah}</TableCell>
                    <TableCell className="font-mono text-xs">{r.lokasi_rak}</TableCell>
                    <TableCell className="text-slate-500">{r.supplier || "-"}</TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="py-10 text-center text-slate-400">
                    <ArrowDownLeft className="mx-auto mb-2 h-8 w-8" />Belum ada barang masuk
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
        </TabsContent>

        <TabsContent value="rak" className="mt-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <Card className="border-slate-200 p-5 lg:col-span-5">
              <h3 className="font-heading font-semibold text-slate-900">Set Lokasi Rak Massal</h3>
              <p className="mt-1 mb-4 text-xs text-slate-500">Tentukan satu lokasi rak, lalu scan/masukkan banyak barcode. Semua akan diset ke rak tersebut.</p>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-indigo-700">Lokasi Rak / Shelf ID *</Label>
                  <Input data-testid="bulk-rack-location-input" placeholder="mis. R3-D1" value={rackLoc} onChange={(e) => setRackLoc(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><Barcode className="h-3.5 w-3.5" /> Scan / Masukkan Barcode</Label>
                  <div className="flex gap-2">
                    <Input data-testid="bulk-rack-code-input" className="font-mono" placeholder="Scan lalu Enter" value={bulkInput}
                           onChange={(e) => setBulkInput(e.target.value)}
                           onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addBulkCode(); } }} />
                    <Button type="button" variant="outline" data-testid="bulk-rack-add-btn" onClick={() => addBulkCode()} className="gap-1.5"><Plus className="h-4 w-4" /></Button>
                    <CameraScanButton testid="bulk-rack-camera-btn" label="" onScan={(c) => addBulkCode(c)} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2" data-testid="bulk-rack-chips">
                  {bulkCodes.map((c) => (
                    <span key={c} className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-mono text-xs">
                      {c}<button type="button" onClick={() => removeBulkCode(c)}><X className="h-3 w-3 text-slate-500" /></button>
                    </span>
                  ))}
                  {bulkCodes.length === 0 && <span className="text-xs text-slate-400">Belum ada barcode.</span>}
                </div>
                <Button onClick={saveBulkRack} data-testid="bulk-rack-save-btn" className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700">
                  <MapPin className="h-4 w-4" /> Terapkan ke {bulkCodes.length} Barang
                </Button>
                {bulkResult && (
                  <div className="rounded-lg bg-slate-50 p-3 text-xs" data-testid="bulk-rack-result">
                    <p className="text-emerald-600">Berhasil diperbarui: {bulkResult.updated}</p>
                    {bulkResult.not_found?.length > 0 && <p className="text-rose-600">Tidak ditemukan: {bulkResult.not_found.join(", ")}</p>}
                  </div>
                )}
              </div>
            </Card>
            <Card className="border-slate-200 p-5 lg:col-span-7">
              <div className="flex items-start gap-2 rounded-lg bg-indigo-50 p-3 text-xs text-indigo-700">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                Cocok untuk mempercepat cek stok: kelompokkan barang per rak fisik, scan berurutan, lalu terapkan sekali klik.
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
