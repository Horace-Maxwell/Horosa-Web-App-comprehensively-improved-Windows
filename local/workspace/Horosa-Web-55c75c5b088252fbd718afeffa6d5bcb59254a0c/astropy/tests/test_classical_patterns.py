# -*- coding: utf-8 -*-
"""WI-08 古典格局:护卫 doryphory / 优势相位 overcoming / 度数围攻 besieging-by-degree。
用合成盘(可控行星经度)各命中一例(plan 验收)。"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from astrostudy import astroextra


class _Obj(object):
    def __init__(self, oid, lon, sign):
        self.id = oid
        self.lon = float(lon)
        self.lat = 0.0
        self.sign = sign
        self.signlon = float(lon) % 30.0
        self.lonspeed = 1.0


class _Chart(object):
    def __init__(self, objs, diurnal):
        self.objects = objs
        self.angles = []
        self._d = diurnal
    def isDiurnal(self):
        return self._d


class _PC(object):
    def __init__(self, objs, diurnal=True):
        self.chart = _Chart(objs, diurnal)


SIGN = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces']


def _sign(lon):
    return SIGN[int((lon % 360) / 30) % 12]


def _o(oid, lon):
    return _Obj(oid, lon, _sign(lon))


def test_doryphory_hit():
    # 日盘:太阳 100°,木星(同宗)90°(日前 10°)→ 护卫命中。
    pc = _PC([_o('Sun', 100.0), _o('Jupiter', 90.0), _o('Moon', 200.0)], diurnal=True)
    cp = astroextra.compute_classical_patterns(pc)
    hits = [d for d in cp['doryphory'] if d['planet'] == 'Jupiter' and d['light'] == 'Sun']
    assert hits, cp['doryphory']
    assert -15.0 <= hits[0]['elong'] <= -7.0


def test_overcoming_square_hit():
    # 太阳摩羯(第10座自白羊起)凌驾火星白羊 → 右旋四分压制。
    pc = _PC([_o('Sun', 280.0), _o('Mars', 5.0)], diurnal=True)
    cp = astroextra.compute_classical_patterns(pc)
    hits = [d for d in cp['overcoming'] if d['over'] == 'Sun' and d['under'] == 'Mars']
    assert hits and hits[0]['aspect'] == 'square', cp['overcoming']


def test_besieging_by_degree_hit():
    # 金星 100°,火星 95°(左 -5°)、土星 105°(右 +5°),其间无他星 → 度数围攻命中。
    pc = _PC([_o('Venus', 100.0), _o('Mars', 95.0), _o('Saturn', 105.0), _o('Jupiter', 200.0)], diurnal=True)
    cp = astroextra.compute_classical_patterns(pc)
    hits = [d for d in cp['besieging'] if d['planet'] == 'Venus']
    assert hits, cp['besieging']
    assert set([hits[0]['left'], hits[0]['right']]) == set(['Mars', 'Saturn'])


def test_bonification_structure():
    """WI-12:每条至少含一项吉化或凶化;by 为吉/凶星。"""
    r = astroextra.analyze_chart({
        'date': '2025/03/01', 'time': '12:00:00', 'zone': '+00:00',
        'lat': '40N00', 'lon': '000E00', 'ad': 1, 'hsys': 'PLACIDUS',
    })
    bon = r['bonification']
    for b in bon:
        assert b['bonified'] or b['maltreated']
        for x in b['bonified']:
            assert x['by'] in ('Jupiter', 'Venus')
        for x in b['maltreated']:
            assert x['by'] in ('Saturn', 'Mars')


def test_accidental_dignity_structure():
    """WI-16:每星整数得分、降序、因子非空且含宫位项。"""
    r = astroextra.analyze_chart({
        'date': '2025/03/01', 'time': '12:00:00', 'zone': '+00:00',
        'lat': '40N00', 'lon': '000E00', 'ad': 1, 'hsys': 'PLACIDUS',
    })
    ad = r['accidentalDignity']
    assert len(ad) >= 6
    scores = [x['score'] for x in ad]
    assert scores == sorted(scores, reverse=True), '应按得分降序'
    for x in ad:
        assert isinstance(x['score'], int)
        assert isinstance(x['factors'], list) and x['factors']
    assert any(any('宫' in f for f in x['factors']) for x in ad), '应含角/续/果宫因子'


def test_aspect_dynamics_structure():
    """WI-10/11:相位动态含五子键;每相位标 入相/出相 + 右/左旋 + 托勒密角。"""
    r = astroextra.analyze_chart({
        'date': '2025/03/01', 'time': '12:00:00', 'zone': '+00:00',
        'lat': '40N00', 'lon': '000E00', 'ad': 1, 'hsys': 'PLACIDUS',
    })
    ad = r['aspectDynamics']
    for k in ('aspects', 'translation', 'collection', 'aversion', 'bending'):
        assert k in ad, k
    for a in ad['aspects']:
        assert a['aspect'] in (0, 60, 90, 120, 180)
        assert isinstance(a['applying'], bool)
        assert a['hand'] in ('dexter', 'sinister')


def test_aspect_dynamics_applying_known():
    # 月(快)入相于土(慢)合相:月在土前 1°、月顺行更快 → 应判入相。
    pc = _PC([_o('Moon', 99.0), _o('Saturn', 100.0)], diurnal=True)
    pc.chart.objects[0].lonspeed = 13.0
    pc.chart.objects[1].lonspeed = 0.03
    ad = astroextra.compute_aspect_dynamics(pc)
    hit = [x for x in ad['aspects'] if set([x['a'], x['b']]) == set(['Moon', 'Saturn'])]
    assert hit and hit[0]['applying'] is True, ad['aspects']


def test_topic_almuten_structure():
    """WI-13:逐题主星每条含题/宫/自然象征/主星。"""
    r = astroextra.analyze_chart({
        'date': '2025/03/01', 'time': '12:00:00', 'zone': '+00:00',
        'lat': '40N00', 'lon': '000E00', 'ad': 1, 'hsys': 'PLACIDUS',
    })
    ta = r['topicAlmuten']
    assert len(ta) >= 9
    for t in ta:
        assert t['topic'] and isinstance(t['house'], int)
        assert t['significator']
        assert t['almuten'] is None or isinstance(t['almuten'], str)


def test_fixed_star_behenian_royal():
    """WI-22:恒星命中含比尼/王者标 + 中文名;无重复 星-点;要星(王者→比尼)置顶。"""
    r = astroextra.analyze_chart({
        'date': '2020/01/13', 'time': '21:18:14', 'zone': '+08:00',
        'lat': '26N04', 'lon': '119E19', 'ad': 1, 'hsys': 'ALCABITUS',
        'fixedStarOrb': 3.0,
    })
    hits = r['fixedStarHits']
    assert hits
    for h in hits:
        assert isinstance(h.get('behenian'), bool) and 'royal' in h and 'cn' in h
    keys = [(h['star'], h['point']) for h in hits]
    assert len(keys) == len(set(keys)), '存在重复 星-点命中'
    rank = [0 if h['royal'] else (1 if h['behenian'] else 2) for h in hits]
    assert rank == sorted(rank), '要星未置顶'
    assert any(h['royal'] for h in hits), '该盘应含王者星(Regulus 北)'


def test_planetary_hours_structure():
    """WI-18/[SURF]:昼夜不等时排法结构(显式 unequal 档——旧版本表恒此排法,断言原样保留);
    值日星(2020-01-13 周一=Moon);恰一段当前;首时=值日星;迦勒底降序。"""
    ph = astroextra.compute_planetary_hours(astroextra.base_params({
        'date': '2020/01/13', 'time': '21:18:14', 'zone': '+08:00',
        'lat': '26N04', 'lon': '119E19', 'ad': 1, 'hsys': 'ALCABITUS',
        'planetaryHourMethod': 'unequal',
    }))
    assert ph and len(ph['hours']) == 24
    assert ph['hourMode'] == 'unequal'
    assert ph['dayRuler'] == 'Moon'
    assert ph['hours'][0]['ruler'] == 'Moon'
    assert ph['hours'][1]['ruler'] == 'Saturn'
    assert sum(1 for h in ph['hours'] if h['current']) == 1
    cur = [h for h in ph['hours'] if h['current']][0]
    assert cur['ruler'] == 'Saturn' and cur['diurnal'] is False
    assert [h['index'] for h in ph['hours']] == list(range(1, 25))


def test_planetary_hours_default_sunrise_equal_length():
    """[SURF] 默认档=sunrise 等长 60 分小时(与「时主星」口径一致,双实现分裂修正):
    首时起点=日出,相邻时段恒差 1 小时;同刻 current 恰一段。"""
    ph = astroextra.compute_planetary_hours(astroextra.base_params({
        'date': '2020/01/13', 'time': '21:18:14', 'zone': '+08:00',
        'lat': '26N04', 'lon': '119E19', 'ad': 1, 'hsys': 'ALCABITUS',
    }))
    assert ph and ph['hourMode'] == 'sunrise'
    assert ph['hours'][0]['start'] == ph['sunrise']
    h0 = ph['hours'][0]['start']
    h1 = ph['hours'][1]['start']
    def _sec(t):
        p = [int(x) for x in t.split(':')]
        return p[0] * 3600 + p[1] * 60 + (p[2] if len(p) > 2 else 0)
    assert (_sec(h1) - _sec(h0)) % 86400 == 3600
    assert sum(1 for h in ph['hours'] if h['current']) == 1


def test_besieging_blocked_by_intervening_star():
    # 同上但木星落于其间(100°近)→ 不算度数围攻。
    pc = _PC([_o('Venus', 100.0), _o('Mars', 95.0), _o('Saturn', 105.0), _o('Jupiter', 101.0)], diurnal=True)
    cp = astroextra.compute_classical_patterns(pc)
    assert not [d for d in cp['besieging'] if d['planet'] == 'Venus']
