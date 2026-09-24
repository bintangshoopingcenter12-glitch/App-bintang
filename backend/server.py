from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import logging
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta

# ------------------------------------------------------------------ setup
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

JWT_ALGORITHM = "HS256"
MAX_ATTEMPTS = 5
LOCKOUT_MINUTES = 15

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def now_dt() -> datetime:
    return datetime.now(timezone.utc)


# ------------------------------------------------------------------ auth helpers
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def create_access_token(user_id: str, username: str, token_version: int = 0) -> str:
    payload = {"sub": user_id, "username": username, "ver": token_version,
               "exp": now_dt() + timedelta(hours=12), "type": "access"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str, token_version: int = 0) -> str:
    payload = {"sub": user_id, "ver": token_version,
               "exp": now_dt() + timedelta(days=7), "type": "refresh"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def set_auth_cookies(response: Response, access: str, refresh: str):
    response.set_cookie("access_token", access, httponly=True, secure=True,
                        samesite="none", max_age=43200, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True,
                        samesite="none", max_age=604800, path="/")


def public_user(u: dict) -> dict:
    return {"id": u["_id"], "username": u["username"], "name": u.get("name", ""),
            "role": u.get("role", "employee"), "email": u.get("email", "")}


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Tidak terautentikasi")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Tipe token tidak valid")
        user = await db.users.find_one({"_id": payload["sub"]})
        if not user:
            raise HTTPException(status_code=401, detail="Pengguna tidak ditemukan")
        if payload.get("ver", 0) != user.get("token_version", 0):
            raise HTTPException(status_code=401, detail="Sesi kedaluwarsa")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token kedaluwarsa")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token tidak valid")


async def require_admin(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Akses khusus Admin")
    return user


# ------------------------------------------------------------------ models
class LoginInput(BaseModel):
    username: str
    password: str


class UserCreate(BaseModel):
    username: str
    password: str
    name: str
    role: str = "employee"


class UserUpdate(BaseModel):
    name: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None


class BarangInput(BaseModel):
    kode: str
    nama: str
    kategori: str
    barcode: str = ""
    lokasi_rak: str = ""
    stok_sistem: int = 0
    stok_minimum: int = 0


class BarangMasukInput(BaseModel):
    kode: str
    nama: str
    kategori: str = ""
    barcode: str = ""
    jumlah: int
    lokasi_rak: str
    tanggal_masuk: Optional[str] = None
    supplier: str = ""
    keterangan: str = ""


class AssignInput(BaseModel):
    barang_id: str
    employee_id: str


class CheckInput(BaseModel):
    stok_fisik: int
    catatan: str = ""


class SalesPreviewInput(BaseModel):
    raw: str


class SalesRow(BaseModel):
    barcode: str = ""
    nama: str = ""
    qty: int = 0
    price: float = 0
    tanggal: str = ""
    catatan: str = ""


class SalesConfirmInput(BaseModel):
    rows: List[SalesRow]


# ------------------------------------------------------------------ auth routes
@api_router.post("/auth/login")
async def login(data: LoginInput, request: Request, response: Response):
    username = data.username.strip().lower()
    ip = request.client.host if request.client else "unknown"
    identifier = f"{ip}:{username}"

    rec = await db.login_attempts.find_one({"identifier": identifier})
    if rec and rec.get("count", 0) >= MAX_ATTEMPTS:
        locked_until = rec.get("locked_until")
        if locked_until and datetime.fromisoformat(locked_until) > now_dt():
            raise HTTPException(status_code=429, detail="Terlalu banyak percobaan. Coba lagi dalam 15 menit.")

    user = await db.users.find_one({"username": username})
    if not user or not verify_password(data.password, user["password_hash"]):
        await db.login_attempts.update_one(
            {"identifier": identifier},
            {"$inc": {"count": 1},
             "$set": {"username": username,
                      "locked_until": (now_dt() + timedelta(minutes=LOCKOUT_MINUTES)).isoformat()}},
            upsert=True)
        raise HTTPException(status_code=401, detail="Username atau password salah")

    await db.login_attempts.delete_many({"identifier": identifier})
    ver = user.get("token_version", 0)
    set_auth_cookies(response,
                     create_access_token(user["_id"], user["username"], ver),
                     create_refresh_token(user["_id"], ver))
    return public_user(user)


@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"message": "Berhasil logout"}


@api_router.get("/auth/me")
async def me(request: Request):
    user = await get_current_user(request)
    return public_user(user)


@api_router.post("/auth/refresh")
async def refresh(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="Tidak ada refresh token")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Tipe token tidak valid")
        user = await db.users.find_one({"_id": payload["sub"]})
        if not user or payload.get("ver", 0) != user.get("token_version", 0):
            raise HTTPException(status_code=401, detail="Sesi kedaluwarsa")
        ver = user.get("token_version", 0)
        response.set_cookie("access_token",
                            create_access_token(user["_id"], user["username"], ver),
                            httponly=True, secure=True, samesite="none", max_age=43200, path="/")
        return public_user(user)
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token tidak valid")


# ------------------------------------------------------------------ user management (admin)
@api_router.get("/users")
async def list_users(admin: dict = Depends(require_admin)):
    users = await db.users.find().sort("created_at", 1).to_list(1000)
    return [public_user(u) for u in users]


@api_router.post("/users")
async def create_user(data: UserCreate, admin: dict = Depends(require_admin)):
    username = data.username.strip().lower()
    if await db.users.find_one({"username": username}):
        raise HTTPException(status_code=400, detail="Username sudah digunakan")
    if data.role not in ("admin", "employee"):
        raise HTTPException(status_code=400, detail="Role tidak valid")
    doc = {"_id": str(uuid.uuid4()), "username": username,
           "password_hash": hash_password(data.password), "name": data.name,
           "role": data.role, "email": "", "token_version": 0, "created_at": now_iso()}
    await db.users.insert_one(doc)
    return public_user(doc)


@api_router.put("/users/{user_id}")
async def update_user(user_id: str, data: UserUpdate, admin: dict = Depends(require_admin)):
    user = await db.users.find_one({"_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Pengguna tidak ditemukan")
    upd = {}
    if data.name is not None:
        upd["name"] = data.name
    if data.role in ("admin", "employee"):
        upd["role"] = data.role
    if data.password:
        upd["password_hash"] = hash_password(data.password)
        upd["token_version"] = user.get("token_version", 0) + 1
    if upd:
        await db.users.update_one({"_id": user_id}, {"$set": upd})
    return public_user(await db.users.find_one({"_id": user_id}))


@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, admin: dict = Depends(require_admin)):
    user = await db.users.find_one({"_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Pengguna tidak ditemukan")
    if user.get("role") == "admin":
        raise HTTPException(status_code=400, detail="Akun admin tidak dapat dihapus")
    await db.users.delete_one({"_id": user_id})
    await db.tugas.delete_many({"employee_id": user_id})
    return {"message": "Pengguna dihapus"}


# ------------------------------------------------------------------ master barang (admin CRUD)
def barang_public(b: dict) -> dict:
    return {"id": b["_id"], "kode": b["kode"], "nama": b["nama"], "kategori": b.get("kategori", ""),
            "barcode": b.get("barcode", ""), "lokasi_rak": b.get("lokasi_rak", ""),
            "stok_sistem": b.get("stok_sistem", 0),
            "stok_minimum": b.get("stok_minimum", 0), "updated_at": b.get("updated_at", "")}


def gen_ean13() -> str:
    import random
    base = [random.randint(0, 9) for _ in range(12)]
    s = sum(base[i] * (1 if i % 2 == 0 else 3) for i in range(12))
    check = (10 - (s % 10)) % 10
    return "".join(map(str, base)) + str(check)


async def unique_barcode() -> str:
    for _ in range(25):
        bc = gen_ean13()
        if not await db.barang.find_one({"barcode": bc}):
            return bc
    return gen_ean13()


@api_router.get("/barang/lookup")
async def barang_lookup(code: str, request: Request):
    user = await get_current_user(request)
    code = code.strip()
    b = await db.barang.find_one({"$or": [{"barcode": code}, {"kode": code}]})
    if not b:
        raise HTTPException(status_code=404, detail="Barang tidak ditemukan")
    if user.get("role") == "employee":
        return {"id": b["_id"], "kode": b["kode"], "nama": b["nama"], "barcode": b.get("barcode", ""),
                "kategori": b.get("kategori", ""), "lokasi_rak": b.get("lokasi_rak", "")}
    return barang_public(b)


@api_router.get("/barang")
async def list_barang(admin: dict = Depends(require_admin)):
    items = await db.barang.find().sort("nama", 1).to_list(5000)
    return [barang_public(b) for b in items]


@api_router.get("/barang/kategori")
async def list_kategori(admin: dict = Depends(require_admin)):
    cats = await db.barang.distinct("kategori")
    return sorted([c for c in cats if c])


@api_router.post("/barang")
async def create_barang(data: BarangInput, admin: dict = Depends(require_admin)):
    if await db.barang.find_one({"kode": data.kode}):
        raise HTTPException(status_code=400, detail="Kode barang sudah ada")
    payload = data.model_dump()
    bc = (payload.get("barcode") or "").strip()
    if bc:
        if await db.barang.find_one({"barcode": bc}):
            raise HTTPException(status_code=400, detail="Barcode sudah digunakan")
    else:
        bc = await unique_barcode()
    payload["barcode"] = bc
    doc = {"_id": str(uuid.uuid4()), **payload, "created_at": now_iso(), "updated_at": now_iso()}
    await db.barang.insert_one(doc)
    return barang_public(doc)


@api_router.put("/barang/{barang_id}")
async def update_barang(barang_id: str, data: BarangInput, admin: dict = Depends(require_admin)):
    b = await db.barang.find_one({"_id": barang_id})
    if not b:
        raise HTTPException(status_code=404, detail="Barang tidak ditemukan")
    dup = await db.barang.find_one({"kode": data.kode, "_id": {"$ne": barang_id}})
    if dup:
        raise HTTPException(status_code=400, detail="Kode barang sudah ada")
    payload = data.model_dump()
    bc = (payload.get("barcode") or "").strip()
    if bc:
        if await db.barang.find_one({"barcode": bc, "_id": {"$ne": barang_id}}):
            raise HTTPException(status_code=400, detail="Barcode sudah digunakan")
    else:
        bc = b.get("barcode") or await unique_barcode()
    payload["barcode"] = bc
    await db.barang.update_one({"_id": barang_id},
                               {"$set": {**payload, "updated_at": now_iso()}})
    return barang_public(await db.barang.find_one({"_id": barang_id}))


@api_router.delete("/barang/{barang_id}")
async def delete_barang(barang_id: str, admin: dict = Depends(require_admin)):
    if not await db.barang.find_one({"_id": barang_id}):
        raise HTTPException(status_code=404, detail="Barang tidak ditemukan")
    await db.barang.delete_one({"_id": barang_id})
    await db.tugas.delete_many({"barang_id": barang_id})
    return {"message": "Barang dihapus"}


# ------------------------------------------------------------------ barang masuk (admin)
@api_router.get("/barang-masuk")
async def list_barang_masuk(admin: dict = Depends(require_admin)):
    rows = await db.barang_masuk.find().sort("created_at", -1).to_list(2000)
    return [{"id": r["_id"], "kode": r["kode"], "nama": r["nama"], "kategori": r.get("kategori", ""),
             "jumlah": r["jumlah"], "lokasi_rak": r["lokasi_rak"],
             "tanggal_masuk": r.get("tanggal_masuk", ""), "supplier": r.get("supplier", ""),
             "keterangan": r.get("keterangan", ""), "created_at": r.get("created_at", "")} for r in rows]


@api_router.post("/barang-masuk")
async def create_barang_masuk(data: BarangMasukInput, admin: dict = Depends(require_admin)):
    doc = {"_id": str(uuid.uuid4()), **data.model_dump(),
           "tanggal_masuk": data.tanggal_masuk or now_iso(),
           "created_by": admin["name"], "created_at": now_iso()}
    await db.barang_masuk.insert_one(doc)

    # update master: rack location + stock, create item if not exist
    existing = await db.barang.find_one({"kode": data.kode})
    if existing:
        await db.barang.update_one({"_id": existing["_id"]}, {"$set": {
            "lokasi_rak": data.lokasi_rak, "updated_at": now_iso()},
            "$inc": {"stok_sistem": data.jumlah}})
    else:
        bc = (data.barcode or "").strip() or await unique_barcode()
        await db.barang.insert_one({"_id": str(uuid.uuid4()), "kode": data.kode, "nama": data.nama,
                                    "kategori": data.kategori, "lokasi_rak": data.lokasi_rak,
                                    "barcode": bc, "stok_sistem": data.jumlah, "stok_minimum": 0,
                                    "created_at": now_iso(), "updated_at": now_iso()})
    return {"id": doc["_id"], "message": "Barang masuk dicatat & master diperbarui"}


# ------------------------------------------------------------------ penugasan (admin)
async def build_tugas_admin(t: dict) -> dict:
    b = await db.barang.find_one({"_id": t["barang_id"]}) or {}
    emp = await db.users.find_one({"_id": t["employee_id"]}) or {}
    return {"id": t["_id"], "barang_id": t["barang_id"], "employee_id": t["employee_id"],
            "employee_name": emp.get("name", "-"),
            "barcode": b.get("barcode", ""),
            "kode": b.get("kode", "-"), "nama": b.get("nama", "-"), "kategori": b.get("kategori", ""),
            "lokasi_rak": b.get("lokasi_rak", ""), "stok_sistem": b.get("stok_sistem", 0),
            "stok_minimum": b.get("stok_minimum", 0),
            "status": t.get("status", "belum_dicek"), "stok_fisik": t.get("stok_fisik"),
            "catatan": t.get("catatan", ""), "checked_at": t.get("checked_at", "")}


@api_router.get("/penugasan")
async def list_penugasan(admin: dict = Depends(require_admin)):
    rows = await db.tugas.find().sort("created_at", -1).to_list(10000)
    return [await build_tugas_admin(t) for t in rows]


@api_router.post("/penugasan")
async def create_penugasan(data: AssignInput, admin: dict = Depends(require_admin)):
    if not await db.barang.find_one({"_id": data.barang_id}):
        raise HTTPException(status_code=404, detail="Barang tidak ditemukan")
    if not await db.users.find_one({"_id": data.employee_id, "role": "employee"}):
        raise HTTPException(status_code=404, detail="Karyawan tidak ditemukan")
    if await db.tugas.find_one({"barang_id": data.barang_id, "employee_id": data.employee_id}):
        raise HTTPException(status_code=400, detail="Barang sudah ditugaskan ke karyawan ini")
    doc = {"_id": str(uuid.uuid4()), "barang_id": data.barang_id, "employee_id": data.employee_id,
           "assigned_by": admin["_id"], "status": "belum_dicek", "stok_fisik": None,
           "catatan": "", "checked_at": "", "created_at": now_iso()}
    await db.tugas.insert_one(doc)
    return await build_tugas_admin(doc)


@api_router.delete("/penugasan/{tugas_id}")
async def delete_penugasan(tugas_id: str, admin: dict = Depends(require_admin)):
    if not await db.tugas.find_one({"_id": tugas_id}):
        raise HTTPException(status_code=404, detail="Tugas tidak ditemukan")
    await db.tugas.delete_one({"_id": tugas_id})
    return {"message": "Penugasan dihapus"}


# ------------------------------------------------------------------ employee tasks (BLIND — no system stock)
@api_router.get("/my-tasks")
async def my_tasks(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "employee":
        raise HTTPException(status_code=403, detail="Khusus karyawan")
    rows = await db.tugas.find({"employee_id": user["_id"]}).sort("created_at", -1).to_list(5000)
    out = []
    for t in rows:
        b = await db.barang.find_one({"_id": t["barang_id"]}) or {}
        # BLIND: stok_sistem & stok_minimum are intentionally excluded
        out.append({"id": t["_id"], "barcode": b.get("barcode", ""), "kode": b.get("kode", "-"), "nama": b.get("nama", "-"),
                    "kategori": b.get("kategori", ""), "lokasi_rak": b.get("lokasi_rak", ""),
                    "status": t.get("status", "belum_dicek"), "stok_fisik": t.get("stok_fisik"),
                    "catatan": t.get("catatan", ""), "checked_at": t.get("checked_at", "")})
    return out


@api_router.post("/my-tasks/{tugas_id}/check")
async def submit_check(tugas_id: str, data: CheckInput, request: Request):
    user = await get_current_user(request)
    if user.get("role") != "employee":
        raise HTTPException(status_code=403, detail="Khusus karyawan")
    t = await db.tugas.find_one({"_id": tugas_id, "employee_id": user["_id"]})
    if not t:
        raise HTTPException(status_code=404, detail="Tugas tidak ditemukan")
    if data.stok_fisik < 0:
        raise HTTPException(status_code=400, detail="Stok fisik tidak boleh negatif")
    await db.tugas.update_one({"_id": tugas_id}, {"$set": {
        "stok_fisik": data.stok_fisik, "catatan": data.catatan,
        "status": "dicek", "checked_at": now_iso()}})
    return {"message": "Hasil cek tersimpan"}


# ------------------------------------------------------------------ admin summary
@api_router.get("/summary")
async def summary(admin: dict = Depends(require_admin), employee_id: Optional[str] = None):
    tugas_q = {}
    if employee_id and employee_id != "all":
        tugas_q["employee_id"] = employee_id
    tugas = await db.tugas.find(tugas_q).to_list(20000)

    barang_map = {b["_id"]: b for b in await db.barang.find().to_list(10000)}
    emp_map = {u["_id"]: u for u in await db.users.find({"role": "employee"}).to_list(1000)}

    def enrich(t):
        b = barang_map.get(t["barang_id"], {})
        emp = emp_map.get(t["employee_id"], {})
        sistem = b.get("stok_sistem", 0)
        fisik = t.get("stok_fisik")
        variance = (fisik - sistem) if (fisik is not None) else None
        return {"id": t["_id"], "barcode": b.get("barcode", ""), "kode": b.get("kode", "-"), "nama": b.get("nama", "-"),
                "kategori": b.get("kategori", ""), "lokasi_rak": b.get("lokasi_rak", ""),
                "stok_sistem": sistem, "stok_minimum": b.get("stok_minimum", 0),
                "stok_fisik": fisik, "variance": variance, "catatan": t.get("catatan", ""),
                "status": t.get("status", "belum_dicek"), "checked_at": t.get("checked_at", ""),
                "employee_id": t["employee_id"], "employee_name": emp.get("name", "-")}

    rows = [enrich(t) for t in tugas]
    checked = [r for r in rows if r["status"] == "dicek"]

    overview = {
        "total_assigned": len(rows),
        "total_checked": len(checked),
        "total_unchecked": len([r for r in rows if r["status"] != "dicek"]),
        "total_discrepancy": len([r for r in checked if r["variance"] not in (None, 0)]),
    }

    # per-employee breakdown (always across all employees, ignores employee filter for context)
    all_tugas = await db.tugas.find().to_list(20000)
    breakdown = []
    for eid, emp in emp_map.items():
        et = [t for t in all_tugas if t["employee_id"] == eid]
        ec = [t for t in et if t.get("status") == "dicek"]
        disc = 0
        for t in ec:
            b = barang_map.get(t["barang_id"], {})
            if t.get("stok_fisik") is not None and t["stok_fisik"] != b.get("stok_sistem", 0):
                disc += 1
        breakdown.append({"employee_id": eid, "employee_name": emp.get("name", "-"),
                          "username": emp.get("username", ""),
                          "assigned": len(et), "checked": len(ec),
                          "unchecked": len(et) - len(ec), "discrepancy": disc})
    breakdown.sort(key=lambda x: x["employee_name"])

    unchecked = [r for r in rows if r["status"] != "dicek"]
    out_of_stock = [r for r in checked if r["stok_fisik"] == 0]
    low_stock = [r for r in checked if r["stok_fisik"] is not None and 0 < r["stok_fisik"] <= r["stok_minimum"]]
    discrepancies = [r for r in checked if r["variance"] not in (None, 0)]

    return {"overview": overview, "breakdown": breakdown, "unchecked": unchecked,
            "out_of_stock": out_of_stock, "low_stock": low_stock, "discrepancies": discrepancies}


# ------------------------------------------------------------------ sales (penjualan)
def parse_sales_text(raw: str):
    rows = []
    for idx, line in enumerate(raw.splitlines()):
        if not line.strip():
            continue
        parts = line.split("\t") if "\t" in line else line.split(",")
        parts = [p.strip() for p in parts]
        if idx == 0 and parts and parts[0].lower() in ("barcode", "sku", "kode"):
            continue
        rows.append(parts)
    return rows


def _parse_price(raw: str) -> float:
    raw = (raw or "").strip()
    if not raw:
        return 0.0
    raw = raw.replace("Rp", "").replace(" ", "")
    if "," in raw and "." in raw:
        raw = raw.replace(".", "").replace(",", ".")
    elif "," in raw:
        raw = raw.replace(",", ".")
    return float(raw)


@api_router.post("/sales/preview")
async def sales_preview(data: SalesPreviewInput, admin: dict = Depends(require_admin)):
    parsed = parse_sales_text(data.raw)
    out = []
    for i, parts in enumerate(parsed):
        code = parts[0] if len(parts) > 0 else ""
        nama = parts[1] if len(parts) > 1 else ""
        qty_raw = parts[2] if len(parts) > 2 else ""
        price_raw = parts[3] if len(parts) > 3 else ""
        tanggal = parts[4] if len(parts) > 4 else ""
        catatan = parts[5] if len(parts) > 5 else ""
        errors = []
        try:
            qty = int(float(qty_raw))
            if qty <= 0:
                errors.append("Qty harus > 0")
        except Exception:
            qty = 0
            errors.append("Qty tidak valid")
        try:
            price = _parse_price(price_raw)
        except Exception:
            price = 0.0
            errors.append("Harga tidak valid")
        b = await db.barang.find_one({"$or": [{"barcode": code}, {"kode": code}]}) if code else None
        if not code:
            errors.append("Barcode/SKU kosong")
        elif not b:
            errors.append("Produk tidak terdaftar")
        if not errors:
            status = "ok"
        elif b is None and code:
            status = "not_found"
        else:
            status = "invalid"
        out.append({"row": i + 1, "code": code,
                    "barcode": (b or {}).get("barcode", "") or code,
                    "kode": (b or {}).get("kode", ""), "input_nama": nama,
                    "nama": (b or {}).get("nama", nama), "qty": qty, "price": price,
                    "tanggal": tanggal, "catatan": catatan, "barang_id": (b or {}).get("_id"),
                    "stok_sistem": (b or {}).get("stok_sistem"), "matched": b is not None,
                    "status": status, "errors": errors})
    valid = len([r for r in out if r["status"] == "ok"])
    return {"rows": out, "total": len(out), "valid": valid, "invalid": len(out) - valid}


@api_router.post("/sales")
async def sales_confirm(data: SalesConfirmInput, admin: dict = Depends(require_admin)):
    saved, skipped = 0, []
    for r in data.rows:
        code = r.barcode.strip()
        b = await db.barang.find_one({"$or": [{"barcode": code}, {"kode": code}]}) if code else None
        if not b or r.qty <= 0:
            skipped.append(code)
            continue
        total = round(r.qty * r.price, 2)
        await db.sales.insert_one({"_id": str(uuid.uuid4()), "barcode": b.get("barcode", ""),
                                   "kode": b["kode"], "nama": b["nama"], "qty": r.qty, "price": r.price,
                                   "total": total, "tanggal": r.tanggal or now_iso(), "catatan": r.catatan,
                                   "created_by": admin["name"], "created_at": now_iso()})
        await db.barang.update_one({"_id": b["_id"]},
                                   {"$inc": {"stok_sistem": -r.qty}, "$set": {"updated_at": now_iso()}})
        saved += 1
    return {"saved": saved, "skipped": skipped, "message": f"{saved} transaksi penjualan tersimpan"}


@api_router.get("/sales")
async def list_sales(admin: dict = Depends(require_admin)):
    rows = await db.sales.find().sort("created_at", -1).to_list(2000)
    return [{"id": r["_id"], "barcode": r.get("barcode", ""), "kode": r["kode"], "nama": r["nama"],
             "qty": r["qty"], "price": r.get("price", 0), "total": r.get("total", 0),
             "tanggal": r.get("tanggal", ""), "catatan": r.get("catatan", ""),
             "created_by": r.get("created_by", ""), "created_at": r.get("created_at", "")} for r in rows]


# ------------------------------------------------------------------ seeding
async def seed():
    admin_username = os.environ.get("ADMIN_USERNAME", "admin").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    admin_email = os.environ.get("ADMIN_EMAIL", "")

    existing = await db.users.find_one({"username": admin_username})
    if not existing:
        await db.users.insert_one({"_id": str(uuid.uuid4()), "username": admin_username,
                                   "password_hash": hash_password(admin_password), "name": "Administrator",
                                   "role": "admin", "email": admin_email, "token_version": 0,
                                   "created_at": now_iso()})
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"_id": existing["_id"]},
                                  {"$set": {"password_hash": hash_password(admin_password),
                                            "email": admin_email}})

    # demo employees
    demo_emps = [("budi", "Budi Santoso"), ("dedi", "Dedi Kurniawan"), ("siti", "Siti Aminah")]
    emp_ids = {}
    for uname, name in demo_emps:
        u = await db.users.find_one({"username": uname})
        if not u:
            uid = str(uuid.uuid4())
            await db.users.insert_one({"_id": uid, "username": uname,
                                       "password_hash": hash_password("user123"), "name": name,
                                       "role": "employee", "email": "", "token_version": 0,
                                       "created_at": now_iso()})
            emp_ids[uname] = uid
        else:
            emp_ids[uname] = u["_id"]

    # demo barang + tugas only if empty
    if await db.barang.count_documents({}) == 0:
        items = [
            ("MNM-001", "Air Mineral 600ml", "Minuman", "R1-A2", 120, 30),
            ("MNM-002", "Teh Kotak 250ml", "Minuman", "R1-A3", 8, 20),
            ("MNM-003", "Kopi Sachet Box", "Minuman", "R1-B1", 0, 15),
            ("MKN-001", "Mie Instan Goreng", "Makanan", "R2-C1", 200, 50),
            ("MKN-002", "Biskuit Kaleng", "Makanan", "R2-C2", 12, 25),
            ("MKN-003", "Snack Kentang", "Makanan", "R2-C3", 45, 20),
            ("ATK-001", "Pulpen Hitam", "ATK", "R3-D1", 300, 100),
            ("ATK-002", "Buku Tulis 58lbr", "ATK", "R3-D2", 5, 40),
            ("ATK-003", "Kertas A4 Rim", "ATK", "R3-D3", 60, 20),
            ("ELK-001", "Baterai AA 4pcs", "Elektronik", "R4-E1", 80, 30),
            ("ELK-002", "Lampu LED 12W", "Elektronik", "R4-E2", 0, 10),
            ("ELK-003", "Kabel USB-C", "Elektronik", "R4-E3", 25, 15),
            ("HSH-001", "Sabun Cair 1L", "Kebersihan", "R5-F1", 40, 20),
            ("HSH-002", "Tisu Gulung 12s", "Kebersihan", "R5-F2", 18, 24),
            ("HSH-003", "Pembersih Lantai", "Kebersihan", "R5-F3", 7, 10),
        ]
        barang_ids = []
        for kode, nama, kat, rak, stok, minimum in items:
            bid = str(uuid.uuid4())
            await db.barang.insert_one({"_id": bid, "kode": kode, "nama": nama, "kategori": kat,
                                        "lokasi_rak": rak, "stok_sistem": stok, "stok_minimum": minimum,
                                        "created_at": now_iso(), "updated_at": now_iso()})
            barang_ids.append((bid, stok))

        # assignments: distribute across 3 employees
        emp_list = [emp_ids["budi"], emp_ids["dedi"], emp_ids["siti"]]
        # checked results: (index -> physical stock) to create discrepancy / out-of-stock / low-stock
        checked_results = {
            0: (118, "Sesuai rak"),        # small discrepancy
            1: (8, ""),                    # low stock (min 20)
            2: (0, "Stok habis di rak"),   # out of stock
            3: (200, ""),                  # no discrepancy
            4: (10, "2 rusak"),            # low stock discrepancy
            6: (295, "Selisih 5"),         # discrepancy
            7: (5, ""),                    # low stock
            10: (0, "Kosong"),             # out of stock
        }
        for idx, (bid, stok) in enumerate(barang_ids):
            eid = emp_list[idx % 3]
            tid = str(uuid.uuid4())
            doc = {"_id": tid, "barang_id": bid, "employee_id": eid, "assigned_by": "seed",
                   "status": "belum_dicek", "stok_fisik": None, "catatan": "", "checked_at": "",
                   "created_at": now_iso()}
            if idx in checked_results:
                fisik, note = checked_results[idx]
                doc.update({"status": "dicek", "stok_fisik": fisik, "catatan": note,
                            "checked_at": now_iso()})
            await db.tugas.insert_one(doc)

    # write test credentials
    try:
        cred = f"""# Test Credentials

## Admin
- URL Login: {os.environ.get('FRONTEND_URL','')}/login
- Username: `{admin_username}`
- Password: `{admin_password}`
- Role: admin
- Owner email on account: {admin_email}

## Karyawan (Employee) demo accounts
- Username: `budi` / Password: `user123` (Budi Santoso)
- Username: `dedi` / Password: `user123` (Dedi Kurniawan)
- Username: `siti` / Password: `user123` (Siti Aminah)

## Auth endpoints
- POST /api/auth/login  {{username, password}}
- POST /api/auth/logout
- GET  /api/auth/me
- POST /api/auth/refresh

## Notes
- Login is username-based (case-insensitive). Employees are managed by admin (create/reset via /api/users).
- Blind count: /api/my-tasks NEVER returns stok_sistem / stok_minimum.
"""
        Path("/app/memory/test_credentials.md").write_text(cred)
    except Exception as e:
        logger.warning(f"could not write test_credentials.md: {e}")


@app.on_event("startup")
async def startup():
    await db.users.create_index("username", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.barang.create_index("kode", unique=True)
    await db.barang.create_index("barcode")
    await db.tugas.create_index("employee_id")
    await seed()
    async for b in db.barang.find({"$or": [{"barcode": {"$exists": False}}, {"barcode": ""}]}):
        await db.barang.update_one({"_id": b["_id"]}, {"$set": {"barcode": await unique_barcode()}})


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[os.environ.get("FRONTEND_URL", "http://localhost:3000")],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
