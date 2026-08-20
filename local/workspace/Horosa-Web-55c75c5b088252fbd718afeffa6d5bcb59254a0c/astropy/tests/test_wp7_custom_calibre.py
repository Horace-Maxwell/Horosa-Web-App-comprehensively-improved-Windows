# [WP-7] 自定义界表 + 自定义恒星黄道双向量锚。
from astrostudy.perchart import PerChart, push_classical_request, pop_classical_request, _buildCustomTermsTable
from flatlib.dignities import essential
from flatlib import const

BASE = {'date': '1991/08/21', 'time': '14:30:00', 'zone': '+08:00', 'lat': '31n14', 'lon': '121e28'}
ROW_REV = [['saturn', 6], ['mars', 6], ['venus', 8], ['mercury', 5], ['jupiter', 5]]
DAY_REV = [ROW_REV] * 12


def test_custom_terms_push_and_fallback():
    t = push_classical_request({**BASE, 'termsVariant': 4, 'customTermsDay': DAY_REV})
    try:
        assert essential.term('Aries', 3.0) == const.SATURN
    finally:
        pop_classical_request(t)
    assert essential.term('Aries', 3.0) == const.JUPITER   # 还原=埃及
    # 非法整表回落埃及(半表绝不上盘)
    bad = [ROW_REV[:4] + [['saturn', 99]]] * 12
    t2 = push_classical_request({**BASE, 'termsVariant': 4, 'customTermsDay': bad})
    try:
        assert essential.term('Aries', 3.0) == const.JUPITER
    finally:
        pop_classical_request(t2)


def test_custom_terms_night_table():
    night = [[['jupiter', 5], ['mercury', 5], ['venus', 8], ['mars', 6], ['saturn', 6]]] * 12
    data = {**BASE, 'time': '02:30:00', 'termsVariant': 4, 'customTermsDay': DAY_REV, 'customTermsNight': night}
    t = push_classical_request(dict(data))
    try:
        pc = PerChart(dict(data))
        assert pc.isDiurnal is False
        # 夜盘 setupPlanets 后 TERMS=夜表:白羊 3°=Jupiter(夜表首界)
        assert essential.term('Aries', 3.0) == const.JUPITER
    finally:
        pop_classical_request(t)


def test_builder_validation():
    assert _buildCustomTermsTable(DAY_REV) is not None
    assert _buildCustomTermsTable([ROW_REV] * 11) is None            # 缺座
    assert _buildCustomTermsTable([[['x', 30]] * 5] * 12) is None    # 星名非法
    assert _buildCustomTermsTable([[['saturn', 29], ['mars', 2], ['venus', 1], ['mercury', 1], ['jupiter', 1]]] * 12) is None  # 和≠30


def test_user_ayanamsa_modes():
    trop = PerChart(dict(BASE))
    usr = PerChart({**BASE, 'zodiacal': 1, 'siderealAyanamsa': 'user', 'userAyanT0': 2451545.0, 'userAyanDeg': 24.0})
    d = (trop.chart.getObject(const.SUN).lon - usr.chart.getObject(const.SUN).lon) % 360.0
    assert 23.5 < d < 24.5
    assert usr.siderealAyanamsa == 'user'
    # 参数缺失回落(不炸,回 47 档 normalize)
    bad = PerChart({**BASE, 'zodiacal': 1, 'siderealAyanamsa': 'user'})
    assert bad.chart is not None and bad.siderealAyanamsa != 'user'
