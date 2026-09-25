import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Boxes, Home, SearchX } from "lucide-react";

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6 text-center" data-testid="not-found-page">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600">
        <Boxes className="h-7 w-7 text-white" />
      </div>
      <div className="mt-8 flex items-center gap-3 text-indigo-600">
        <SearchX className="h-9 w-9" />
        <span className="font-heading text-6xl font-extrabold text-slate-900">404</span>
      </div>
      <h1 className="mt-4 font-heading text-2xl font-bold text-slate-900">Halaman tidak ditemukan</h1>
      <p className="mt-2 max-w-md text-sm text-slate-500">
        Alamat yang Anda tuju tidak tersedia atau sudah dipindahkan. Silakan kembali ke beranda.
      </p>
      <Link to="/" className="mt-6">
        <Button data-testid="not-found-home-btn" className="gap-2 bg-indigo-600 hover:bg-indigo-700">
          <Home className="h-4 w-4" /> Kembali ke Beranda
        </Button>
      </Link>
    </div>
  );
}
