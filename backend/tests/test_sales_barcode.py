"""Backend tests for Sales module + Barcode features (iteration_2)."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://inventory-alerts-24.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"


def _session(username, password):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"username": username, "password": password}, timeout=30)
    assert r.status_code == 200, f"Login failed for {username}: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def admin():
    return _session("admin", "admin123")


@pytest.fixture(scope="module")
def budi():
    return _session("budi", "user123")


# ---------------------------- BARCODE on Master Barang
class TestBarcode:
    def test_all_barang_have_barcode(self, admin):
        items = admin.get(f"{API}/barang").json()
        assert len(items) > 0
        for b in items:
            assert b.get("barcode"), f"barang {b['kode']} missing barcode"
            assert len(b["barcode"]) == 13 and b["barcode"].isdigit(), f"non-EAN13 barcode {b['barcode']}"

    def test_create_barang_auto_barcode(self, admin):
        kode = f"TEST-{uuid.uuid4().hex[:6].upper()}"
        r = admin.post(f"{API}/barang", json={
            "kode": kode, "nama": "TEST auto barcode", "kategori": "Test",
            "lokasi_rak": "R1", "stok_sistem": 5, "stok_minimum": 1})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("barcode") and len(d["barcode"]) == 13 and d["barcode"].isdigit()
        admin.delete(f"{API}/barang/{d['id']}")

    def test_duplicate_barcode_rejected(self, admin):
        items = admin.get(f"{API}/barang").json()
        existing_bc = items[0]["barcode"]
        kode = f"TEST-{uuid.uuid4().hex[:6].upper()}"
        r = admin.post(f"{API}/barang", json={
            "kode": kode, "nama": "TEST dup", "kategori": "Test", "barcode": existing_bc,
            "lokasi_rak": "R1", "stok_sistem": 5, "stok_minimum": 1})
        assert r.status_code in (400, 409, 422), f"Expected reject, got {r.status_code}: {r.text}"

    def test_lookup_by_barcode_admin(self, admin):
        items = admin.get(f"{API}/barang").json()
        bc = items[0]["barcode"]
        r = admin.get(f"{API}/barang/lookup", params={"code": bc})
        assert r.status_code == 200
        d = r.json()
        assert d["kode"] == items[0]["kode"]
        assert "stok_sistem" in d  # admin sees stok

    def test_lookup_by_kode(self, admin):
        r = admin.get(f"{API}/barang/lookup", params={"code": "MKN-001"})
        assert r.status_code == 200
        assert r.json()["kode"] == "MKN-001"

    def test_lookup_employee_hides_stok(self, budi):
        r = budi.get(f"{API}/barang/lookup", params={"code": "MKN-001"})
        # Might be 200 (public info without stok) or 403 depending on impl
        if r.status_code == 200:
            d = r.json()
            assert "stok_sistem" not in d
            assert "stok_minimum" not in d


# ---------------------------- SALES /preview
class TestSalesPreview:
    def test_preview_mixed_rows(self, admin):
        items = admin.get(f"{API}/barang").json()
        valid_barcode = items[0]["barcode"]
        raw = "\n".join([
            f"{valid_barcode}\tItem A\t3\t5000",
            "MKN-001\tMakanan\t2\t3000",
            "9999999999999\tGhost\t1\t1000",
            f"{valid_barcode}\tItem A\tabc\t5000",
        ])
        r = admin.post(f"{API}/sales/preview", json={"raw": raw})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["total"] == 4
        statuses = [row["status"] for row in d["rows"]]
        assert statuses.count("ok") == 2
        assert "not_found" in statuses
        assert "invalid" in statuses
        assert d["valid"] == 2
        assert d["invalid"] == 2

    def test_preview_forbidden_employee(self, budi):
        r = budi.post(f"{API}/sales/preview", json={"raw": "x\t1\t1"})
        assert r.status_code == 403


# ---------------------------- SALES save
class TestSalesSave:
    def test_save_deducts_stock(self, admin):
        # Create a fresh barang so we know the exact stock
        kode = f"TSAL-{uuid.uuid4().hex[:5].upper()}"
        b = admin.post(f"{API}/barang", json={
            "kode": kode, "nama": "TEST sale item", "kategori": "Test",
            "lokasi_rak": "R1", "stok_sistem": 20, "stok_minimum": 1}).json()
        barcode = b["barcode"]
        before = 20

        r = admin.post(f"{API}/sales", json={"rows": [
            {"barcode": barcode, "nama": b["nama"], "qty": 3, "price": 5000}
        ]})
        assert r.status_code == 200, r.text
        # Verify stock decremented via GET /barang
        items = admin.get(f"{API}/barang").json()
        updated = [x for x in items if x["kode"] == kode][0]
        assert updated["stok_sistem"] == before - 3, f"Expected {before-3}, got {updated['stok_sistem']}"

        # Verify sale in list
        sales = admin.get(f"{API}/sales").json()
        assert any(s.get("kode") == kode and s["qty"] == 3 for s in sales)

        admin.delete(f"{API}/barang/{b['id']}")

    def test_sales_forbidden_employee(self, budi):
        r = budi.get(f"{API}/sales")
        assert r.status_code == 403
        r = budi.post(f"{API}/sales", json={"rows": []})
        assert r.status_code == 403


# ---------------------------- MY TASKS barcode field
class TestMyTasksBarcode:
    def test_my_tasks_has_barcode_no_stok(self, budi):
        tasks = budi.get(f"{API}/my-tasks").json()
        assert len(tasks) > 0
        for t in tasks:
            assert "barcode" in t
            assert t["barcode"], "empty barcode"
            assert "stok_sistem" not in t
            assert "stok_minimum" not in t


# ---------------------------- SUMMARY barcode
class TestSummaryBarcode:
    def test_summary_rows_include_barcode(self, admin):
        d = admin.get(f"{API}/summary").json()
        for section in ("unchecked", "out_of_stock", "low_stock", "discrepancies"):
            for row in d.get(section, []):
                assert "barcode" in row, f"section {section} missing barcode"
