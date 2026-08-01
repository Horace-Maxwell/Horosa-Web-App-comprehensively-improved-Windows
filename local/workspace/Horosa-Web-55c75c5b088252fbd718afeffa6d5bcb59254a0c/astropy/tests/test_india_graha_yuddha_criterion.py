# -*- coding: utf-8 -*-
"""W1-C:Graha Yuddha 胜负判据可选(latitude 默认=纬北者胜 / longitude=黄经小者胜)。
构造纬/经反向的 <1° 同宫对:两判据必须给出相反胜负;默认分支与现行为一致。"""


class _FakeObj:
    def __init__(self, oid, lon, lat, sign):
        self.id = oid
        self.lon = lon
        self.lat = lat
        self.sign = sign


class _FakeChart:
    def __init__(self, objs):
        self._objs = {o.id: o for o in objs}

    def get(self, oid):
        return self._objs.get(oid)

    def getObject(self, oid):
        return self._objs.get(oid)


def _engine_with(objs, criterion=None):
    from astrostudy.india.jyotish_engine import JyotishEngine
    eng = JyotishEngine.__new__(JyotishEngine)   # 绕过全量 __init__(仓内既有范式)
    eng.chart = _FakeChart(objs)
    if criterion is not None:
        eng.yuddha_criterion = criterion
    return eng


def _mk_pair():
    # 火星:黄经小、纬度南;水星:黄经大、纬度北 → 两判据胜者相反。
    mars = _FakeObj('Mars', 100.2, -1.0, 'Cancer')
    mercury = _FakeObj('Mercury', 100.8, 1.0, 'Cancer')
    return [mars, mercury]


def test_default_criterion_latitude_matches_legacy():
    eng = _engine_with(_mk_pair())            # 类级默认 latitude(不设实例属性)
    res = eng.graha_yuddha()
    assert res['available'] is True and res['criterion'] == 'latitude'
    assert res['pairs'][0]['winner'] == 'Mercury'   # 纬北者胜(现行为)


def test_longitude_criterion_flips_winner():
    res_lat = _engine_with(_mk_pair(), 'latitude').graha_yuddha()
    res_lon = _engine_with(_mk_pair(), 'longitude').graha_yuddha()
    assert res_lat['pairs'][0]['winner'] == 'Mercury'
    assert res_lon['pairs'][0]['winner'] == 'Mars'   # 黄经较小者胜 → 翻转
    assert res_lon['criterion'] == 'longitude'


def test_ctor_normalizes_bogus_criterion():
    from astrostudy.india.jyotish_engine import JyotishEngine
    from astrostudy.india.india_chart_kernel import IndiaChartKernel
    k = IndiaChartKernel({
        'date': '1990/05/15', 'time': '08:30:00', 'zone': '+08:00',
        'lat': 39.9042, 'lon': 116.4074, 'ad': 1,
        'tradition': False, 'predictive': False, 'zodiacal': 1,
        'siderealMode': 'lahiri', 'hsys': 0, 'name': 'gy', 'pos': '',
    })
    assert JyotishEngine(k, yuddha_criterion='bogus').yuddha_criterion == 'latitude'
    assert JyotishEngine(k, yuddha_criterion='longitude').yuddha_criterion == 'longitude'
    assert JyotishEngine(k, karaka_scheme='7').karaka_scheme == '7'
    assert JyotishEngine(k, karaka_scheme=None).karaka_scheme == '8'
