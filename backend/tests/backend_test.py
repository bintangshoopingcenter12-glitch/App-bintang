"""Backend tests for Stock Checking Module (Cek Stok)."""
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


@pytest.fixture(scope="session")
def admin_session():
    return _session("admin", "admin123")


@pytest.fixture(scope="session")
def budi_session():
    return _session("budi", "user123")


# ---------------------------- AUTH
class TestAuth:
    def test_admin_login(self, admin_session):
        r = admin_session.get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json()["role"] == "admin"

    def test_employee_login(self, budi_session):
        r = budi_session.get(f"{API}/auth/me")
        assert r.status_code == 200
        d = r.json()
        assert d["role"] == "employee"
        assert d["username"] == "budi"

    def test_invalid_login(self):
        r = requests.post(f"{API}/auth/login", json={"username": "admin", "password": "wrong"})
        assert r.status_code == 401

    def test_unauth_me(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401


# ---------------------------- RBAC
class TestRBAC:
    def test_employee_forbidden_summary(self, budi_session):
        r = budi_session.get(f"{API}/summary")
        assert r.status_code == 403

    def test_employee_forbidden_barang(self, budi_session):
        r = budi_session.get(f"{API}/barang")
        assert r.status_code == 403

    def test_employee_forbidden_users(self, budi_session):
        r = budi_session.get(f"{API}/users")
        assert r.status_code == 403

    def test_admin_forbidden_my_tasks(self, admin_session):
        r = admin_session.get(f"{API}/my-tasks")
        assert r.status_code == 403


# ---------------------------- BLIND COUNT
class TestBlindCount:
    def test_my_tasks_no_stok_sistem(self, budi_session):
        r = budi_session.get(f"{API}/my-tasks")
        assert r.status_code == 200
        tasks = r.json()
        assert isinstance(tasks, list) and len(tasks) > 0
        for t in tasks:
            assert "stok_sistem" not in t
            assert "stok_minimum" not in t
            for f in ("kode", "nama", "kategori", "lokasi_rak"):
                assert f in t

    def test_employee_can_submit_check(self, budi_session):
        tasks = budi_session.get(f"{API}/my-tasks").json()
        unchecked = [t for t in tasks if t["status"] != "dicek"]
        if not unchecked:
            pytest.skip("No unchecked tasks")
        tid = unchecked[0]["id"]
        r = budi_session.post(f"{API}/my-tasks/{tid}/check",
                              json={"stok_fisik": 42, "catatan": "TEST_check"})
        assert r.status_code == 200
        # Verify status flipped
        tasks2 = budi_session.get(f"{API}/my-tasks").json()
        found = [t for t in tasks2 if t["id"] == tid][0]
        assert found["status"] == "dicek"
        assert found["stok_fisik"] == 42


# ---------------------------- MASTER BARANG CRUD
class TestMasterBarang:
    def test_crud_barang(self, admin_session):
        kode = f"TEST-{uuid.uuid4().hex[:6].upper()}"
        # CREATE
        r = admin_session.post(f"{API}/barang", json={
            "kode": kode, "nama": "TEST Item", "kategori": "Test",
            "lokasi_rak": "R9-Z9", "stok_sistem": 10, "stok_minimum": 2})
        assert r.status_code == 200, r.text
        bid = r.json()["id"]
        # READ (list & find)
        items = admin_session.get(f"{API}/barang").json()
        assert any(b["id"] == bid for b in items)
        # UPDATE
        r = admin_session.put(f"{API}/barang/{bid}", json={
            "kode": kode, "nama": "TEST Item Updated", "kategori": "Test",
            "lokasi_rak": "R9-Z9", "stok_sistem": 10, "stok_minimum": 2})
        assert r.status_code == 200
        assert r.json()["nama"] == "TEST Item Updated"
        # DELETE
        r = admin_session.delete(f"{API}/barang/{bid}")
        assert r.status_code == 200
        items = admin_session.get(f"{API}/barang").json()
        assert not any(b["id"] == bid for b in items)


# ---------------------------- BARANG MASUK
class TestBarangMasuk:
    def test_inbound_updates_master(self, admin_session):
        items = admin_session.get(f"{API}/barang").json()
        target = items[0]
        before = target["stok_sistem"]
        new_rack = f"RTEST-{uuid.uuid4().hex[:4]}"
        r = admin_session.post(f"{API}/barang-masuk", json={
            "kode": target["kode"], "nama": target["nama"], "kategori": target["kategori"],
            "jumlah": 5, "lokasi_rak": new_rack, "supplier": "TEST_Supp", "keterangan": "TEST"})
        assert r.status_code == 200, r.text
        items2 = admin_session.get(f"{API}/barang").json()
        updated = [b for b in items2 if b["kode"] == target["kode"]][0]
        assert updated["stok_sistem"] == before + 5
        assert updated["lokasi_rak"] == new_rack

    def test_inbound_requires_rack(self, admin_session):
        r = admin_session.post(f"{API}/barang-masuk", json={
            "kode": "X-TEST-999", "nama": "x", "jumlah": 1})
        assert r.status_code == 422  # missing lokasi_rak


# ---------------------------- PENUGASAN
class TestPenugasan:
    def test_assign_and_delete(self, admin_session):
        # create a barang
        kode = f"TSTA-{uuid.uuid4().hex[:5].upper()}"
        b = admin_session.post(f"{API}/barang", json={
            "kode": kode, "nama": "TEST assign", "kategori": "Test",
            "lokasi_rak": "R1", "stok_sistem": 5, "stok_minimum": 1}).json()
        users = admin_session.get(f"{API}/users").json()
        emp = [u for u in users if u["role"] == "employee"][0]
        r = admin_session.post(f"{API}/penugasan",
                               json={"barang_id": b["id"], "employee_id": emp["id"]})
        assert r.status_code == 200
        tid = r.json()["id"]
        rows = admin_session.get(f"{API}/penugasan").json()
        assert any(t["id"] == tid for t in rows)
        # cleanup
        admin_session.delete(f"{API}/penugasan/{tid}")
        admin_session.delete(f"{API}/barang/{b['id']}")


# ---------------------------- USER MANAGEMENT
class TestUsers:
    def test_user_lifecycle(self, admin_session):
        uname = f"testu_{uuid.uuid4().hex[:6]}"
        r = admin_session.post(f"{API}/users", json={
            "username": uname, "password": "user123", "name": "TEST User", "role": "employee"})
        assert r.status_code == 200
        uid = r.json()["id"]
        # login as new user
        s = requests.Session()
        assert s.post(f"{API}/auth/login", json={"username": uname, "password": "user123"}).status_code == 200
        # reset password
        r = admin_session.put(f"{API}/users/{uid}", json={"password": "newpass123"})
        assert r.status_code == 200
        s2 = requests.Session()
        assert s2.post(f"{API}/auth/login", json={"username": uname, "password": "newpass123"}).status_code == 200
        # delete
        r = admin_session.delete(f"{API}/users/{uid}")
        assert r.status_code == 200


# ---------------------------- SUMMARY
class TestSummary:
    def test_summary_shape(self, admin_session):
        r = admin_session.get(f"{API}/summary")
        assert r.status_code == 200
        d = r.json()
        for k in ("overview", "breakdown", "unchecked", "out_of_stock", "low_stock", "discrepancies"):
            assert k in d
        ov = d["overview"]
        for k in ("total_assigned", "total_checked", "total_unchecked", "total_discrepancy"):
            assert k in ov

    def test_summary_filter_by_employee(self, admin_session):
        users = admin_session.get(f"{API}/users").json()
        emp = [u for u in users if u["role"] == "employee"][0]
        r = admin_session.get(f"{API}/summary", params={"employee_id": emp["id"]})
        assert r.status_code == 200


# ---------------------------- LOGOUT
class TestLogout:
    def test_logout_clears(self):
        s = _session("admin", "admin123")
        r = s.post(f"{API}/auth/logout")
        assert r.status_code == 200
        # After logout cookie deleted - me should be 401
        r2 = s.get(f"{API}/auth/me")
        assert r2.status_code == 401
