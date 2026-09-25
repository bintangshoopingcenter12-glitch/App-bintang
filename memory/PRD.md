# PRD — Sistem Manajemen Stok & Cek Fisik Gudang (Stock Opname RBAC)

## Original Problem Statement
Comprehensive Stock Checking Module (Cek Stok) with strict RBAC (Admin vs Employee), blind stock counting, employee task assignment, inbound goods with mandatory rack location, and an advanced Admin Summary Dashboard. UI in Bahasa Indonesia. Username+password auth managed by admin.

## Architecture
- Backend: FastAPI + MongoDB (motor), JWT httpOnly cookies (12h access / 7d refresh), bcrypt hashing, brute-force lockout. All routes under `/api`.
- Frontend: React 19 + React Router 7, shadcn/ui, TailwindCSS, sonner toasts, lucide-react icons. AuthContext + role-based Protected routes.
- Auth: username-based (case-insensitive), admin-managed accounts. No email self-service reset (admin resets via /api/users).

## User Personas
- **Admin**: full control — master data CRUD, inbound goods, assignments, employee management, summary analytics.
- **Karyawan (Employee)**: sees only assigned items, blind count (no system stock), inputs physical stock + notes only.

## Core Requirements (static)
- RBAC: admin-only endpoints return 403 for employees; frontend redirects mismatched roles.
- Blind count: `GET /api/my-tasks` never returns `stok_sistem`/`stok_minimum`.
- Inbound goods: mandatory Rack Location; saving auto-updates master item rack + increments stock (creates item if SKU new).
- Admin Summary: metric cards + per-employee breakdown + 5 separate tabs (Belum Dicek, Barang Habis=0, Sisa Stok Sedikit ≤min, Barang Selisih system≠physical).

## Implemented (2026-09-24)
### Iteration 6 — Hardening 4 tujuan (anti-404, cepat, scalable, kamera)
- **Anti-404**: `NotFoundPage.jsx` + route catch-all `path="*"` (BrowserRouter). Diverifikasi visual di `/halaman-tidak-ada-xyz`.
- **Pencarian cepat <200ms**: index MongoDB pada `nama`, `kategori`, `barcode`, `kode`. `GET /api/barang/search?q=&kategori=&page=&limit=` (regex + count + skip/limit). Latency 24ms lokal / 110ms via ingress untuk 3.290 data.
- **Scalable 10k+ SKU**: Cari Barang di-rewire ke search server-side (debounce 250ms + paginasi server), tidak lagi memuat semua di browser.
- **Kamera barcode**: sudah ada (html5-qrcode) dari iterasi sebelumnya.
- Catatan platform: stack Emergent tetap React(CRA)+FastAPI+MongoDB; Node/Express/Postgres/Prisma/Vite tidak didukung di runtime ini (bisa via GitHub + deploy eksternal).

### Iteration 5 — Set Rak Massal, Kamera Scanner, Ekspor Excel/PDF, Paginasi+Filter
- **Set Lokasi Rak Massal**: tab baru di Barang Masuk — set 1 rak + scan/tambah banyak barcode (chip) → `POST /api/barang/set-rack-bulk` (updated + not_found).
- **Kamera Scanner**: komponen `CameraScanButton` (html5-qrcode) di Barang Masuk, Cek Stok, Penjualan, Cari Barang, Set Rak Massal. Cleanup di-guard `getState()` + try/catch (tidak crash saat kamera gagal/headless).
- **Ekspor**: `GET /api/barang/export` (xlsx, openpyxl) → tombol Unduh Excel di Master; `GET /api/summary/export?format=xlsx|pdf` (openpyxl + reportlab) → tombol Excel/PDF di Rangkuman (ikut filter karyawan). Download via blob helper `downloadFile` (withCredentials).
- **Paginasi + Filter Kategori**: Master Barang & Cari Barang (25/halaman, dropdown kategori, prev/next). `_compute_summary` di-refactor jadi helper bersama.
- Verified: testing agent iteration_4 (backend 8/8, FE 6/7) + iteration_5 (camera fix 100%).

### Iteration 4 — Impor Data Produk Asli (produk-bintang.xlsx)
- Mengganti data demo dengan **3.290 produk asli** (Toko Bintang) via `/app/scripts/import_products.py` (parse openpyxl → MongoDB, batch insert).
- Setiap produk punya **barcode unik** (barcode asli dari file; yang kosong/duplikat di-generate EAN-13 otomatis agar bisa discan). kode juga dijamin unik.
- Field baru pada Master Barang: **satuan, harga_beli, harga_jual** (ditambahkan ke BarangInput/barang_public, form CRUD, kolom Harga Jual di Master Data & Cari Barang). 18 kategori.
- Data lama (tugas/penugasan & sales demo) dibersihkan; admin menugaskan ulang dari katalog asli. `list_barang` limit dinaikkan ke 20000.

### Iteration 3 — Scan Barcode di Stok Opname + Menu Cari Barang
- Employee Stok Opname: bar **scan-to-open** — scan/ketik barcode/SKU + Enter langsung membuka dialog input cek fisik item tsb; kode di luar tugas → toast error. Text search dipertahankan.
- Menu Admin **Cari Barang** (`/admin/cari-barang`): scan barcode (via `/api/barang/lookup`) atau cari kode/nama/kategori; baris hasil scan di-highlight.
- Blind count tetap aman (tidak ada stok sistem di halaman/dialog karyawan).
- Verified: testing agent iteration_3 = 100% frontend.

### Iteration 2 — Sales Module + Barcode
- Barcode field on all products (auto-generated EAN-13 if blank, or manual; unique). Startup backfill for existing items.
- `GET /api/barang/lookup?code=` (barcode OR SKU; role-aware — employee response omits system stock).
- Sales (Penjualan): `POST /api/sales/preview` (parse tab/comma paste, validate → ok/not_found/invalid), `POST /api/sales` (deducts system stock + logs), `GET /api/sales`.
- Frontend: SalesPage (bulk copy-paste + preview/validate + single barcode scan entry + sales report), barcode column in Master Data & all 4 summary exception tabs, barcode scan autofill in Barang Masuk, barcode display + search/scan in employee Cek Stok.
- Verified: testing agent iteration_2 = 100% backend + 100% frontend.

### Iteration 1 — Core
- JWT username auth (login/logout/me/refresh), brute-force lockout, idempotent admin + demo employee seeding.
- Master Barang CRUD, categories endpoint.
- Barang Masuk (inbound) with rack auto-update to master + stock increment.
- Penugasan (assign/list/delete) with employee filter.
- Employee management (create/reset password/delete).
- Employee blind-count task view ("Stock Check - [Name]") with physical stock + notes input.
- Admin Summary Dashboard (`GET /api/summary`) with overview, breakdown, and 4 exception tables + employee filter.
- Seed demo data: admin + 3 employees, 15 barang across 5 categories, 15 tugas (8 checked → 2 out-of-stock, 3 low, 3 discrepancy).
- Verified: testing agent iteration_1 = 100% backend + 100% frontend.

## Credentials
- Admin: `admin` / `admin123` (owner email: bintangshoopingcenter12@gmail.com)
- Employees: `budi`, `dedi`, `siti` / `user123`

## Backlog / Remaining
- P1: Export Excel/PDF on Summary page (offered to user).
- P2: Pagination/virtualization for very large tables.
- P2: Split server.py into routers; add opname session grouping/history.
