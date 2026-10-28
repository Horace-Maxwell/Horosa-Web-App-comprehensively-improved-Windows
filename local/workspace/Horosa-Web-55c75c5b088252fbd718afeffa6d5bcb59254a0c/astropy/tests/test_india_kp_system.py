# -*- coding: utf-8 -*-
"""KP 六级细分体系 单元测试 + 权威例 golden。

覆盖：
  - kp_subdivide 六级链结构 + 上升 119°05′ 黄金例(Sub=Saturn, Prati=Sun)；
  - kp_249_table 子段计数 = 249 + 沿黄道连续/全覆盖；
  - cuspal_sublords(CSL) 结构 + 与 kp_subdivide 一致；
  - significators 四重法(星宿主优先) 结构与排序；
  - ruling_planets 五要素 + 去重集合。
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'flatlib-ctrad2'))

from astrostudy.india.kp_system import (  # noqa: E402
    kp_subdivide, kp_levels, kp_249_table, cuspal_sublords,
    significators, ruling_planets, sign_lord, WEEKDAY_LORDS,
    DASHA_ORDER, DASHA_YEARS, DASHA_TOTAL, NAK_SPAN,
)
from astrostudy.india.india_chart_kernel import IndiaChartKernel  # noqa: E402
from astrostudy.india.jyotish_engine import (  # noqa: E402
    JyotishEngine, CHOGHADIA_CYCLE, CHOGHADIA_DAY_FIRST)

# 权威例上升经度(恒星)：As=119°05′ ≈ 119.0833°，在柳宿(Ashlesha，宿主 Mercury)。
AS_LON = 119.0 + 5.0 / 60.0  # 119°05′


# ── 常数自洽 ─────────────────────────────────────────────────────────────
def test_dasha_constants():
    assert len(DASHA_ORDER) == 9
    assert sum(DASHA_YEARS.values()) == DASHA_TOTAL == 120
    # 顺序 Ketu·Venus·Sun·Moon·Mars·Rahu·Jupiter·Saturn·Mercury。
    assert DASHA_ORDER == ['Ketu', 'Venus', 'Sun', 'Moon', 'Mars',
                           'Rahu', 'Jupiter', 'Saturn', 'Mercury']


# ── 六级链结构 ───────────────────────────────────────────────────────────
def test_subdivide_chain_shape():
    chain = kp_subdivide(AS_LON, depth=6)
    assert len(chain) == 6
    assert [c['level'] for c in chain] == ['Nak', 'Sub', 'Prati', 'Sook', 'Praana', 'Deha']
    for c in chain:
        assert c['lord'] in DASHA_ORDER


def test_subdivide_depth_truncation():
    assert len(kp_subdivide(AS_LON, depth=1)) == 1
    assert len(kp_subdivide(AS_LON, depth=3)) == 3
    # 越界 depth 夹到 [1,6]。
    assert len(kp_subdivide(AS_LON, depth=99)) == 6
    assert len(kp_subdivide(AS_LON, depth=0)) == 1


# ── 黄金例(权威例逐步细分)：上升 119°05′ → Nak=Mercury, Sub=Saturn, Prati=Sun ──
def test_golden_ascendant_119_05():
    chain = kp_subdivide(AS_LON, depth=6)
    levels = {c['level']: c['lord'] for c in chain}
    assert levels['Nak'] == 'Mercury'    # 柳宿宿主
    assert levels['Sub'] == 'Saturn'     # 745′ 落 Saturn
    assert levels['Prati'] == 'Sun'      # Sa 子段内 71.67′ 落 Sun
    # kp_levels 便捷视图同结论。
    lv = kp_levels(AS_LON)
    assert lv['Nak'] == 'Mercury' and lv['Sub'] == 'Saturn' and lv['Prati'] == 'Sun'


def test_golden_within_nak_offset():
    # 宿内偏移 = 119.0833 − 106.6667 = 12.4167° = 745′。
    nak_start = 8 * NAK_SPAN  # 第9宿(柳)起点 = 8×13.3333 = 106.6667°
    offset_min = (AS_LON - nak_start) * 60.0
    assert abs(offset_min - 745.0) < 0.5


# ── 249 子段表 ───────────────────────────────────────────────────────────
def test_249_segment_count():
    table = kp_249_table()
    assert len(table) == 249


def test_249_continuous_and_covers_zodiac():
    table = kp_249_table()
    # 段首=0，段尾≈360，且首尾相接(无缝、无叠)。
    assert abs(table[0]['startLon'] - 0.0) < 1e-9
    assert abs(table[-1]['endLon'] - 360.0) < 1e-6
    for a, b in zip(table, table[1:]):
        assert abs(a['endLon'] - b['startLon']) < 1e-9
    # 27 宿 × 9 Sub = 243 原始段，再按星座 30° 边界拆 6 个跨界段 = 249(见计数专测)。
    # 此处验证沿黄道无缝覆盖、单段不跨星座、且各段主星有效。
    for seg in table:
        assert int(seg['startLon'] // 30) == int((seg['endLon'] - 1e-9) // 30)
        assert seg['subLord'] in DASHA_ORDER
        assert seg['starLord'] in DASHA_ORDER
        assert 1 <= seg['signNo'] <= 12


def test_249_subdivide_consistency():
    # 表中每段中点经度，kp_subdivide 的 Sub 应等于该段 subLord。
    table = kp_249_table()
    for seg in table:
        mid = (seg['startLon'] + seg['endLon']) / 2.0
        chain = kp_subdivide(mid, depth=2)
        assert chain[1]['lord'] == seg['subLord'], (
            seg['index'], mid, chain[1]['lord'], seg['subLord'])


# ── CSL(宫始子主) ────────────────────────────────────────────────────────
def test_cuspal_sublords_structure():
    cusps = [AS_LON + 30.0 * i for i in range(12)]  # 简化等距 cusp 仅测结构
    csl = cuspal_sublords(cusps)
    assert len(csl) == 12
    for i, row in enumerate(csl):
        assert row['house'] == i + 1
        assert row['subLord'] in DASHA_ORDER
        assert row['starLord'] in DASHA_ORDER
        # CSL 即该 cusp 的 kp_subdivide 第二级。
        assert row['subLord'] == kp_subdivide(row['cuspLon'], depth=2)[1]['lord']


def test_cuspal_sublords_house1_matches_golden():
    # 第1宫始点放权威例上升 → CSL = Saturn(=Sub)。
    csl = cuspal_sublords([AS_LON] + [None] * 11)
    assert csl[0]['subLord'] == 'Saturn'
    assert csl[0]['starLord'] == 'Mercury'
    # None cusp 安全降级。
    assert csl[1]['subLord'] is None


# ── 四重意义者 ───────────────────────────────────────────────────────────
def test_significators_star_lord_priority():
    # KP 标准四级:A=星主所占、B=自身所占、C=星主所主、D=自身所主。
    # A 的星主是 B;B 占 10 宫、主 7 宫;A 自占 3、自主 5。
    planet_data = {
        'A': {'sign': 1, 'house': 3, 'starLord': 'B', 'ownHouses': [5]},
        'B': {'sign': 5, 'house': 10, 'starLord': 'C', 'ownHouses': [7]},
        'C': {'sign': 9, 'house': 1, 'starLord': 'A', 'ownHouses': [11]},
    }
    sig = significators(planet_data)
    assert sig['A']['A'] == [10]      # 星主 B 所占
    assert sig['A']['B'] == [3]       # 自占
    assert sig['A']['C'] == [7]       # 星主 B 所主
    assert sig['A']['D'] == [5]       # 自主
    assert sig['A']['ranked'] == [10, 3, 7, 5]


def test_significators_influenced_is_separate():
    # 「落在本星宿里的行星」不属于 KP 四级:只进 influenced,不进 A-D / ranked。
    planet_data = {
        'A': {'sign': 1, 'house': 3, 'starLord': 'B', 'ownHouses': [5]},
        'B': {'sign': 5, 'house': 10, 'starLord': 'C', 'ownHouses': [7]},
        'C': {'sign': 9, 'house': 1, 'starLord': 'A', 'ownHouses': [11]},
    }
    sig = significators(planet_data)
    assert sig['A']['influenced'] == ['C']
    assert 1 not in sig['A']['ranked'] and 11 not in sig['A']['ranked']


def test_significators_keys_per_planet():
    planet_data = {
        'Sun': {'sign': 11, 'house': 8, 'starLord': 'Rahu', 'ownHouses': [2]},
        'Rahu': {'sign': 8, 'house': 5, 'starLord': 'Mars', 'ownHouses': []},
        'Mars': {'sign': 12, 'house': 9, 'starLord': 'Saturn', 'ownHouses': [6, 9]},
    }
    sig = significators(planet_data)
    assert set(sig.keys()) == {'Sun', 'Rahu', 'Mars'}
    for p in sig:
        assert set(sig[p].keys()) == {'A', 'B', 'C', 'D', 'ranked', 'influenced'}
        # 各级升序、去重。
        for tier in ('A', 'B', 'C', 'D'):
            assert sig[p][tier] == sorted(set(sig[p][tier]))


# ── Ruling Planets ───────────────────────────────────────────────────────
def test_sign_lord_mapping():
    # 巨蟹(4)主月、狮子(5)主日、白羊(1)主火、摩羯/水瓶(10/11)主土。
    assert sign_lord(4) == 'Moon'
    assert sign_lord(5) == 'Sun'
    assert sign_lord(1) == 'Mars'
    assert sign_lord(10) == 'Saturn'
    assert sign_lord(11) == 'Saturn'


def test_weekday_lords_order():
    # 0=周一..6=周日 → Moon,Mars,Mercury,Jupiter,Venus,Saturn,Sun。
    assert WEEKDAY_LORDS == ['Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Sun']


def test_ruling_planets_structure():
    # 上升巨蟹(4)/宿主 Mercury，月亮射手(9)/宿主 Venus，周三(weekday=2 → Mercury)。
    rp = ruling_planets(lagna_sign=4, lagna_nak_lord='Mercury',
                        moon_sign=9, moon_nak_lord='Venus', weekday=2)
    assert rp['lagnaSignLord'] == 'Moon'      # 巨蟹主月
    assert rp['lagnaNakLord'] == 'Mercury'
    assert rp['moonSignLord'] == 'Jupiter'    # 射手主木
    assert rp['moonNakLord'] == 'Venus'
    assert rp['weekdayLord'] == 'Mercury'     # 周三主水
    # set 去重保序：Moon,Mercury,Jupiter,Venus(Mercury 第二次出现被去重)。
    assert rp['set'] == ['Moon', 'Mercury', 'Jupiter', 'Venus']


def test_ruling_planets_weekday_wrap():
    rp = ruling_planets(1, 'Mars', 1, 'Mars', weekday=6)  # 周日 → Sun
    assert rp['weekdayLord'] == 'Sun'
    # 全是 Mars/Mars/Mars/Mars + Sun → set 去重为 [Mars, Sun]。
    assert rp['set'] == ['Mars', 'Sun']


def _kp_engine():
    data = {'date': '1990/3/15', 'time': '07:30:00', 'zone': '+05:30',
            'lat': '28n36', 'lon': '77e12', 'indiaHsys': 3, 'indiaAyanamsa': 'krishnamurti'}
    return JyotishEngine(IndiaChartKernel(data))


def test_csl_uses_real_placidus_cusps():
    # P0-9:KP CSL 用真 Placidus 不等宫(非等宫),首宫始 = 上升点,对宫相隔 180°。
    e = _kp_engine()
    kp = e.kp()
    assert kp['cuspMode'] == 'placidus_sidereal'
    csl = kp['cuspalSubLords']
    assert len(csl) == 12
    # 首宫 = 上升点(KP 真不等宫硬约束)。
    assert abs(csl[0]['cuspLon'] - float(e.asc.lon)) < 1e-6
    # 不等宫:至少一宫间隔显著偏离 30°。
    gaps = [(csl[(i + 1) % 12]['cuspLon'] - csl[i]['cuspLon']) % 360 for i in range(12)]
    assert any(abs(g - 30.0) > 1.0 for g in gaps)
    # 对宫相隔 180°(Placidus 轴对称)。
    for i in range(6):
        assert abs(((csl[i + 6]['cuspLon'] - csl[i]['cuspLon']) % 360) - 180.0) < 1e-6
    # 每宫齐备 subLord。
    assert all(c['subLord'] for c in csl)


def test_choghadia_weekday_first_and_structure():
    # P1 Choghadia:昼首段 weekday 表(周日 Udveg..周六 Kaal)+ 吉凶分类 + 16 段。
    expect_first = ['Udveg', 'Amrit', 'Rog', 'Labh', 'Shubh', 'Char', 'Kaal']
    for wd in range(7):
        assert CHOGHADIA_CYCLE[CHOGHADIA_DAY_FIRST[wd]]['key'] == expect_first[wd]
    good = {c['key'] for c in CHOGHADIA_CYCLE if c['nature'] == 'good'}
    bad = {c['key'] for c in CHOGHADIA_CYCLE if c['nature'] == 'bad'}
    assert good == {'Amrit', 'Shubh', 'Labh', 'Char'}
    assert bad == {'Rog', 'Kaal', 'Udveg'}
    # 引擎产出:16 段、昼夜各 8、夜首 = 昼首 +5。
    e = _kp_engine()
    ch = e.muhurta()['choghadia']
    assert len(ch['rows']) == 16
    day = [r for r in ch['rows'] if r['period'] == 'day']
    night = [r for r in ch['rows'] if r['period'] == 'night']
    assert len(day) == 8 and len(night) == 8
    di = CHOGHADIA_DAY_FIRST[ch['weekday']]
    assert day[0]['key'] == CHOGHADIA_CYCLE[di]['key']
    assert night[0]['key'] == CHOGHADIA_CYCLE[(di + 5) % 7]['key']


def test_panchaka_and_abhijit():
    # §24.2 Panchaka:((Tithi+Vara+Nakshatra+Lagna)×2)%9,余1/2/4/6/8 为忌(死火王盗病);
    # Abhijit:第 8 昼须臾,周三外大吉。
    import datetime
    e = _kp_engine()
    mu = e.muhurta()
    p = mu['panchaka']
    assert 0 <= p['remainder'] <= 8
    assert p['isPanchaka'] == (p['remainder'] in {1, 2, 4, 6, 8})
    if p['isPanchaka']:
        assert p['type'] in ('Mrityu', 'Agni', 'Raja', 'Chora', 'Roga')
    a = mu['abhijit']
    assert a['muhurtaIndex'] == 8
    # 周三盘 Abhijit 不吉。
    from astrostudy.india.india_chart_kernel import IndiaChartKernel
    from astrostudy.india.jyotish_engine import JyotishEngine
    wed = {'date': '1990/3/14', 'time': '12:00:00', 'zone': '+05:30',
           'lat': '28n36', 'lon': '77e12', 'indiaHsys': 0, 'indiaAyanamsa': 'lahiri'}
    assert datetime.date(1990, 3, 14).weekday() == 2   # Python Wed
    assert JyotishEngine(IndiaChartKernel(wed)).muhurta()['abhijit']['auspicious'] is False
