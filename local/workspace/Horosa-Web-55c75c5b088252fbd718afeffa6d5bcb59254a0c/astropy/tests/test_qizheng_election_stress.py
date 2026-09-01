# -*- coding: utf-8 -*-
"""[七政择日 压测] 全类型全取值×口径矩阵×随机树 fuzz(2026-08-29:所有选项全覆盖)。
中心不变量:scan 区间 vs explain_at 点判恒等(explain 走独立微域求值路径,true_intervals
采样/翻转二分的漏窗类 bug 在此显形——hua_lu 慢步漏觜窗即该型)+区间良构+边界±1min 探针。
运行: PYTHONPATH=Horosa-Web/astropy python3 -m pytest Horosa-Web/astropy/tests/test_qizheng_election_stress.py -q
"""
import random

import pytest

from astrostudy.qizheng_election_scan import scan, explain_at, CONDITION_TYPES, GONG_SEQ
from astrostudy import guolao_const as gc

GEO = {'gpsLat': 39.9, 'gpsLon': 116.46, 'zone': '+08:00'}
WIN = {'startDate': '2026-05-14', 'endDate': '2026-05-16'}
BODIES = ['日', '月', '金', '木', '水', '火', '土', '罗睺', '计都', '月孛', '紫炁']


def _minutes(t):
    d, hm = t.split(' ')
    hh, mm = hm.split(':')
    return int(hh) * 60 + int(mm)


def _shift(t, dm):
    d, hm = t.split(' ')
    hh, mm = [int(x) for x in hm.split(':')]
    tot = hh * 60 + mm + dm
    if tot < 0 or tot > 23 * 60 + 59:
        return None      # 跨日探针略(窗内相邻行覆盖由恒等段兜)
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
    """scan+良构+边界探针+行内/行外点判对拍;返回 mismatches 列表(空=恒等)。"""
    r = scan(data)
    assert 'err' not in r, r
    bad = []
    prev_end = ''
    for iv in r['intervals']:
        if not (iv['start'] < iv['end']):
            bad.append('空行/倒挂 %s' % iv['start'])
        if prev_end and not (iv['start'] >= prev_end):
            bad.append('重叠/乱序 %s' % iv['start'])
        prev_end = iv['end']
        # 行内点判必真(start/pick/end-1min 三探针)
        for t in (iv['start'], iv['pick'], _shift(iv['end'], -1)):
            if t and not _explain_pass(data, t):
                bad.append('行内点判假 %s@%s' % (iv['start'], t))
        # 行外一分钟:不被邻行覆盖则必假(窗界处不适用——行 end=窗终点是栅栏柱,首跑实抓)
        win_start = data['startDate'] + ' ' + data.get('startTime', '00:00:00')[:5]
        win_end = data['endDate'] + ' ' + data.get('endTime', '23:59:59')[:5]
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
for b in BODIES:
    S1_CASES.append(('body_in_gong·%s' % b, _leaf('body_in_gong', {'body': b, 'values': list(GONG_SEQ)})))
for g in GONG_SEQ:
    S1_CASES.append(('body_in_gong·月在%s' % g, _leaf('body_in_gong', {'body': '月', 'values': [g]})))
for x in gc.SU28[:14]:
    S1_CASES.append(('body_in_xiu·月在%s' % x, _leaf('body_in_xiu', {'body': '月', 'values': [x]})))
for d in ['庙', '旺', '得', '利', '平', '闲', '陷']:
    S1_CASES.append(('dignity·%s' % d, _leaf('dignity', {'body': '月', 'values': [d]})))
# [W7 全谱轮] 七态/迟速新档入 S1(恒等扫描机械盖)
for d7 in ['垣', '庙', '旺', '乐', '喜', '怒']:
    S1_CASES.append(('dignity_seven·%s' % d7, _leaf('dignity_seven', {'body': '月', 'values': [d7]})))
for sp in ['slow', 'fast']:
    S1_CASES.append(('speed_state·%s' % sp, _leaf('speed_state', {'body': '水', 'state': sp})))
for s in ('retro', 'direct', 'stationary'):
    S1_CASES.append(('speed_state·%s' % s, _leaf('speed_state', {'body': '水', 'state': s})))
for m in ('combust', 'fu', 'free'):
    S1_CASES.append(('combust·%s' % m, _leaf('combust', {'body': '水', 'mode': m})))
for v in ('day', 'night'):
    S1_CASES.append(('day_night·%s' % v, _leaf('day_night', {'value': v})))
for g in GONG_SEQ:
    S1_CASES.append(('asc_gong·%s' % g, _leaf('asc_gong', {'values': [g]})))
for rel in ('same', 'opposite', 'trine'):
    S1_CASES.append(('body_rel·%s' % rel, _leaf('body_rel', {'bodyA': '日', 'bodyB': '月', 'rel': rel})))
S1_CASES.append(('deg_lord·defaults', _leaf('deg_lord', {'body': '月', 'values': ['角', '斗', '奎', '井']})))
S1_CASES.append(('hua_lu·gong', _leaf('hua_lu', {'where': 'gong', 'values': list(GONG_SEQ)})))
S1_CASES.append(('hua_lu·xiu', _leaf('hua_lu', {'where': 'xiu', 'values': list(gc.SU28)})))


@pytest.mark.parametrize('cid,leaf', S1_CASES, ids=[c[0] for c in S1_CASES])
def test_s1_all_values(cid, leaf):
    data = dict(GEO, **WIN, conditions=leaf)
    _r, bad = sweep(data)
    assert bad == [], '%s: %s' % (cid, bad[:5])


# ── S2 口径矩阵(su28Mode×nodeType×lilithType 全组合,判定面条件) ──
@pytest.mark.parametrize('su', [2, 3])
@pytest.mark.parametrize('node', ['mean', 'true'])
@pytest.mark.parametrize('lil', ['mean', 'true'])
def test_s2_mode_matrix(su, node, lil):
    data = dict(GEO, **WIN, su28Mode=su, nodeType=node, lilithType=lil,
                conditions={'type': 'all', 'conditions': [
                    _leaf('body_in_xiu', {'body': '罗睺', 'values': list(gc.SU28)}),
                    _leaf('body_in_gong', {'body': '月孛', 'values': list(GONG_SEQ)}),
                ]})
    _r, bad = sweep(data)
    assert bad == [], bad[:5]


# ── S3 随机树 fuzz(种子化;组合门×负向×嵌套) ──
def test_s3_fuzz():
    rng = random.Random(20260829)
    pool = [
        lambda: _leaf('body_in_gong', {'body': rng.choice(BODIES), 'values': rng.sample(GONG_SEQ, rng.randint(1, 6))}),
        lambda: _leaf('dignity', {'body': rng.choice(['日', '月', '金', '木']), 'values': rng.sample(['庙', '旺', '平', '陷'], 2)}),
        lambda: _leaf('day_night', {'value': rng.choice(['day', 'night'])}),
        lambda: _leaf('combust', {'body': rng.choice(['水', '金']), 'mode': rng.choice(['combust', 'fu', 'free'])}),
        lambda: _leaf('asc_gong', {'values': rng.sample(GONG_SEQ, rng.randint(1, 4))}),
    ]
    for i in range(8):
        op = rng.choice(['all', 'any', 'xor'])
        kids = [rng.choice(pool)() for _ in range(rng.randint(2, 3))]
        tree = {'type': op, 'conditions': kids}
        if rng.random() < 0.4:
            tree = {'type': 'not', 'conditions': [tree]}
        data = dict(GEO, **WIN, conditions=tree)
        _r, bad = sweep(data)
        assert bad == [], 'fuzz#%d: %s' % (i, bad[:5])


# ── S4 边界:高纬(66°N 步长加密面)+界近判别 ──
def test_s4_high_latitude_asc():
    data = dict(GEO, gpsLat=66.0, **WIN,
                conditions=_leaf('asc_gong', {'values': ['戌']}))
    r, bad = sweep(data)
    assert bad == [], bad[:5]
    # 66°N 白羊(戌宫)每日真升窗数分钟——高纬加密后必须抓到(曾 20 分步整窗漏,审查实抓)
    assert r['intervals'], '66°N 戌宫升窗全漏(高纬步长加密失效)'


def test_s4_high_latitude_day_night():
    data = dict(GEO, gpsLat=66.0, startDate='2026-06-20', endDate='2026-06-22',
                conditions=_leaf('day_night', {'value': 'night'}))
    _r, bad = sweep(data)
    assert bad == [], bad[:5]
