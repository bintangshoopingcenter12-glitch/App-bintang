import os, uuid, random
from datetime import datetime, timezone
from dotenv import load_dotenv
import openpyxl
from pymongo import MongoClient

load_dotenv("/app/backend/.env")
client = MongoClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]

def now_iso():
    return datetime.now(timezone.utc).isoformat()

used_barcodes = set()

def gen_ean13():
    while True:
        base = [random.randint(0, 9) for _ in range(12)]
        s = sum(base[i] * (1 if i % 2 == 0 else 3) for i in range(12))
        c = (10 - (s % 10)) % 10
        bc = "".join(map(str, base)) + str(c)
        if bc not in used_barcodes:
            return bc

def toint(x):
    try:
        return int(float(x))
    except Exception:
        return 0

wb = openpyxl.load_workbook("/app/scripts/produk-bintang.xlsx", read_only=True, data_only=True)
ws = wb.active
rows = list(ws.iter_rows(values_only=True))

used_kode = set()
docs = []
for r in rows[1:]:
    if not r or not r[2]:
        continue
    kode_raw, barcode_raw, nama, kategori, satuan, stok, hb, hj = (list(r) + [None] * 8)[:8]
    nama = str(nama).strip()

    kode = str(kode_raw).strip() if kode_raw not in (None, "") else ""
    if not kode:
        kode = "SKU-" + str(len(docs) + 1)
    base_kode, n = kode, 2
    while kode in used_kode:
        kode = f"{base_kode}-{n}"; n += 1
    used_kode.add(kode)

    kat = str(kategori).strip().upper() if kategori else ""
    if kat in ("PCS", "PACK", ""):
        kat = "LAINNYA"

    sat = str(satuan).strip() if satuan else "pcs"

    bc = str(barcode_raw).strip() if barcode_raw not in (None, "") else ""
    if (not bc) or (bc in used_barcodes):
        bc = gen_ean13()
    used_barcodes.add(bc)

    docs.append({"_id": str(uuid.uuid4()), "kode": kode, "barcode": bc, "nama": nama,
                 "kategori": kat, "satuan": sat, "lokasi_rak": "",
                 "stok_sistem": toint(stok), "stok_minimum": 0,
                 "harga_beli": toint(hb), "harga_jual": toint(hj),
                 "created_at": now_iso(), "updated_at": now_iso()})

db.tugas.delete_many({})
db.sales.delete_many({})
db.barang.delete_many({})
if docs:
    for i in range(0, len(docs), 1000):
        db.barang.insert_many(docs[i:i + 1000])

print("inserted barang:", db.barang.count_documents({}))
print("unique kode:", len(used_kode), "| unique barcode:", len(used_barcodes))
print("categories:", sorted(db.barang.distinct("kategori"))[:20])
print("sample:", db.barang.find_one({}, {"_id": 0, "kode": 1, "barcode": 1, "nama": 1, "kategori": 1, "harga_jual": 1, "satuan": 1}))
