# -*- coding: utf-8 -*-
"""[印度择日 压测] 全类型全取值×岁差/交点矩阵×随机树 fuzz(2026-08-29)。
判据同 qizheng 压测:scan 区间 vs explain_at 点判恒等+良构+边界±1min 探针
(分钟向内对齐语义:行文本内每一整分钟点判必真)。
运行: PYTHONPATH=Horosa-Web/astropy python3 -m pytest Horosa-Web/astropy/tests/test_india_election_stress.py -q
"""
import random

import pytest

from astrostudy.india_election_scan import scan, explain_at

GEO = {'gpsLat': 28.61, 'gpsLon': 77.2, 'zone': '+05:30'}
WIN = {'startDate': '2026-05-14', 'endDate': '2026-05-16'}
NATAL = {'moonNak': 4, 'moonSign': 3}
BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Rahu', 'Ketu']
KARANA = ['Bava', 'Balava', 'Kaulava', 'Taitila', 'Garaja', 'Vanija', 'Vishti', 'Shakuni', 'Chatushpada', 'Naga', 'Kimstughna']


def _shift(t, dm):
    d, hm = t.split(' ')
    hh, mm = [int(x) for x in hm.split(':')]
    tot = hh * 60 + mm + dm
    if tot < 0 or tot > 23 * 60 + 59:
        return None
    return '{0} {1:02d}:{2:02d}'.format(d, tot // 60, tot % 60)


def _explain_pass(data, t):
    e = explain_at(dict(data, t=t))
    assert 'err' not in e, e
    return bool(e['tree']['pass'])


def _day_seq(d0, d1):
    import datetime as _d
    a = _d.date(*[int(x) for x in d0.split('-')])
    b = _d.date(*[int(x) for x in d1.split('-')])
    out = []
    while a <= b:
        out.append(a.strftime('%Y-%m-%d'))
        a += _d.timedelta(days=1)
    return out


def sweep(data):
    r = scan(data)
    assert 'err' not in r, r
    bad = []
    prev_end = ''
    win_start = data['startDate'] + ' 00:00'
    win_end = data['endDate'] + ' 23:59'
    for iv in r['intervals']:
        if not (iv['start'] < iv['end']):
            bad.append('空行/倒挂 %s' % iv['start'])
        if prev_end and not (iv['start'] >= prev_end):
            bad.append('重叠/乱序 %s' % iv['start'])
        prev_end = iv['end']
        for t in (iv['start'], iv['pick'], _shift(iv['end'], -1)):
            if t and not _explain_pass(data, t):
                bad.append('行内点判假 %s@%s' % (iv['start'], t))
        for t in (_shift(iv['start'], -1), iv['end']):
            if not t or t >= win_end or t < win_start:
                continue
            in_any = any(v['start'] <= t < v['end'] for v in r['intervals'])
            if not in_any and _explain_pass(data, t):
                bad.append('行外点判真(漏收) %s@%s' % (iv['start'], t))
    # 🔴 全域恒等(复审 F10:此前只探已产出行——scan 回退空结果时 S1-S3 照绿,
    # miss 型漏窗零设防):窗内 2h 网格逐点 explain 判 vs 行覆盖,漏收/多收都现形。
    for dstr in _day_seq(data['startDate'], data['endDate']):
        for hh in range(0, 24, 2):
            t = '%s %02d:00' % (dstr, hh)
            cov = any(v['start'] <= t < v['end'] for v in r['intervals'])
            if _explain_pass(data, t) != cov:
                bad.append('全域失配 %s 点判=%s 覆盖=%s' % (t, not cov, cov))
    return r, bad


def _leaf(t, params):
    return {'type': t, 'params': params}


# ── S1 全类型全取值 ──
S1_CASES = []
for v in range(1, 31):
    S1_CASES.append(('tithi·%d' % v, _leaf('tithi', {'values': [v]})))
for v in range(0, 7):
    S1_CASES.append(('vara·%d' % v, _leaf('vara', {'values': [v]})))
for v in (1, 4, 9, 14, 20, 27):
    S1_CASES.append(('nakshatra·Moon·%d' % v, _leaf('nakshatra', {'body': 'Moon', 'values': [v]})))
# [W8 全谱轮] 七新类入 S1(恒等扫描机械盖)
S1_CASES.append(('muhurta_seg·abhijit', _leaf('muhurta_seg', {'pick': 'abhijit'})))
S1_CASES.append(('muhurta_seg·ausp', _leaf('muhurta_seg', {'pick': 'grade', 'grades': ['auspicious']})))
S1_CASES.append(('choghadia·good', _leaf('choghadia', {'natures': ['good']})))
S1_CASES.append(('choghadia·Amrit', _leaf('choghadia', {'values': ['Amrit']})))
S1_CASES.append(('hora_vedic·木', _leaf('hora_vedic', {'values': [u'木']})))
S1_CASES.append(('panchaka·avoid', _leaf('panchaka', {'mode': 'avoid'})))
S1_CASES.append(('panchaka·in', _leaf('panchaka', {'mode': 'in'})))
S1_CASES.append(('nak_pada·1', _leaf('nak_pada', {'body': 'Moon', 'values': [1]})))
S1_CASES.append(('bhava·kendra', _leaf('bhava_from_lagna', {'body': 'Jupiter', 'group': 'kendra'})))
S1_CASES.append(('day_night·day', _leaf('day_night_in', {'value': 'day'})))
for b in BODIES:
    S1_CASES.append(('nakshatra·%s·全宿' % b, _leaf('nakshatra', {'body': b, 'values': list(range(1, 28))})))
for v in (1, 9, 17, 23, 27):
    S1_CASES.append(('yoga·%d' % v, _leaf('yoga', {'values': [v]})))
for k in KARANA:
    S1_CASES.append(('karana·%s' % k, _leaf('karana', {'values': [k]})))
for v in range(1, 13):
    S1_CASES.append(('lagna·%d' % v, _leaf('lagna', {'values': [v]})))
for b in ('Jupiter', 'Moon', 'Rahu'):
    S1_CASES.append(('planet_sign·%s·全座' % b, _leaf('planet_sign', {'body': b, 'values': list(range(1, 13))})))
for b in ('Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'):
    for s in ('direct', 'retro'):
        S1_CASES.append(('retro·%s·%s' % (b, s), _leaf('retro', {'body': b, 'state': s})))
for kind in ('rahu', 'yama', 'gulika'):
    for mode in ('avoid', 'in'):
        S1_CASES.append(('day_kalam·%s·%s' % (kind, mode), _leaf('day_kalam', {'kind': kind, 'mode': mode})))
for v in range(1, 10):
    S1_CASES.append(('tara·%d' % v, _leaf('tara_bala', {'values': [v]})))
for v in range(1, 13):
    S1_CASES.append(('chandra·%d' % v, _leaf('chandra_bala', {'values': [v]})))


@pytest.mark.parametrize('cid,leaf', S1_CASES, ids=[c[0] for c in S1_CASES])
def test_s1_all_values(cid, leaf):
    data = dict(GEO, **WIN, natal=NATAL, conditions=leaf)
    _r, bad = sweep(data)
    assert bad == [], '%s: %s' % (cid, bad[:5])


# ── S2 岁差×交点矩阵 ──
@pytest.mark.parametrize('ayan', ['lahiri', 'krishnamurti', 'raman'])
@pytest.mark.parametrize('node', ['mean', 'true'])
def test_s2_ayan_node_matrix(ayan, node):
    data = dict(GEO, **WIN, ayanamsa=ayan, nodeType=node,
                conditions={'type': 'all', 'conditions': [
                    _leaf('nakshatra', {'body': 'Rahu', 'values': list(range(1, 28))}),
                    _leaf('lagna', {'values': list(range(1, 13))}),
                ]})
    _r, bad = sweep(data)
    assert bad == [], bad[:5]


# ── S3 随机树 fuzz ──
def test_s3_fuzz():
    rng = random.Random(20260829)
    pool = [
        lambda: _leaf('tithi', {'values': rng.sample(range(1, 31), rng.randint(3, 10))}),
        lambda: _leaf('vara', {'values': rng.sample(range(0, 7), rng.randint(1, 4))}),
        lambda: _leaf('nakshatra', {'body': 'Moon', 'values': rng.sample(range(1, 28), rng.randint(3, 9))}),
        lambda: _leaf('lagna', {'values': rng.sample(range(1, 13), rng.randint(2, 6))}),
        lambda: _leaf('day_kalam', {'kind': rng.choice(['rahu', 'yama', 'gulika']), 'mode': rng.choice(['avoid', 'in'])}),
        lambda: _leaf('tara_bala', {'values': rng.sample(range(1, 10), rng.randint(2, 5))}),
    ]
    for i in range(8):
        op = rng.choice(['all', 'any', 'xor'])
        kids = [rng.choice(pool)() for _ in range(rng.randint(2, 3))]
        tree = {'type': op, 'conditions': kids}
        if rng.random() < 0.4:
            tree = {'type': 'not', 'conditions': [tree]}
        data = dict(GEO, **WIN, natal=NATAL, conditions=tree)
        _r, bad = sweep(data)
        assert bad == [], 'fuzz#%d: %s' % (i, bad[:5])


# ── S4 边界:高纬 lagna+日出界跨日 ──
def test_s4_high_latitude_lagna():
    data = dict(GEO, gpsLat=66.0, gpsLon=25.0, zone='+02:00', **WIN,
                conditions=_leaf('lagna', {'values': [1]}))
    r, bad = sweep(data)
    assert bad == [], bad[:5]
    assert r['intervals'], '66°N 白羊升窗全漏(高纬步长加密失效)'


def test_s4_vara_midnight_boundary():
    # vara 按日出换日:午夜前后同 vara(日出界),恒等扫过跨午夜窗即证
    data = dict(GEO, **WIN, conditions=_leaf('vara', {'values': [0, 1, 2, 3, 4, 5, 6]}))
    r, bad = sweep(data)
    assert bad == [], bad[:5]
    assert r['intervals'] and r['intervals'][0]['start'] == '2026-05-14 00:00'
