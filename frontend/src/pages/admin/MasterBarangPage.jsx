import { useEffect, useState } from "react";
import api, { apiError, downloadFile } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Search, Edit, Trash2, Package, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

const empty = { kode: "", nama: "", kategori: "", barcode: "", lokasi_rak: "", satuan: "pcs", stok_sistem: 0, stok_minimum: 0, harga_beli: 0, harga_jual: 0 };

function genEan13() {
  const base = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10));
  const s = base.reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 1 : 3), 0);
  const check = (10 - (s % 10)) % 10;
  return base.join("") + check;
}

export default function MasterBarangPage() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [q, setQ] = useState("");
  const [kategoriFilter, setKategoriFilter] = useState("all");
  const [kategoriList, setKategoriList] = useState([]);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [delItem, setDelItem] = useState(null);

  const load = () => {
    api.get("/barang/search", { params: { q, kategori: kategoriFilter, page, limit: 25 } })
      .then((r) => { setItems(r.data.items); setTotal(r.data.total); setPages(r.data.pages); })
      .catch((e) => toast.error(apiError(e)));
  };
  useEffect(() => {
    api.get("/barang/kategori").then((r) => setKategoriList(r.data)).catch(() => {});
  }, []);
  useEffect(() => { setPage(1); }, [q, kategoriFilter]);
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, kategoriFilter, page]);

  const openNew = () => { setForm(empty); setEditId(null); setOpen(true); };
  const openEdit = (b) => { setForm({ ...b }); setEditId(b.id); setOpen(true); };

  const save = async () => {
    const payload = {
      ...form,
      stok_sistem: parseInt(form.stok_sistem) || 0,
      stok_minimum: parseInt(form.stok_minimum) || 0,
      harga_beli: parseInt(form.harga_beli) || 0,
      harga_jual: parseInt(form.harga_jual) || 0,
    };
    try {
      if (editId) await api.put(`/barang/${editId}`, payload);
      else await api.post("/barang", payload);
      toast.success("Barang tersimpan");
      setOpen(false);
      load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const remove = async () => {
    try {
      await api.delete(`/barang/${delItem.id}`);
      toast.success("Barang dihapus");
      setDelItem(null);
      load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const totalPages = pages;
  const pageItems = items;

  return (
    <div className="space-y-6" data-testid="master-barang-page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-slate-900">Master Data Barang</h1>
          <p className="mt-1 text-sm text-slate-500">Kontrol penuh CRUD, stok sistem, dan minimum stok.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => downloadFile("/barang/export", "master-barang.xlsx")} data-testid="btn-export-barang" className="gap-2">
            <Download className="h-4 w-4" /> Unduh Excel
          </Button>
          <Button onClick={openNew} data-testid="btn-add-master-barang" className="gap-2 bg-indigo-600 hover:bg-indigo-700">
            <Plus className="h-4 w-4" /> Tambah Barang
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input data-testid="master-search-input" className="pl-9" placeholder="Cari nama / kode / barcode..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={kategoriFilter} onValueChange={setKategoriFilter}>
          <SelectTrigger className="w-52" data-testid="master-kategori-filter"><SelectValue placeholder="Kategori" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Kategori</SelectItem>
            {kategoriList.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-slate-500">{total} barang</span>
      </div>

      <Card className="overflow-hidden border-slate-200">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Kode</TableHead>
                <TableHead>Barcode</TableHead>
                <TableHead>Nama Barang</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Lokasi Rak</TableHead>
                <TableHead className="text-right">Harga Jual</TableHead>
                <TableHead className="text-right">Stok Sistem</TableHead>
                <TableHead className="text-right">Min. Stok</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageItems.map((b) => (
                <TableRow key={b.id} data-testid={`barang-row-${b.kode}`}>
                  <TableCell className="font-mono text-xs">{b.kode}</TableCell>
                  <TableCell className="font-mono text-xs text-slate-500">{b.barcode || "-"}</TableCell>
                  <TableCell className="font-medium">{b.nama}</TableCell>
                  <TableCell><Badge variant="secondary">{b.kategori}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{b.lokasi_rak || "-"}</TableCell>
                  <TableCell className="text-right text-slate-600">Rp {(b.harga_jual || 0).toLocaleString("id-ID")}</TableCell>
                  <TableCell className="text-right font-semibold">{b.stok_sistem}</TableCell>
                  <TableCell className="text-right text-slate-500">{b.stok_minimum}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(b)} data-testid={`edit-barang-${b.kode}`}>
                        <Edit className="h-4 w-4 text-slate-500" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setDelItem(b)} data-testid={`delete-barang-${b.kode}`}>
                        <Trash2 className="h-4 w-4 text-rose-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {pageItems.length === 0 && (
                <TableRow><TableCell colSpan={9} className="py-10 text-center text-slate-400">
                  <Package className="mx-auto mb-2 h-8 w-8" />Tidak ada barang
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <div className="flex items-center justify-between" data-testid="master-pagination">
        <span className="text-xs text-slate-500">Halaman {page} dari {totalPages}</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} data-testid="master-prev-page"><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} data-testid="master-next-page"><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg" data-testid="barang-form-dialog">
          <DialogHeader><DialogTitle>{editId ? "Edit Barang" : "Tambah Barang"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label>Kode / SKU</Label>
              <Input data-testid="form-kode" value={form.kode} onChange={(e) => setForm({ ...form, kode: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Kategori</Label>
              <Input data-testid="form-kategori" value={form.kategori} onChange={(e) => setForm({ ...form, kategori: e.target.value })} /></div>
            <div className="col-span-2 space-y-1.5"><Label>Nama Barang</Label>
              <Input data-testid="form-nama" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} /></div>
            <div className="col-span-2 space-y-1.5"><Label>Barcode (EAN-13 / CODE128)</Label>
              <div className="flex gap-2">
                <Input data-testid="form-barcode" className="font-mono" placeholder="Kosongkan untuk auto-generate"
                       value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
                <Button type="button" variant="outline" data-testid="form-barcode-generate" onClick={() => setForm({ ...form, barcode: genEan13() })}>Auto</Button>
              </div>
            </div>
            <div className="col-span-2 space-y-1.5"><Label>Lokasi Rak / Shelf ID</Label>
              <Input data-testid="form-lokasi" value={form.lokasi_rak} onChange={(e) => setForm({ ...form, lokasi_rak: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Stok Sistem</Label>
              <Input type="number" data-testid="form-stok-sistem" value={form.stok_sistem} onChange={(e) => setForm({ ...form, stok_sistem: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Minimum Stok</Label>
              <Input type="number" data-testid="form-stok-min" value={form.stok_minimum} onChange={(e) => setForm({ ...form, stok_minimum: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Satuan</Label>
              <Input data-testid="form-satuan" value={form.satuan} onChange={(e) => setForm({ ...form, satuan: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Harga Beli</Label>
              <Input type="number" data-testid="form-harga-beli" value={form.harga_beli} onChange={(e) => setForm({ ...form, harga_beli: e.target.value })} /></div>
            <div className="col-span-2 space-y-1.5"><Label>Harga Jual</Label>
              <Input type="number" data-testid="form-harga-jual" value={form.harga_jual} onChange={(e) => setForm({ ...form, harga_jual: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={save} data-testid="save-barang-btn" className="bg-indigo-600 hover:bg-indigo-700">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delItem} onOpenChange={(o) => !o && setDelItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus barang?</AlertDialogTitle>
            <AlertDialogDescription>
              "{delItem?.nama}" akan dihapus beserta penugasannya. Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={remove} data-testid="confirm-delete-barang" className="bg-rose-600 hover:bg-rose-700">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
