# 天文馆:J2000 星表按当日历元岁差 + 黄→赤转换用当日真黄赤交角(T-203);前后端同公式同系数。
import math
import sys
import pathlib

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from websrv import webplanetariumsrv as srv  # noqa: E402


def test_precess_meeus_21b_theta_persei():
    # Meeus《天文算法》例 21.b:θ Persei 施自行后 J2000 α=41.054063° δ=+49.227750° → 2028-11-13.19(JD 2462088.69)
    ra, decl = srv._precess_j2000_to_date(2462088.69, 41.054063, 49.227750)
    assert abs(ra - 41.547214) < 1e-3
    assert abs(decl - 49.348483) < 1e-3


def test_precess_identity_at_j2000():
    ra, decl = srv._precess_j2000_to_date(2451545.0, 201.2983, -11.1614)
    assert abs(ra - 201.2983) < 1e-9 and abs(decl + 11.1614) < 1e-9


def test_precess_matches_frontend_formula_year_1000():
    # 公元 1000 年角宿一:岁差量级十几度(全站扫描抓到的「同屏两套历元」差值同量级),且与前端同公式
    ra, _ = srv._precess_j2000_to_date(2086308.0, 201.2983, -11.1614)
    assert 10 < abs(ra - 201.2983) < 16


def test_ecl_to_eq_of_date_uses_true_obliquity():
    jd = 2461041.5  # 2026-01-01
    eps = srv._true_obliquity_deg(jd)
    assert 23.43 < eps < 23.45
    ra0, dec0 = srv._ecl_to_eq_of_date(jd, 0.0, 0.0)
    assert abs(ra0) < 1e-6 or abs(ra0 - 360) < 1e-6
    assert abs(dec0) < 1e-6
    ra90, dec90 = srv._ecl_to_eq_of_date(jd, 90.0, 0.0)
    assert abs(ra90 - 90.0) < 1e-6
    assert abs(dec90 - eps) < 1e-6   # 黄经 90° 的赤纬 = 当日真黄赤交角,而非固定 23.44°
