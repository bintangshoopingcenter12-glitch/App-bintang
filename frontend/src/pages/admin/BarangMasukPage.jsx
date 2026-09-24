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
import { ArrowDownLeft, Save, Info } from "lucide-react";
import { toast } from "sonner";

const empty = { kode: "", nama: "", kategori: "", jumlah: 1, lokasi_rak: "", supplier: "", keterangan: "" };

export default function BarangMasukPage() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(empty);

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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Card className="border-slate-200 p-5 lg:col-span-5">
          <form onSubmit={submit} className="space-y-4">
            <h3 className="font-heading font-semibold text-slate-900">Form Barang Masuk</h3>
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
    </div>
  );
}
