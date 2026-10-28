# -*- coding: utf-8 -*-
"""印占口径锁:KP 意义星 / Choghadia / 星期主(日界=日出)/ 宿名单源 / 尊贵档度段 /
Jagradādi·Dīptādi 情境 / 恒属 D1 的量 / 分盘起算 / 六力子项 / Viṃśopaka / Panchaka /
段界浮点 / 1582 前历法 / Tithi 名 / 昼夜判据。每条都锁到权威表或自洽不变量,另含源码护栏
(禁平行实现)。"""
import ast
import json
import os
import re
import sys

import pytest

HERE = os.path.dirname(__file__)
ROOT = os.path.join(HERE, '..')
sys.path.insert(0, ROOT)
sys.path.insert(0, os.path.join(ROOT, '..', 'flatlib-ctrad2'))

from flatlib import const  # noqa: E402

MUMBAI = {'zone': '+05:30', 'lat': '19n04', 'lon': '72e52'}


def _kernel(date, time, **kw):
    from astrostudy.india.india_chart_kernel import IndiaChartKernel
    d = dict(MUMBAI, date=date, time=time)
    d.update(kw)
    return IndiaChartKernel(d)


def _jyotish(date, time, chartnum=1, **kw):
    from astrostudy.india.jyotish_engine import build_jyotish
    from astrostudy.india.varga import apply_varga_chart
    p = _kernel(date, time, **kw)
    d1 = None
    if chartnum != 1:
        d1 = _kernel(date, time, **kw)
        apply_varga_chart(p, chartnum)
    return build_jyotish(p, chartnum=chartnum, d1_perchart=d1)


def _srv_chart(data):
    import cherrypy
    import websrv.webindiasrv as W
    cherrypy.request.json = dict(data)
    return json.loads(W.IndiaAstroSrv().chart())


def _sample_dates():
    import datetime as _dt
    d = _dt.date(1970, 1, 1)
    out = []
    while d.year < 2025:
        out.append(d.strftime('%Y/%m/%d'))
        d += _dt.timedelta(days=211)
    return out


# ── Choghadia:7 星期 × 昼夜 × 8 段金标(通行 Choghadia 表逐格)────────────────
CHOGHADIA_DAY = {
    0: 'Udveg Char Labh Amrit Kaal Shubh Rog Udveg',
    1: 'Amrit Kaal Shubh Rog Udveg Char Labh Amrit',
    2: 'Rog Udveg Char Labh Amrit Kaal Shubh Rog',
    3: 'Labh Amrit Kaal Shubh Rog Udveg Char Labh',
    4: 'Shubh Rog Udveg Char Labh Amrit Kaal Shubh',
    5: 'Char Labh Amrit Kaal Shubh Rog Udveg Char',
    6: 'Kaal Shubh Rog Udveg Char Labh Amrit Kaal',
}
CHOGHADIA_NIGHT = {
    0: 'Shubh Amrit Char Rog Kaal Labh Udveg Shubh',
    1: 'Char Rog Kaal Labh Udveg Shubh Amrit Char',
    2: 'Kaal Labh Udveg Shubh Amrit Char Rog Kaal',
    3: 'Udveg Shubh Amrit Char Rog Kaal Labh Udveg',
    4: 'Amrit Char Rog Kaal Labh Udveg Shubh Amrit',
    5: 'Rog Kaal Labh Udveg Shubh Amrit Char Rog',
    6: 'Labh Udveg Shubh Amrit Char Rog Kaal Labh',
}


@pytest.mark.parametrize('wd', range(7))
def test_choghadia_golden_table(wd):
    from astrostudy.india.jyotish_parts.tables import choghadia_sequence
    day, night = choghadia_sequence(wd)
    assert ' '.join(c['key'] for c in day) == CHOGHADIA_DAY[wd]
    assert ' '.join(c['key'] for c in night) == CHOGHADIA_NIGHT[wd]


def test_choghadia_panel_and_scan_share_one_sequence():
    """面板(2026-10-25 周日)与择日条件扫描逐段同序。"""
    j = _jyotish('2026/10/25', '12:00:00')
    rows = j['muhurta']['choghadia']['rows']
    assert ' '.join(r['key'] for r in rows if r['period'] == 'night') == CHOGHADIA_NIGHT[0]
    from astrostudy import india_election_scan as S
    import swisseph
    ctx = S.IndiaScanContext({'gpsLat': 28.61, 'gpsLon': 77.2, 'zone': '+05:30'})
    a = swisseph.julday(2026, 10, 25, 6 - 5.5)
    b = a + 1.0
    ivs = S._eval_choghadia({'values': ['Amrit']}, ctx, (a, b))
    # 周日夜第 2 段为 Amrit(旧 +1 排法给 Rog):扫描结果必须含日没后第 2 段中点。
    rise, set_, nrise = ctx.sunrise_bounds(a + 0.3)
    mid2 = set_ + (nrise - set_) / 8.0 * 1.5
    assert any(s <= mid2 < e for s, e in ivs), ivs


# ── 星期主:日界 = 日出(本命 / 六力 / KP RP / Panchaka 同源)──────────────────
@pytest.mark.parametrize('time,vara,hora', [
    ('02:00:00', 1, None),     # 子夜后、日出(06:49)前 → 仍属周一
    ('06:45:00', 1, 'Jupiter'),   # 周一夜第 24 时之主
    ('07:00:00', 2, 'Mars'),      # 日出后 → 周二,首个 Hora = 火
    ('23:30:00', 2, None),
])
def test_vara_sunrise_boundary(time, vara, hora):
    j = _jyotish('1985/03/12', time)
    pan = j['panchanga']['vara']
    assert pan['index'] == vara
    assert pan['civilIndex'] == 2          # 民用日恒为周二,并列回显
    lords = {0: 'Sun', 1: 'Moon', 2: 'Mars'}
    assert j['kp']['rulingPlanets']['weekdayLord'] == lords[vara]
    sb = j['shadbalaBphs']
    vara_lord = [p for p in ('Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn')
                 if sb[p]['kala']['vara'] > 0]
    assert vara_lord == [lords[vara]]
    if hora:
        assert [p for p in ('Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn')
                if sb[p]['kala']['hora'] > 0] == [hora]
    # 择时面板全按出生所在吠陀日
    assert j['muhurta']['vedicWeekday'] == vara
    assert j['muhurta']['horaTable']['weekday'] == vara
    assert j['muhurta']['choghadia']['weekday'] == vara


def test_evening_birth_tables_stay_on_birth_day():
    """19:30 出生:Rahu Kālam / Hora / Choghadia 必须是出生当日(周二)的表,不得跳到次日。"""
    j = _jyotish('1985/03/12', '19:30:00')
    m = j['muhurta']
    assert m['vedicDate'] == '1985-03-12'
    assert m['rahuKalam']['start'].startswith('1985-03-12 15:')   # 周二 Rahu = 第 7 段
    assert m['choghadia']['rows'][0]['key'] == 'Rog'                 # 周二昼首


def test_no_bare_weekday_outside_single_source():
    """india 包内星期一律走 primitives(local_weekday / vedic_weekday);禁裸 dayofweek()。"""
    base = os.path.join(ROOT, 'astrostudy', 'india')
    hits = []
    for dirpath, _d, files in os.walk(base):
        for f in files:
            if not f.endswith('.py') or f == 'primitives.py':
                continue
            src = open(os.path.join(dirpath, f), encoding='utf-8').read()
            for i, line in enumerate(src.splitlines(), 1):
                code = line.split('#', 1)[0]
                if re.search(r'\.dayofweek\(\)', code) and '"""' not in line:
                    hits.append('%s:%d' % (f, i))
    # kp_system 末尾集成说明串里的旧示例不是代码
    hits = [h for h in hits if not h.startswith('kp_system.py')]
    assert hits == [], hits


# ── 27 宿中文名单源 ───────────────────────────────────────────────────────
def test_nakshatra_cn_label_single_source():
    from astrostudy.nakshatra import nakshatra_from_lon, NAKSHATRAS
    from astrostudy.india.nakshatra_data import NAKSHATRA_DATA
    span = 360.0 / 27.0
    for i in range(27):
        nk = nakshatra_from_lon(i * span + 1.0)
        assert nk['label'] == NAKSHATRA_DATA[i]['labelCn'], (i, nk['label'])
        assert NAKSHATRAS[i][1] == NAKSHATRA_DATA[i]['labelCn']
    assert nakshatra_from_lon(1.0)['label'] == '娄'
    src = open(os.path.join(ROOT, 'astrostudy', 'nakshatra.py'), encoding='utf-8').read()
    for ch in '娄胃昴毕觜参井鬼柳星张翼轸角亢氐房心尾箕斗女虚危室壁奎':
        assert ("'%s'" % ch) not in src, '第二份宿名中文表回潮:%s' % ch


# ── 尊贵档度段(单一实现)────────────────────────────────────────────────────
@pytest.mark.parametrize('planet,sign,deg,want', [
    (const.MOON, const.TAURUS, 2.0, 'exaltation'),
    (const.MOON, const.TAURUS, 3.5, 'deep_exaltation'),
    (const.MOON, const.TAURUS, 20.0, 'moolatrikona'),
    (const.MERCURY, const.VIRGO, 10.0, 'exaltation'),
    (const.MERCURY, const.VIRGO, 17.0, 'moolatrikona'),
    (const.MERCURY, const.VIRGO, 25.0, 'own_sign'),
    (const.SUN, const.ARIES, 25.0, 'exaltation'),
    (const.SUN, const.LEO, 25.0, 'own_sign'),
    (const.SATURN, const.ARIES, 5.0, 'debilitation'),
])
def test_dignity_bands(planet, sign, deg, want):
    from astrostudy.india.primitives import classify_dignity
    from astrostudy.india.jyotish_engine import JyotishEngine
    assert classify_dignity(planet, sign, deg) == want
    eng = JyotishEngine.__new__(JyotishEngine)
    assert eng.dignity(planet, sign, deg) == want


def test_no_parallel_dignity_implementation():
    base = os.path.join(ROOT, 'astrostudy', 'india')
    hits = []
    for dirpath, _d, files in os.walk(base):
        for f in files:
            if f.endswith('.py') and f != 'primitives.py':
                src = open(os.path.join(dirpath, f), encoding='utf-8').read()
                if 'abs(signlon - exalt_deg)' in src or "return 'deep_exaltation'" in src:
                    hits.append(f)
    assert hits == [], hits


# ── Jagradādi / Dīptādi 情境 ─────────────────────────────────────────────
def test_avastha_states_all_reachable():
    seen_d, seen_j = set(), set()
    for date in _sample_dates()[:60]:
        j = _jyotish(date, '10:00:00', zone='+05:30', lat='28n36', lon='77e12')
        for it in j['strengths']['planetaryStates']:
            seen_d.add(it['deeptadi']['key'])
            seen_j.add(it['jagradadi']['key'])
            if it['dignity'] == 'neutral' and it['id'] in ('Sun', 'Moon', 'Mars', 'Mercury',
                                                          'Jupiter', 'Venus', 'Saturn'):
                pass
    assert {'Deepta', 'Swastha', 'Mudita', 'Saanta', 'Deena', 'Duhkhita', 'Vikala',
            'Khala', 'Kopita'} <= seen_d, seen_d
    assert {'Jagrita', 'Swapna', 'Sushupta'} <= seen_j


# ── 恒属 D1 / 出生时刻的量:分盘视图逐字节不变 ──────────────────────────────
def _d1_fields(j):
    sb = j['shadbalaBphs']
    return {
        'combust': [(x['id'], x['combust']) for x in j['strengths']['planetaryStates']],
        'karakas': j['jaimini']['charaKarakas'],
        'karakamsa': (j['supplementaryLagnas'] or {}).get('karakamsa'),
        'swamsa': (j['supplementaryLagnas'] or {}).get('swamsa'),
        'panchaka': j['muhurta'].get('panchaka'),
        'paksha': j['panchanga']['tithi'],
        'kala': {p: {k: sb[p]['kala'][k] for k in ('tribhaga', 'nathonnatha', 'paksha', 'vara',
                                                   'hora', 'abdaMasa', 'ayana', 'yuddha')}
                 for p in ('Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn')},
        'kp': j['kp'],
        'yuddha': j['grahaYuddha'],
        'gochara': (j.get('gochara') or {}).get('fromMoon'),
        'dashaLink': (j.get('gochara') or {}).get('dashaLink'),
    }


@pytest.mark.parametrize('date,time', [('1985/03/12', '06:45:00'), ('2000/01/10', '10:00:00'),
                                       ('2000/01/01', '10:00:00')])
def test_d1_invariants_across_vargas(date, time):
    base = dict(MUMBAI, date=date, time=time, gpsLat=19.07, gpsLon=72.87, ad=1,
                transitDate='2030/06/01')
    ref = _d1_fields(_srv_chart(dict(base, chartnum=1))['jyotish'])
    for cn in (9, 10, 60):
        cur = _d1_fields(_srv_chart(dict(base, chartnum=cn))['jyotish'])
        diff = [k for k in ref if json.dumps(ref[k], sort_keys=True) != json.dumps(cur[k], sort_keys=True)]
        assert diff == [], (cn, diff)


# ── KP 意义星:本命与问时盘同一组装 + 节点键同域 + 标准四级 ──────────────────
def test_kp_natal_uses_shared_assembler_and_nodes_alive():
    from astrostudy.india.prashna import assemble_kp_significators, NODE_KEY_MAP_REV, to_kp_key
    from astrostudy.india.jyotish_engine import JyotishEngine
    from astrostudy.india.yoga_engine import safe_get
    from astrostudy.india.jyotish_parts.tables import JYOTISH_PLANETS
    node_star_hits = 0
    for date in _sample_dates()[:40]:
        p = _kernel(date, '10:00:00', zone='+05:30', lat='28n36', lon='77e12')
        eng = JyotishEngine(p)
        kp = eng.kp()
        cusps = eng._kp_placidus_cusps()
        lons = {oid: float(safe_get(p.chart, oid).lon) for oid in JYOTISH_PLANETS}
        asm = assemble_kp_significators(lons, cusps)
        want = {NODE_KEY_MAP_REV.get(k, k): v for k, v in asm['significators'].items()}
        assert kp['significators'] == want
        pdata = asm['planetData']
        assert {d['starLord'] for d in pdata.values()} <= set(pdata.keys())
        for key, d in pdata.items():
            row = asm['significators'][key]
            assert row['A'], (date, key)            # 星主所占恒非空(星主在宫内)
            if d['starLord'] in ('Rahu', 'Ketu'):
                node_star_hits += 1
        for nk in ('Rahu', 'Ketu'):
            assert asm['significators'][nk]['D'], (date, nk)   # 节点代理给出「所主」
        assert kp['basis'] == 'd1' and kp['houseBasis'] == 'cusp'
    assert node_star_hits > 0


def test_kp_horary_path_uses_same_assembler():
    from astrostudy.india import prashna as pr
    import datetime as _dt
    cusps = [(10.0 + 30.0 * i + (3.0 if i % 2 else 0.0)) % 360.0 for i in range(12)]
    lons = {'Sun': 15.0, 'Moon': 100.0, 'Mars': 200.0, 'Mercury': 25.0, 'Jupiter': 300.0,
            'Venus': 40.0, 'Saturn': 250.0, 'Rahu': 130.0, 'Ketu': 310.0}
    out = pr.assemble_kp_horary(12, 'career', cusps, 'time_placidus', lons,
                                _dt.datetime(2020, 1, 1, 12), {'set': []}, None)
    assert out['significators'] == pr.assemble_kp_significators(lons, cusps)['significators']


# ── Panchaka:(T+V+N+L) mod 9,无 ×2;页面与择日同一函数 ──────────────────────
def test_panchaka_formula_and_single_source():
    from astrostudy.india.primitives import panchaka_remainder
    # Tithi 6 + 周一(=2)+ 宿 17 + 上升 12 = 37 → 余 1(死忌)
    assert panchaka_remainder(6, 1, 17, 12) == 1
    assert panchaka_remainder(1, 0, 1, 1) == 4
    base = os.path.join(ROOT, 'astrostudy')
    for rel in ('india/jyotish_parts/panchanga.py', 'india_election_scan.py'):
        src = open(os.path.join(base, rel), encoding='utf-8').read()
        assert '* 2) % 9' not in src and '×2)%9' not in src, rel
        assert 'panchaka_remainder(' in src, rel


def test_choghadia_no_parallel_sequence():
    for rel in ('india/jyotish_parts/panchanga.py', 'india_election_scan.py'):
        src = open(os.path.join(ROOT, 'astrostudy', rel), encoding='utf-8').read()
        assert 'CHOGHADIA_CYCLE[' not in src and 'choghadia_sequence(' in src, rel


# ── 分盘起算 ─────────────────────────────────────────────────────────────
def _first_last(cn, variant=None):
    from astrostudy.india.varga import varga_position
    out = []
    for s in range(12):
        first = int(varga_position(s * 30.0 + 0.01, cn, variant) // 30)
        last = int(varga_position(s * 30.0 + 29.99, cn, variant) // 30)
        out.append((first, last))
    return out


def test_d8_ashtamsa_start_signs():
    # 动座自白羊、定座自射手、双体座自狮子 = 连续循环 (8s+k) mod 12
    for s, (first, last) in enumerate(_first_last(8)):
        assert first == (8 * s) % 12, s
        assert last == (8 * s + 7) % 12, s


def test_d16_unchanged_and_d5_d11_variants():
    for s, (first, _l) in enumerate(_first_last(16)):
        assert first == (16 * s) % 12
    par = _first_last(5, 'parashara')
    assert [p[0] for p in par[:2]] == [0, 1]          # 白羊首段=白羊、金牛首段=金牛
    assert par[0][1] == 6 and par[1][1] == 7          # 白羊末段天秤、金牛末段天蝎
    for s, (first, last) in enumerate(_first_last(11, 'cyclic')):
        assert first == (11 * s) % 12 and last == (11 * s + 10) % 12


# ── 六力子项 ─────────────────────────────────────────────────────────────
def test_dig_bala_continuous_and_yuddha():
    from astrostudy.india import shadbala_bphs as sb
    ang = {'asc': 100.0, 'mc': 10.0}
    assert abs(sb.dig_bala_continuous(const.SUN, 10.0, ang) - 60.0) < 1e-9     # 在天顶
    assert abs(sb.dig_bala_continuous(const.SUN, 190.0, ang) - 0.0) < 1e-9     # 在天底
    assert abs(sb.dig_bala_continuous(const.JUPITER, 100.0, ang) - 60.0) < 1e-9
    assert abs(sb.dig_bala_continuous(const.JUPITER, 145.0, ang) - 45.0) < 1e-9
    ctx = {'lon': 100.0, 'signlon': 10.0, 'houseFromLagna': 4, 'sunLon': 0.0, 'moonLon': 90.0,
           'weekdayLord': const.SUN, 'horaLord': const.SUN, 'yearLord': const.SUN,
           'monthLord': const.SUN, 'declination': 0.0}
    plain = sb.compute_all({const.MARS: dict(ctx), const.VENUS: dict(ctx, lon=100.5)})
    war = sb.compute_all({const.MARS: dict(ctx), const.VENUS: dict(ctx, lon=100.5)},
                         yuddha_pairs=[{'winner': const.VENUS, 'loser': const.MARS}])
    d = war['yuddha'][0]['virupa']
    assert d > 0
    assert abs(war[const.VENUS]['totalVirupa'] - plain[const.VENUS]['totalVirupa'] - d) < 1e-3
    assert abs(plain[const.MARS]['totalVirupa'] - war[const.MARS]['totalVirupa'] - d) < 1e-3
    assert war[const.VENUS]['kala']['yuddha'] == round(d, 4)
    assert '全量实现' not in war['note'] and war['approximations']


def test_engine_shadbala_honest_and_d1_time():
    j = _jyotish('1985/03/12', '06:45:00')
    sb = j['shadbalaBphs']
    assert sb['approximations'] and '全量实现' not in sb['note']
    # 06:45 在日出(06:49)前 → 夜生:Tribhaga 夜三段之末(火)得 60
    assert sb['Mars']['kala']['tribhaga'] == 60.0 and sb['Saturn']['kala']['tribhaga'] == 0.0
    assert 'shadbala' not in j          # 粗估层已删,六力只此一份


# ── Viṃśopaka 分值(BPHS 20/18/15/10/7/5)─────────────────────────────────
def test_vimsopaka_points_scale():
    from astrostudy.india import shadbala_bphs as sb
    assert sb.VIMSOPAKA_POINTS_BY_DIGNITY == {
        'moolatrikona': 20.0, 'own_sign': 20.0, 'adhimitra': 18.0, 'friend': 15.0,
        'neutral': 10.0, 'enemy': 7.0, 'adhisatru': 5.0}
    j = _jyotish('1985/03/12', '14:30:00')
    v = j['shadbalaBphs']['Sun']['vimsopaka']['shadvarga']
    w = sb.VIMSOPAKA_WEIGHTS['shadvarga']
    tot = sum(w[c] * sb.VIMSOPAKA_POINTS_BY_DIGNITY[v['perChart'][c]['dignity']] / 20.0 for c in w)
    assert abs(tot - v['total']) < 1e-3


# ── 大运精确起讫 + 过运日联动 ────────────────────────────────────────────
def test_dasha_sub_periods_carry_iso_and_link_follows_transit_date():
    base = dict(MUMBAI, date='1985/03/12', time='14:30:00', gpsLat=19.07, gpsLon=72.87, ad=1)
    j = _srv_chart(dict(base, transitDate='2030/06/01'))['jyotish']
    mahas = j['dasha']['vimshottari']['mahadashas']
    for m in mahas:
        ants = m.get('antardashas') or []
        assert ants and ants[0]['startIso'] == m['startIso']
        for a in ants:
            assert 'T' in a['startIso'] and a['endIso'] > a['startIso']
            assert a['pratyantardashas'][0]['startIso'] == a['startIso']
    # 取 2026–2040 之间某个中运边界,两侧过运日的 antarLord 必须不同
    import datetime as _dt
    bound = None
    for m in mahas:
        for a in m['antardashas']:
            if '2027' <= a['startIso'][:4] <= '2040':
                bound = a
                break
        if bound:
            break
    t0 = _dt.datetime.fromisoformat(bound['startIso'])
    before = (t0 - _dt.timedelta(days=2)).strftime('%Y/%m/%d')
    after = (t0 + _dt.timedelta(days=2)).strftime('%Y/%m/%d')
    l1 = _srv_chart(dict(base, transitDate=before))['jyotish']['gochara']['dashaLink']
    l2 = _srv_chart(dict(base, transitDate=after))['jyotish']['gochara']['dashaLink']
    assert l1['antarLord']['key'] != l2['antarLord']['key']
    assert l2['antarLord']['key'] == bound['lord']['key']


# ── 段界浮点 ─────────────────────────────────────────────────────────────
def test_exact_boundaries_go_to_next_segment():
    from astrostudy.nakshatra import nakshatra_from_lon
    from astrostudy.india.varga import _part
    span = 360.0 / 27.0
    for k in range(27):
        assert nakshatra_from_lon(k * span)['index'] == k + 1, k
        for q in range(4):
            assert nakshatra_from_lon(k * span + q * span / 4.0)['pada'] == q + 1, (k, q)
    for n in (7, 9, 11, 27, 45):
        for k in range(n):
            assert _part(k * 30.0 / n, n) == k, (n, k)


# ── 1582 前历法 ──────────────────────────────────────────────────────────
def test_pre_gregorian_dasha_labels_follow_julian():
    import swisseph
    from astrostudy.india.jyotish_parts.helpers import get_local_birth_datetime, format_dt
    p = _kernel('1500/03/10', '12:00:00', zone='+01:00', lat='41n54', lon='12e30')
    birth = get_local_birth_datetime(p)
    assert birth.strftime('%Y-%m-%d') == '1500-03-20'      # 真时刻(proleptic 格里;1500 年差 10 天)
    assert format_dt(birth) == '1500-03-10'                # 标签回到儒略历,与输入同日
    j = _jyotish('1500/03/10', '12:00:00', zone='+01:00', lat='41n54', lon='12e30')
    m0 = j['dasha']['vimshottari']['mahadashas'][0]
    from astrostudy.india.jyotish_parts.helpers import parse_local_iso
    assert m0['endIso'].endswith('+01:00')                 # 段界 ISO 带出生时区偏移
    end = parse_local_iso(m0['endIso'])                    # 墙钟 = 出生地当地
    local_jd = p.dateTime.jd + 1.0 / 24.0 + (end - birth).total_seconds() / 86400.0
    cal = swisseph.GREG_CAL if local_jd >= 2299160.5 else swisseph.JUL_CAL
    y, mo, d, _h = swisseph.revjul(local_jd, cal)
    assert m0['end'] == '%04d-%02d-%02d' % (y, mo, d)


# ── Tithi 名 / 昼夜判据 ──────────────────────────────────────────────────
def test_tithi_names_split_purnima_amavasya():
    from astrostudy.india.jyotish_parts.tables import tithi_name
    assert tithi_name(15) == 'Purnima' and tithi_name(30) == 'Amavasya'
    assert tithi_name(1) == tithi_name(16) == 'Pratipada'


def test_day_night_uses_apparent_sunrise():
    from astrostudy.india.jyotish_engine import JyotishEngine
    from flatlib.ephem import eph
    p = _kernel('1985/03/12', '06:45:00')
    sr = eph.lastSunrise(p.dateTime.jd + 0.2, p.pos.lat, p.pos.lon)
    eng = JyotishEngine(p)
    assert eng._is_day_birth() is False                    # 06:45 < 日出
    from flatlib.datetime import Datetime
    t = Datetime.fromJD(sr + 2.0 / 1440.0, '+05:30').time.toString()[:8]
    eng2 = JyotishEngine(_kernel('1985/03/12', t))
    assert eng2._is_day_birth() is True                    # 日出后 2 分钟


def test_varga_variant_registry_front_back_parity():
    """前端分盘变体选项(AstroConst.INDIA_VARGA_VARIANT_CHARTS)与后端注册表逐项同构。"""
    from astrostudy.india.varga import VARGA_VARIANT_CHOICES
    src = open(os.path.join(ROOT, '..', 'astrostudyui', 'src', 'constants', 'AstroConst.js'),
               encoding='utf-8').read()
    block = src[src.index('export const INDIA_VARGA_VARIANT_CHARTS'):]
    block = block[:block.index('];\n') + 2]
    front = {}
    for m in re.finditer(r"\{ chartnum: (\d+), key: '[^']+', label: '[^']+', options: \[(.*?)\] \}", block, re.S):
        vals = re.findall(r"value: '([^']+)'", m.group(2))
        front[int(m.group(1))] = tuple(v for v in vals if v != 'standard')
    assert front == {k: tuple(v) for k, v in VARGA_VARIANT_CHOICES.items()}


# ── 敌友(Pañcadhā Maitrī):临时友敌恒按 D1,与六力 / 状态所用复合友敌同口径 ─────────
def test_graha_maitri_is_d1_and_matches_primitives():
    from astrostudy.india.primitives import compound_relation
    from astrostudy.india.yoga_engine import safe_get
    base = dict(MUMBAI, date='1985/03/12', time='06:45:00', gpsLat=19.07, gpsLon=72.87, ad=1)
    ref = _srv_chart(dict(base, chartnum=1))['jyotish']['grahaMaitri']
    assert ref['basis'] == 'd1'
    for cn in (2, 9, 10, 60):
        cur = _srv_chart(dict(base, chartnum=cn))['jyotish']['grahaMaitri']
        assert json.dumps(cur, sort_keys=True) == json.dumps(ref, sort_keys=True), cn
    # 每格复合关系 == primitives.compound_relation(D1 星座)
    p = _kernel('1985/03/12', '06:45:00')
    d1 = {pid: safe_get(p.chart, pid).sign for pid in ref['planets']}
    for row in ref['matrix']:
        for c in row['cells']:
            if not c.get('self'):
                assert c['compound'] == compound_relation(row['planet'], c['planet'], d1)
    # 分盘视图下确有曜换座(否则上面的不变量是平凡的)
    from astrostudy.india.varga import varga_position
    moved = [pid for pid in d1
             if int(varga_position(float(safe_get(p.chart, pid).lon), 9) // 30) !=
             int(float(safe_get(p.chart, pid).lon) // 30)]
    assert moved
