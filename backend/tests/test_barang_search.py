"""Tests for GET /api/barang/search (server-side search added for perf refactor)."""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
API = f"{BASE_URL}/api"


def _login(u, p):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"username": u, "password": p}, timeout=30)
    assert r.status_code == 200
    return s


@pytest.fixture(scope="module")
def admin():
    return _login("admin", "admin123")


@pytest.fixture(scope="module")
def emp():
    return _login("budi", "user123")


class TestBarangSearch:
    def test_shape_and_total(self, admin):
        r = admin.get(f"{API}/barang/search", params={"limit": 1})
        assert r.status_code == 200
        d = r.json()
        for k in ("items", "total", "page", "limit", "pages"):
            assert k in d, f"missing {k}"
        assert isinstance(d["items"], list)
        assert isinstance(d["total"], int)
        assert d["total"] > 0
        assert len(d["items"]) <= 1

    def test_dashboard_count_matches_full_list(self, admin):
        r = admin.get(f"{API}/barang/search", params={"limit": 1})
        total_search = r.json()["total"]
        r2 = admin.get(f"{API}/barang")
        assert r2.status_code == 200
        assert total_search == len(r2.json()), \
            f"search total {total_search} != list len {len(r2.json())}"

    def test_pagination_25(self, admin):
        p1 = admin.get(f"{API}/barang/search", params={"page": 1, "limit": 25}).json()
        p2 = admin.get(f"{API}/barang/search", params={"page": 2, "limit": 25}).json()
        assert len(p1["items"]) == 25
        assert p1["limit"] == 25
        assert p1["pages"] >= 2
        # different pages produce different first ids
        if p2["items"]:
            assert p1["items"][0]["id"] != p2["items"][0]["id"]

    def test_query_filter(self, admin):
        r = admin.get(f"{API}/barang/search", params={"q": "bolpen", "limit": 25})
        assert r.status_code == 200
        d = r.json()
        # every returned item must match on nama/kode/barcode (case-insensitive)
        for it in d["items"]:
            hay = " ".join([str(it.get("nama", "")), str(it.get("kode", "")),
                            str(it.get("barcode", ""))]).lower()
            assert "bolpen" in hay, f"mismatch: {it}"

    def test_kategori_filter(self, admin):
        cats = admin.get(f"{API}/barang/kategori").json()
        assert cats, "no kategori"
        kat = cats[0]
        r = admin.get(f"{API}/barang/search", params={"kategori": kat, "limit": 25})
        assert r.status_code == 200
        for it in r.json()["items"]:
            assert it["kategori"] == kat

    def test_all_kategori_keyword(self, admin):
        r_all = admin.get(f"{API}/barang/search", params={"kategori": "all", "limit": 1}).json()
        r_none = admin.get(f"{API}/barang/search", params={"limit": 1}).json()
        assert r_all["total"] == r_none["total"]

    def test_employee_forbidden(self, emp):
        r = emp.get(f"{API}/barang/search")
        assert r.status_code == 403

    def test_limit_cap(self, admin):
        r = admin.get(f"{API}/barang/search", params={"limit": 5000})
        assert r.status_code == 200
        assert r.json()["limit"] <= 100
