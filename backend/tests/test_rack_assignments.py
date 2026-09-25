"""Backend tests for RACK-BASED assignment feature + admin password change + blind count."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
API = f"{BASE_URL}/api"

NEW_ADMIN_PWD = "Bintang#Admin2026"


def _login(username, password):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"username": username, "password": password}, timeout=30)
    return s, r


@pytest.fixture(scope="session")
def admin_session():
    s, r = _login("admin", NEW_ADMIN_PWD)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="session")
def budi_session():
    s, r = _login("budi", "user123")
    assert r.status_code == 200, f"budi login failed: {r.status_code} {r.text}"
    return s


# ---------------------------- AUTH / PASSWORD ROTATION
class TestAuth:
    def test_new_admin_password_works(self, admin_session):
        r = admin_session.get(f"{API}/auth/me")
        assert r.status_code == 200 and r.json()["role"] == "admin"

    def test_old_admin_password_rejected(self):
        s, r = _login("admin", "admin123")
        # 401 = wrong password rejected; 429 = also rejected (brute-force lockout after prior tests)
        assert r.status_code in (401, 429), f"Old admin/admin123 must be rejected, got {r.status_code}"

    def test_invalid_password(self):
        s, r = _login("admin", "nope")
        assert r.status_code == 401


# ---------------------------- LOCATIONS / RAKS
class TestLocations:
    def test_list_locations_admin(self, admin_session):
        r = admin_session.get(f"{API}/locations")
        assert r.status_code == 200
        locs = r.json()
        assert isinstance(locs, list) and len(locs) >= 10
        codes = {l["kode_rak"] for l in locs}
        for expected in ["A1", "A2", "A3", "B1", "B2", "B3"]:
            assert expected in codes, f"Rak {expected} not seeded"
        first = locs[0]
        for k in ("kode_rak", "nama_rak", "zona", "kapasitas", "product_count"):
            assert k in first

    def test_zonas_endpoint(self, admin_session):
        r = admin_session.get(f"{API}/locations/zonas")
        assert r.status_code == 200
        zonas = r.json()
        assert "A" in zonas and "B" in zonas

    def test_employee_locations_forbidden(self, budi_session):
        r = budi_session.get(f"{API}/locations")
        assert r.status_code == 403


# ---------------------------- ASSIGNMENTS (admin)
class TestAssignments:
    def test_list_assignments(self, admin_session):
        r = admin_session.get(f"{API}/assignments")
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list) and len(rows) >= 6
        row = rows[0]
        for k in ("id", "user_id", "employee_name", "kode_rak", "shift", "tanggal",
                  "jenis_tugas", "status", "product_count", "done_count", "progress"):
            assert k in row
        assert row["status"] in ("pending", "progress", "done")

    def test_filters(self, admin_session):
        r = admin_session.get(f"{API}/assignments", params={"shift": "pagi"})
        assert r.status_code == 200
        for a in r.json():
            assert a["shift"] == "pagi"
        r = admin_session.get(f"{API}/assignments", params={"zona": "A"})
        assert r.status_code == 200
        for a in r.json():
            assert a["zona"] == "A"

    def test_dashboard(self, admin_session):
        r = admin_session.get(f"{API}/assignments/dashboard")
        assert r.status_code == 200
        d = r.json()
        for k in ("tanggal", "total_rak", "total_karyawan", "progress",
                  "pending_racks", "active", "per_zona"):
            assert k in d
        assert isinstance(d["per_zona"], list)

    def test_create_and_delete_assignment(self, admin_session):
        # find an unused rak+user+shift combo
        users = admin_session.get(f"{API}/users").json()
        emp = [u for u in users if u["role"] == "employee"][0]
        locs = admin_session.get(f"{API}/locations").json()
        existing = admin_session.get(f"{API}/assignments").json()
        used = {(a["user_id"], a["kode_rak"], a["shift"], a["tanggal"]) for a in existing}
        picked = None
        from datetime import date
        today = date.today().isoformat()
        for l in locs:
            for shift in ("pagi", "siang", "malam"):
                if (emp["id"], l["kode_rak"], shift, today) not in used:
                    picked = (l["kode_rak"], shift)
                    break
            if picked:
                break
        assert picked, "no unused rak/shift combo"
        payload = {"user_id": emp["id"], "kode_rak": picked[0], "shift": picked[1],
                   "tanggal": today, "jenis_tugas": "stock_check", "catatan": "TEST"}
        r = admin_session.post(f"{API}/assignments", json=payload)
        assert r.status_code == 200, r.text
        created = r.json()
        assert created["kode_rak"] == picked[0]
        aid = created["id"]
        # Duplicate should 400
        r2 = admin_session.post(f"{API}/assignments", json=payload)
        assert r2.status_code == 400
        # Delete
        rd = admin_session.delete(f"{API}/assignments/{aid}")
        assert rd.status_code == 200
        rows2 = admin_session.get(f"{API}/assignments").json()
        assert not any(a["id"] == aid for a in rows2)

    def test_create_bad_rak(self, admin_session):
        users = admin_session.get(f"{API}/users").json()
        emp = [u for u in users if u["role"] == "employee"][0]
        r = admin_session.post(f"{API}/assignments", json={
            "user_id": emp["id"], "kode_rak": "ZZZ99", "shift": "pagi",
            "jenis_tugas": "stock_check", "catatan": ""})
        assert r.status_code == 404

    def test_employee_forbidden_assignments(self, budi_session):
        r = budi_session.get(f"{API}/assignments")
        assert r.status_code == 403


# ---------------------------- EMPLOYEE MY-ASSIGNMENTS (blind)
class TestMyAssignments:
    def test_my_assignments_list(self, budi_session):
        r = budi_session.get(f"{API}/my-assignments")
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list) and len(rows) >= 1
        raks = {a["kode_rak"] for a in rows}
        # Budi should own A1 and A2 per seed
        assert "A1" in raks or "A2" in raks

    def test_products_blind_no_stok_sistem(self, budi_session):
        assigns = budi_session.get(f"{API}/my-assignments").json()
        assert assigns, "no assignments"
        aid = assigns[0]["id"]
        r = budi_session.get(f"{API}/my-assignments/{aid}/products")
        assert r.status_code == 200
        payload = r.json()
        assert "kode_rak" in payload and "items" in payload
        assert isinstance(payload["items"], list) and len(payload["items"]) > 0
        for it in payload["items"]:
            assert "stok_sistem" not in it, "BLIND VIOLATION: stok_sistem leaked to employee"
            assert "stok_minimum" not in it, "BLIND VIOLATION: stok_minimum leaked"
            for k in ("id", "kode", "nama", "lokasi_rak", "done"):
                assert k in it
            # every product must belong to this rack
            assert it["lokasi_rak"] == payload["kode_rak"]

    def test_mark_done_and_progress(self, budi_session):
        assigns = budi_session.get(f"{API}/my-assignments").json()
        target = None
        for a in assigns:
            if a["status"] != "done" and a["product_count"] > 0:
                target = a
                break
        if not target:
            pytest.skip("no non-done assignment")
        aid = target["id"]
        prods = budi_session.get(f"{API}/my-assignments/{aid}/products").json()["items"]
        undone = [p for p in prods if not p["done"]]
        if not undone:
            pytest.skip("nothing undone")
        pid = undone[0]["id"]
        before_done = target["done_count"]
        r = budi_session.post(f"{API}/my-assignments/{aid}/done",
                              json={"product_id": pid, "catatan": "TEST_done"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["done"] >= before_done + 1
        assert d["status"] in ("progress", "done")
        # verify status persisted
        assigns2 = budi_session.get(f"{API}/my-assignments").json()
        found = [a for a in assigns2 if a["id"] == aid][0]
        assert found["status"] in ("progress", "done")
        assert found["done_count"] >= before_done + 1

    def test_done_product_not_in_rack_rejected(self, budi_session):
        # Login admin to find a barang NOT in Budi's rak
        adm, _ = _login("admin", NEW_ADMIN_PWD)
        assigns = budi_session.get(f"{API}/my-assignments").json()
        my_racks = {a["kode_rak"] for a in assigns}
        all_barang = adm.get(f"{API}/barang").json()
        outsider = next((b for b in all_barang if b["lokasi_rak"] not in my_racks), None)
        assert outsider, "no barang outside budi's racks"
        aid = assigns[0]["id"]
        r = budi_session.post(f"{API}/my-assignments/{aid}/done",
                              json={"product_id": outsider["id"], "catatan": ""})
        assert r.status_code == 404

    def test_admin_forbidden_my_assignments(self, admin_session):
        r = admin_session.get(f"{API}/my-assignments")
        assert r.status_code == 403


# ---------------------------- SEARCH RAK / ZONA
class TestBarangSearchFilters:
    def test_search_by_rak(self, admin_session):
        r = admin_session.get(f"{API}/barang/search", params={"rak": "A1", "limit": 100})
        assert r.status_code == 200
        data = r.json()
        assert data["total"] > 0
        for it in data["items"]:
            assert it["lokasi_rak"] == "A1"

    def test_search_by_zona(self, admin_session):
        r = admin_session.get(f"{API}/barang/search", params={"zona": "A", "limit": 100})
        assert r.status_code == 200
        data = r.json()
        assert data["total"] > 0
        # All items belong to a rack in zona A
        locs = {l["kode_rak"] for l in admin_session.get(f"{API}/locations").json() if l["zona"] == "A"}
        for it in data["items"]:
            assert it["lokasi_rak"] in locs


# ---------------------------- CATCH-ALL
class TestCatchAll:
    def test_unknown_frontend_path_no_404_from_api(self):
        # /api/nonsense should 404, but frontend root should serve HTML/React app
        r = requests.get(f"{API}/does-not-exist")
        assert r.status_code in (404, 405)
        # Frontend catch-all: non-/api path returns 200 index.html
        r2 = requests.get(f"{BASE_URL}/some/deep/route", timeout=15)
        assert r2.status_code == 200
