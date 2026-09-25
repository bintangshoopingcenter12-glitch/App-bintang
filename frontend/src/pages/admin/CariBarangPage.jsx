import { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Search, Barcode, PackageSearch, ScanLine, ChevronLeft, ChevronRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CameraScanButton } from "@/components/CameraScanner";
import { toast } from "sonner";

export default function CariBarangPage() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [q, setQ] = useState("");
  const [scan, setScan] = useState("");
  const [highlight, setHighlight] = useState(null);
  const [kategori, setKategori] = useState("all");
  const [kategoriList, setKategoriList] = useState([]);
  const [page, setPage] = useState(1);

  useEffect(() => {
    api.get("/barang/kategori").then((r) => setKategoriList(r.data)).catch(() => {});
  }, []);

  useEffect(() => { setPage(1); }, [q, kategori]);

  useEffect(() => {
    const t = setTimeout(() => {
      api.get("/barang/search", { params: { q, kategori, page, limit: 25 } })
        .then((r) => { setItems(r.data.items); setTotal(r.data.total); setPages(r.data.pages); })
        .catch((e) => toast.error(apiError(e)));
    }, 250);
    return () => clearTimeout(t);
  }, [q, kategori, page]);

  const doScan = async (codeArg) => {
    const code = (typeof codeArg === "string" ? codeArg : scan).trim();
    if (!code) return;
    try {
      const { data } = await api.get("/barang/lookup", { params: { code } });
      setQ(data.kode);
      setHighlight(data.id);
      toast.success(`Ditemukan: ${data.nama}`);
      setScan("");
    } catch (e) {
      setHighlight(null);
      toast.error(apiError(e));
    }
  };

  const totalPages = pages;
  const pageItems = items;

  return (
    <div className="space-y-6" data-testid="cari-barang-page">
      <div>
        <h1 className="font-heading text-2xl font-bold text-slate-900">Cari Barang</h1>
        <p className="mt-1 text-sm text-slate-500">Scan barcode atau cari cepat berdasarkan kode, nama, atau kategori.</p>
      </div>

      <Card className="border-slate-200 p-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex flex-1 gap-2">
            <div className="relative flex-1">
              <Barcode className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-indigo-500" />
              <Input
                data-testid="cari-scan-input"
                className="pl-9 font-mono"
                placeholder="Scan / ketik barcode atau SKU lalu Enter..."
                value={scan}
                onChange={(e) => setScan(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); doScan(); } }}
              />
            </div>
            <Button data-testid="cari-scan-btn" onClick={() => doScan()} className="gap-1.5 bg-indigo-600 hover:bg-indigo-700">
              <ScanLine className="h-4 w-4" /> Scan
            </Button>
            <CameraScanButton testid="cari-camera-btn" label="" onScan={(c) => { setScan(c); doScan(c); }} />
          </div>
          <div className="relative sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              data-testid="cari-search-input"
              className="pl-9"
              placeholder="Cari kode / nama / kategori..."
              value={q}
              onChange={(e) => { setQ(e.target.value); setHighlight(null); }}
            />
          </div>
          <Select value={kategori} onValueChange={setKategori}>
            <SelectTrigger className="sm:w-52" data-testid="cari-kategori-filter"><SelectValue placeholder="Kategori" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Kategori</SelectItem>
              {kategoriList.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <p className="mt-3 text-xs text-slate-500">{total} barang ditemukan</p>
      </Card>

      <Card className="overflow-hidden border-slate-200">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Barcode</TableHead>
                <TableHead>Kode</TableHead>
                <TableHead>Nama Barang</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Lokasi Rak</TableHead>
                <TableHead className="text-right">Harga Jual</TableHead>
                <TableHead className="text-right">Stok Sistem</TableHead>
                <TableHead className="text-right">Min. Stok</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageItems.map((b) => (
                <TableRow
                  key={b.id}
                  data-testid={`cari-row-${b.kode}`}
                  className={highlight === b.id ? "bg-indigo-50" : ""}
                >
                  <TableCell className="font-mono text-xs text-slate-500">{b.barcode || "-"}</TableCell>
                  <TableCell className="font-mono text-xs">{b.kode}</TableCell>
                  <TableCell className="font-medium">{b.nama}</TableCell>
                  <TableCell><Badge variant="secondary">{b.kategori || "-"}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{b.lokasi_rak || "-"}</TableCell>
                  <TableCell className="text-right text-slate-600">Rp {(b.harga_jual || 0).toLocaleString("id-ID")}</TableCell>
                  <TableCell className="text-right font-semibold">{b.stok_sistem}</TableCell>
                  <TableCell className="text-right text-slate-500">{b.stok_minimum}</TableCell>
                </TableRow>
              ))}
              {pageItems.length === 0 && (
                <TableRow><TableCell colSpan={8} className="py-10 text-center text-slate-400">
                  <PackageSearch className="mx-auto mb-2 h-8 w-8" />Tidak ada barang yang cocok
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <div className="flex items-center justify-between" data-testid="cari-pagination">
        <span className="text-xs text-slate-500">Halaman {page} dari {totalPages}</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} data-testid="cari-prev-page"><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} data-testid="cari-next-page"><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );
}
