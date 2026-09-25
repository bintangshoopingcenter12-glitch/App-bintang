"""Tests for new features: bulk rack, exports, regression RBAC."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://inventory-alerts-24.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"username": "admin", "password": "admin123"})
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def employee_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"username": "budi", "password": "user123"})
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def sample_barcodes(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/barang", params={"limit": 5})
    assert r.status_code == 200
    data = r.json()
    items = data.get("items") if isinstance(data, dict) else data
    barcodes = [i.get("barcode") for i in items if i.get("barcode")]
    assert len(barcodes) >= 2, f"need 2 barcodes, got {barcodes}"
    return barcodes[:2]


# -------- Bulk Rack --------
class TestBulkRack:
    def test_set_rack_bulk_success(self, admin_session, sample_barcodes):
        new_rack = "TEST-RAK-A1"
        payload = {"lokasi_rak": new_rack, "codes": sample_barcodes + ["BOGUS_CODE_XYZ"]}
        r = admin_session.post(f"{BASE_URL}/api/barang/set-rack-bulk", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "updated" in data
        assert "not_found" in data
        assert data["updated"] >= 1
        assert "BOGUS_CODE_XYZ" in data["not_found"]

        # verify persistence
        r2 = admin_session.get(f"{BASE_URL}/api/barang/lookup", params={"code": sample_barcodes[0]})
        assert r2.status_code == 200
        assert r2.json().get("lokasi_rak") == new_rack

    def test_set_rack_bulk_employee_forbidden(self, employee_session, sample_barcodes):
        r = employee_session.post(
            f"{BASE_URL}/api/barang/set-rack-bulk",
            json={"lokasi_rak": "X", "codes": sample_barcodes[:1]},
        )
        assert r.status_code == 403


# -------- Exports --------
class TestExports:
    def test_barang_export_xlsx(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/barang/export")
        assert r.status_code == 200
        ct = r.headers.get("content-type", "")
        assert "spreadsheet" in ct or "xlsx" in ct or "officedocument" in ct, ct
        assert len(r.content) > 1000

    def test_barang_export_employee_forbidden(self, employee_session):
        r = employee_session.get(f"{BASE_URL}/api/barang/export")
        assert r.status_code == 403

    def test_summary_export_xlsx(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/summary/export", params={"format": "xlsx"})
        assert r.status_code == 200
        ct = r.headers.get("content-type", "")
        assert "spreadsheet" in ct or "officedocument" in ct, ct

    def test_summary_export_pdf(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/summary/export", params={"format": "pdf"})
        assert r.status_code == 200
        assert "pdf" in r.headers.get("content-type", "").lower()

    def test_summary_export_with_employee_filter(self, admin_session):
        # get an employee id
        ru = admin_session.get(f"{BASE_URL}/api/users")
        assert ru.status_code == 200
        users = ru.json()
        employees = [u for u in users if u.get("role") == "karyawan"]
        if not employees:
            pytest.skip("No employees found")
        emp_id = employees[0]["id"]
        r = admin_session.get(
            f"{BASE_URL}/api/summary/export",
            params={"format": "xlsx", "employee_id": emp_id},
        )
        assert r.status_code == 200

    def test_summary_export_employee_forbidden(self, employee_session):
        r = employee_session.get(f"{BASE_URL}/api/summary/export", params={"format": "xlsx"})
        assert r.status_code == 403


# -------- Regression --------
class TestRegression:
    def test_my_tasks_no_stok_sistem(self, employee_session):
        r = employee_session.get(f"{BASE_URL}/api/my-tasks")
        assert r.status_code == 200
        data = r.json()
        items = data if isinstance(data, list) else data.get("items", [])
        for it in items[:20]:
            assert "stok_sistem" not in it
            assert "stok_minimum" not in it
