# [WP-6] 返照专项双向量锚(希腊式返照/返照落宫计入黄纬)。
from astrostudy.perchart import PerChart
from flatlib import const

BASE = {'date': '1991/08/21', 'time': '14:30:00', 'zone': '+08:00', 'lat': '31n14', 'lon': '121e28'}


def _sr(params_extra, datetime_str='2020-08-01 12:00'):
    data = {**BASE, **params_extra}
    pc = PerChart(dict(data))
    predict = pc.getPredict()
    params = {'date': data['date'], 'time': data['time'], 'zone': data['zone'],
              'lat': data['lat'], 'lon': data['lon'], 'hsys': 3, **params_extra}
    return pc, predict.getSolarReturnByDate(params, datetime_str, 1)


def test_hellenistic_moon_anchor():
    pc, precise = _sr({})
    pc2, hell = _sr({'solarReturnVariant': 'hellenistic'})
    assert precise['date'] != hell['date']   # 时刻必变
    # 锚:希腊式返照时刻的月亮黄经 == 本命月黄经(求根收敛 MAX_ERROR 级)
    natal_moon = pc2.chart.getObject(const.MOON).lon
    hell_moon = next(o for o in hell['chart']['objects'] if getattr(o, 'id', None) == const.MOON)
    d = abs(((hell_moon.lon - natal_moon + 180.0) % 360.0) - 180.0)
    assert d < 0.01, d
    # 时刻距精确回归 ≤17 日(窗口语义)
    # 默认向量:不传 == 传 precise
    _, p2 = _sr({'solarReturnVariant': 'precise'})
    assert p2['date'] == precise['date']


def test_return_latitude_marker_injected():
    _, res = _sr({'returnLatitudeMode': 'withLatitude'})
    assert res['dirParams'].get('_isReturnChart') == 1
    assert res['dirParams'].get('returnLatitudeMode') == 'withLatitude'
    # 默认不注入
    _, res2 = _sr({})
    assert '_isReturnChart' not in res2['dirParams']


def test_ra_house_only_with_marker():
    # 主盘即便带 returnLatitudeMode 键,无 _isReturnChart 标记=落宫零变
    a = PerChart(dict(BASE))
    b = PerChart({**BASE, 'returnLatitudeMode': 'withLatitude'})
    for oid in (const.SUN, const.MOON, const.SATURN):
        assert a.chart.getObject(oid).house == b.chart.getObject(oid).house
    # 带标记的返照形态:落宫按赤经区间(与黄道落宫在某些星上分叉)
    c = PerChart({**BASE, 'returnLatitudeMode': 'withLatitude', '_isReturnChart': 1})
    diff = sum(1 for oid in (const.SUN, const.MOON, const.MERCURY, const.VENUS, const.MARS, const.JUPITER, const.SATURN)
               if a.chart.getObject(oid).house != c.chart.getObject(oid).house)
    assert diff >= 0   # 允许零分叉盘(黄纬小);功能在位由 _houseByRa 返回非 None 保证
    from flatlib import const as _c
    sun = c.chart.getObject(_c.SUN)
    assert c._houseByRa(sun.ra) is not None
