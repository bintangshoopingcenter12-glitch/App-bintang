import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Package, CheckCircle2, Clock, AlertTriangle, BarChart3, ArrowRight, Boxes,
} from "lucide-react";

const cards = [
  { key: "total_assigned", label: "Total Item Ditugaskan", icon: Package, color: "indigo", tid: "metric-total-assigned" },
  { key: "total_checked", label: "Total Sudah Dicek", icon: CheckCircle2, color: "emerald", tid: "metric-total-checked" },
  { key: "total_unchecked", label: "Total Belum Dicek", icon: Clock, color: "amber", tid: "metric-total-unchecked" },
  { key: "total_discrepancy", label: "Total Item Selisih", icon: AlertTriangle, color: "rose", tid: "metric-total-discrepancy" },
];

const colorMap = {
  indigo: "bg-indigo-50 text-indigo-600",
  emerald: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  rose: "bg-rose-50 text-rose-600",
};

export default function DashboardPage() {
  const [ov, setOv] = useState(null);
  const [barangCount, setBarangCount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/summary").then((r) => setOv(r.data.overview)).catch(() => {});
    api.get("/barang").then((r) => setBarangCount(r.data.length)).catch(() => {});
  }, []);

  return (
    <div className="space-y-6" data-testid="admin-dashboard">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-slate-900">Dashboard Utama</h1>
          <p className="mt-1 text-sm text-slate-500">Ringkasan aktivitas cek stok gudang.</p>
        </div>
        <Button
          onClick={() => navigate("/admin/summary")}
          data-testid="dashboard-open-summary"
          className="gap-2 bg-indigo-600 hover:bg-indigo-700"
        >
          <BarChart3 className="h-4 w-4" /> Buka Rangkuman Cek Stok
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.key} data-testid={c.tid} className="border-slate-200">
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${colorMap[c.color]}`}>
                <c.icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{ov ? ov[c.key] : "–"}</p>
                <p className="text-xs font-medium text-slate-500">{c.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-slate-200">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
              <Boxes className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">{barangCount} Barang</p>
              <p className="text-xs text-slate-500">Total item di Master Data</p>
            </div>
          </div>
          <Button variant="outline" className="gap-2" onClick={() => navigate("/admin/master-barang")}>
            Kelola Master Data <ArrowRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
