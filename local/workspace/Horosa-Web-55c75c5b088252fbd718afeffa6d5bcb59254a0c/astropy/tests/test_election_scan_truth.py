# -*- coding: utf-8 -*-
"""天星择日·真相锚测试:每类条件用两条**独立算法路径**扫同一时段,断言区间逐条恒等。

与矩阵(结构级/自洽级)的区别:这里的第二路径不是复读引擎自身谓词,而是
  ① 语义恒等的**另一类条件**(不同 evaluator、不同求解器):
     in_sign ≡ numeric between;via_combusta ≡ numeric;reception ≡ in_sign;
     mutual ≡ in_sign 组合树;rulership ≡ in_sign 并;cazimi∪combust ≡ aspect(0°);
     midpoint(mod180) ≡ aspect0∪aspect180;point_relation(fixedLon) ≡ numeric;
     day_window 跨午夜 ≡ NOT 反窗;moon_waxing ≡ NOT moon_waning;
  ② 或**裸 swisseph/flatlib 直算**复核(不经 LightMoment/引擎判定):
     in_house 区间中点独立建 flatlib Chart;besieged 中点裸 calc_ut 排序验最近邻;
     grand_trine 中点裸角距验 120°±orb。
两路径同界=同一物理真相;任一路漏检/边界漂移即失败。真实天文事件窗口
(2024 太阳入处女/金星入巨蟹/水星下合与顺留/合朔望)另以非退化断言钉住。
"""
import pytest

from astrostudy import election_scan as es


BASE = {
    'startDate': '2024/04/07', 'startTime': '00:00:00',
    'endDate': '2024/04/14', 'endTime': '00:00:00',
    'zone': '+00:00', 'gpsLat': 39.9042, 'gpsLon': 116.4074,
    'hsys': 0, 'zodiacal': 0, 'ad': 1, 'precision': 'minute',
}


def run(tree, **over):
    data = dict(BASE)
    data.update(over)
    data['conditions'] = tree
    rsp = es.scan(data)
    assert 'err' not in rsp, rsp
    return rsp['intervals']


def leaf(t, **params):
    return {'type': t, 'params': params}


def A(*c):
    return {'type': 'all', 'conditions': list(c)}


def O(*c):  # noqa: E741
    return {'type': 'any', 'conditions': list(c)}


def N(c):
    return {'type': 'not', 'conditions': [c]}


def same_intervals(x, y, tol_min=2.5):
    """两条独立路径的区间序列恒等(边界二分精度容差)。"""
    assert len(x) == len(y), 'count {0} vs {1}\nA={2}\nB={3}'.format(len(x), len(y), x, y)
    for a, b in zip(x, y):
        assert abs(a['startJd'] - b['startJd']) * 1440.0 <= tol_min, (a, b)
        assert abs(a['endJd'] - b['endJd']) * 1440.0 <= tol_min, (a, b)


def covered_by(small, big, tol_min=2.5):
    """small 的每个区间都被 big 的某区间覆盖(⊂ 断言)。"""
    t = tol_min / 1440.0
    for s in small:
        assert any(b['startJd'] - t <= s['startJd'] and s['endJd'] <= b['endJd'] + t
                   for b in big), (s, big)


# ── T1 midpoint 单星退化 mod180 ≡ aspect(0°)∪aspect(180°)(A类求根 vs dial 残差) ──

def test_t1_midpoint_dial_vs_aspect_union():
    win = {'endDate': '2024/04/25'}  # 含 4/8 合朔 + 4/23 满月
    mp = run(leaf('midpoint', a='Moon', b='Moon',
                  target={'kind': 'planet', 'id': 'Sun'}, modulus=180, orb=5), **win)
    def _asp(angle):
        return leaf('aspect', planetA='Moon', planetB='Sun', angle=angle, orb=5,
                    motion='any', side='any', partile='off')
    union = run(O(_asp(0), _asp(180)), **win)
    assert len(mp) >= 2, mp  # 朔+望两段(真实月相事件)
    same_intervals(mp, union)


# ── T2 in_sign ≡ numeric Long between(入座边界=2024/08/22 太阳入处女) ──

def test_t2_in_sign_vs_numeric_longitude():
    win = {'startDate': '2024/08/20', 'endDate': '2024/08/26'}
    a = run(leaf('in_sign', planet='Sun', signs=[5]), **win)
    b = run(leaf('numeric', planet='Sun', field='Long', op='between',
                 value=150.0, value2=180.0), **win)
    assert len(a) == 1, a  # 8/22 入处女后直到窗尾
    same_intervals(a, b)


# ── T3 单向接纳(宽松) ≡ 落座:月接纳金星 by ruler ⇔ 金星在巨蟹(2024/06/17 入) ──

def test_t3_reception_vs_in_sign():
    win = {'startDate': '2024/06/15', 'endDate': '2024/06/20'}
    a = run(leaf('reception', planetA='Moon', planetB='Venus',
                 levels=['ruler'], match='any', requireAspect=False), **win)
    b = run(leaf('in_sign', planet='Venus', signs=[3]), **win)
    assert len(a) == 1, a  # 金星 6/17 入巨蟹→窗尾
    same_intervals(a, b)


# ── T4 庙互容 ≡ 庙座组合树(水金牛∧金双子 等 2×2 之并;2024/05/29-06/05 真互容尾段) ──

def test_t4_mutual_reception_vs_sign_combination():
    win = {'startDate': '2024/05/29', 'endDate': '2024/06/05'}
    a = run(leaf('mutual_reception', planetA='Mercury', planetB='Venus',
                 levels=['ruler'], pairing='any_pair', requireAspect=False), **win)

    def both(msign, vsign):
        return A(leaf('in_sign', planet='Mercury', signs=[msign]),
                 leaf('in_sign', planet='Venus', signs=[vsign]))
    # 水星庙={双子2,处女5};金星庙={金牛1,天秤6}:互容⇔水在{1,6}∧金在{2,5}
    b = run(O(both(1, 2), both(1, 5), both(6, 2), both(6, 5)), **win)
    assert len(a) >= 1, a  # 水金牛+金双子的真互容段(至 6/3 水星入双子)
    same_intervals(a, b)


# ── T5 定位星 ≡ 落座并:月的庙主是火星 ⇔ 月在白羊/天蝎 ──

def test_t5_rulership_dispositor_vs_signs():
    a = run(leaf('rulership', planetA='Moon', planetB='Mars', mode='dispositor_is'))
    b = run(leaf('in_sign', planet='Moon', signs=[0, 7]))
    assert len(a) >= 1, a  # 窗内月过白羊
    same_intervals(a, b)


# ── T6 cazimi∪combust ≡ aspect(0°, orb=combustOrb)(2024/04/11 水星下合) ──

def test_t6_sun_proximity_states_vs_conjunction():
    win = {'startDate': '2024/04/09', 'endDate': '2024/04/14'}
    a = run(O(leaf('dignity_state', planet='Mercury', states=['cazimi']),
              leaf('dignity_state', planet='Mercury', states=['combust'])), **win)
    b = run(leaf('aspect', planetA='Mercury', planetB='Sun', angle=0, orb=8.5,
                 motion='any', side='any', partile='off'), **win)
    assert len(a) >= 1, a
    same_intervals(a, b)
    # cazimi 单独段真实存在(下合日心穿越)且 ⊂ 并集
    cz = run(leaf('dignity_state', planet='Mercury', states=['cazimi']), **win)
    assert len(cz) >= 1, cz
    covered_by(cz, a)


# ── T7 顺行留(2024/04/25) ⊇ 速度趋零小窗(numeric LongSpeed) ──

def test_t7_station_covers_zero_speed_window():
    win = {'startDate': '2024/04/23', 'endDate': '2024/04/27'}
    st = run(leaf('dignity_state', planet='Mercury', states=['station']), **win)
    z = run(leaf('numeric', planet='Mercury', field='LongSpeed', op='between',
                 value=-0.005, value2=0.005), **win)
    assert len(st) >= 1 and len(z) >= 1, (st, z)  # 真实顺行留事件
    covered_by(z, st)  # 0.005°/d 窗 ⊂ 0.05°/d station 窗


# ── T8 燃烧之路 ≡ numeric 月黄经 between[195,225)(月过天秤中→天蝎中) ──

def test_t8_via_combusta_vs_numeric():
    win = {'startDate': '2024/04/16', 'endDate': '2024/04/24'}
    a = run(leaf('considerations', item='via_combusta', variant='standard'), **win)
    b = run(leaf('numeric', planet='Moon', field='Long', op='between',
                 value=195.0, value2=225.0), **win)
    assert len(a) == 1, a  # 单次过境 ~2.2 天
    same_intervals(a, b)


# ── T9 增光 ≡ NOT 减光(月相互补;含 4/8 合朔翻转点) ──

def test_t9_waxing_complement_waning():
    a = run(leaf('considerations', item='moon_waxing'))
    b = run(N(leaf('considerations', item='moon_waning')))
    assert len(a) >= 1, a
    same_intervals(a, b)


# ── T10 点关系(固定黄经,显式 0°) ≡ numeric between ──

def test_t10_point_relation_fixed_lon_vs_numeric():
    win = {'startDate': '2024/04/16', 'endDate': '2024/04/24'}
    a = run(leaf('point_relation', planet='Moon',
                 point={'kind': 'fixedLon', 'lon': 200.0},
                 relation='angles', angles=[0], orb=5), **win)
    b = run(leaf('numeric', planet='Moon', field='Long', op='between',
                 value=195.0, value2=205.0), **win)
    assert len(a) == 1, a
    same_intervals(a, b)


# ── T11 跨午夜时间窗 ≡ NOT 反窗(纯历法解析,零误差级) ──

def test_t11_day_window_complement():
    a = run(leaf('day_window', **{'from': '22:00', 'to': '02:00'}))
    b = run(N(leaf('day_window', **{'from': '02:00', 'to': '22:00'})))
    assert len(a) >= 6, a  # 7 天窗每日一段(首尾可能截半)
    same_intervals(a, b, tol_min=0.2)


# ── T12 宫位区间:中点/间隙用独立 flatlib Chart 复算(不经 LightMoment) ──

def test_t12_in_house_independent_chart_recheck():
    from flatlib import const
    from flatlib.chart import Chart
    from flatlib.datetime import Datetime
    from flatlib.geopos import GeoPos

    ivs = run(leaf('in_house', planet='Moon', houses=[10]),
              endDate='2024/04/10')
    assert len(ivs) >= 1, ivs

    def house_of(jd):
        dt = Datetime.fromJD(jd, '+00:00')
        chart = Chart(dt, GeoPos('39n54', '116e24'), hsys=const.HOUSES_WHOLE_SIGN,
                      IDs=const.LIST_OBJECTS_TRADITIONAL)
        return int(chart.houses.getObjectHouse(chart.get(const.MOON)).id[5:])

    prev_end = None
    for iv in ivs:
        mid = (iv['startJd'] + iv['endJd']) / 2.0
        assert house_of(mid) == 10, iv
        if prev_end is not None and iv['startJd'] - prev_end > 4e-3:
            gap = (prev_end + iv['startJd']) / 2.0
            assert house_of(gap) != 10, iv
        prev_end = iv['endJd']


# ── T13 体围区间中点:裸 swisseph 排序独立复核最近邻=攻星组 ──

def test_t13_besieged_midpoint_raw_ephemeris_recheck():
    import swisseph

    # 攻星组按裸星历实况定(2024/04/10 00h UT 月两侧最近邻=水星/木星,已裸扫核实)
    ivs = run(leaf('besieged', target='Moon', besiegerA='Mercury', besiegerB='Jupiter',
                   mode='body', orbLeft=60, orbRight=60,
                   rescue={'enabled': False}, mitigation={}),
              startDate='2024/04/09', endDate='2024/04/12')
    assert len(ivs) >= 1, ivs
    anchor = swisseph.julday(2024, 4, 10, 0)  # 已核实处于被围态的真实时刻
    assert any(iv['startJd'] <= anchor <= iv['endJd'] for iv in ivs), (anchor, ivs)
    bodies = {'Sun': swisseph.SUN, 'Moon': swisseph.MOON, 'Mercury': swisseph.MERCURY,
              'Venus': swisseph.VENUS, 'Mars': swisseph.MARS,
              'Jupiter': swisseph.JUPITER, 'Saturn': swisseph.SATURN}
    for iv in ivs[:3]:
        mid = (iv['startJd'] + iv['endJd']) / 2.0
        lons = {k: swisseph.calc_ut(mid, v)[0][0] for k, v in bodies.items()}
        moon = lons.pop('Moon')
        ahead = min(lons, key=lambda k: (lons[k] - moon) % 360.0)
        behind = min(lons, key=lambda k: (moon - lons[k]) % 360.0)
        assert {ahead, behind} == {'Mercury', 'Jupiter'}, (iv, ahead, behind, lons)


# ── T14 大三角命中中点:裸角距独立复核三星两两 120°±orb ──

def test_t14_grand_trine_midpoint_raw_recheck():
    import swisseph
    from itertools import combinations

    # 金火土慢星大三角 2024/09/28-10/11(全年裸扫核实的最长真窗)
    win = {'startDate': '2024/09/26', 'endDate': '2024/10/03'}
    ivs = run(leaf('aspect_pattern', pattern='grand_trine', apex='any',
                   members='any', orb=8), **win)
    assert len(ivs) >= 1, ivs
    bodies = {'Sun': swisseph.SUN, 'Moon': swisseph.MOON, 'Mercury': swisseph.MERCURY,
              'Venus': swisseph.VENUS, 'Mars': swisseph.MARS,
              'Jupiter': swisseph.JUPITER, 'Saturn': swisseph.SATURN}

    def d(a, b):
        x = abs((a - b) % 360.0)
        return min(x, 360.0 - x)

    for iv in ivs[:3]:
        mid = (iv['startJd'] + iv['endJd']) / 2.0
        lons = {k: swisseph.calc_ut(mid, v)[0][0] for k, v in bodies.items()}
        found = any(
            all(abs(d(lons[p], lons[q]) - 120.0) <= 8.0 for p, q in combinations(trio, 2))
            for trio in combinations(lons, 3))
        assert found, (iv, lons)


# ── T15 皇室伴寝(ref=Sun) ≡ dignity_state oriental/occidental(两条独立实现路径) ──

def test_t15_royal_vs_dignity_orientality():
    """2024/04/07-14 金星黄经恒小于太阳 → 整窗东升侧(西没侧空也是真相,空≡空同样对拍)。"""
    hits = 0
    for slot, state in (('any_oriental', 'oriental'), ('any_occidental', 'occidental')):
        a = run(leaf('royal_attendance', ref='Sun', slot=slot, companion='Venus'))
        b = run(leaf('dignity_state', planet='Venus', states=[state]))
        same_intervals(a, b)
        hits += len(a)
    assert hits >= 1, '两侧不可能同时为空(互补关系)'


# ── T16 交点弯曲 ≡ point_relation(北交 90°±3)(不同求解器:布尔翻转 vs 残差求根) ──

def test_t16_bending_vs_point_relation():
    win = {'endDate': '2024/05/06'}  # 29 天>恒星月:月过北弯/南弯各至少一次
    a = run(leaf('light_dynamics', item='bending', planet='Moon', which='any'), **win)
    b = run(leaf('point_relation', planet='Moon',
                 point={'kind': 'planet', 'id': 'North Node'},
                 relation='angles', angles=[90], orb=3), **win)
    assert len(a) >= 2, a
    same_intervals(a, b)


# ── T17 座喜乐 ≡ 落座(props.signJoy 单点表 vs in_sign 求根,两独立路径) ──

def test_t17_sign_joy_vs_in_sign():
    win = {'startDate': '2024/04/14', 'endDate': '2024/04/22'}  # 月过巨蟹一次
    a = run(leaf('sect_joy', item='sign_joy', planet='Moon'), **win)
    b = run(leaf('in_sign', planet='Moon', signs=[3]), **win)   # 月喜巨蟹
    assert len(a) == 1, a
    same_intervals(a, b)


# ── T18 月站第1宿 ≡ numeric 黄经 between[0, 360/28)(查表翻转 vs 残差求根) ──

def test_t18_mansion_vs_numeric():
    win = {'startDate': '2024/04/07', 'endDate': '2024/04/10'}
    a = run(leaf('degree_state', planet='Moon', item='mansion', mansion=1), **win)
    b = run(leaf('numeric', planet='Moon', field='Long', op='between',
                 value=0.0, value2=360.0 / 28.0), **win)
    assert len(a) >= 1, a
    same_intervals(a, b)


# ── T19 护符择时 ⊇ 月落旬(半锚:ASC 通道无独立叶,月通道用 numeric 独立复算) ──

def test_t19_talisman_covers_moon_decan():
    win = {'startDate': '2024/04/07', 'endDate': '2024/04/10'}
    tal = run(leaf('decan_state', mode='talisman', decans=[2]), **win)
    moon = run(leaf('numeric', planet='Moon', field='Long', op='between',
                    value=10.0, value2=20.0), **win)
    assert len(moon) >= 1, moon
    covered_by(moon, tal)


# ── T20 终极主宰 ≡ 庙(finals 定义=落自家庙座;两独立实现:座主链 vs essential 表) ──

def test_t20_final_dispositor_vs_ruler_dignity():
    for pl in ('Mars', 'Venus', 'Saturn'):
        a = run(leaf('dispositor_cycle', mode='final_is', planet=pl))
        b = run(leaf('dignity_state', planet=pl, states=['ruler']))
        same_intervals(a, b)


# ── T21 二星互容环 ≡ mutual_reception(ruler,宽松)(座主链环 vs chartdynamics) ──

def test_t21_two_star_loop_vs_mutual_reception():
    win = {'startDate': '2024/05/29', 'endDate': '2024/06/05'}  # 水金庙互容真窗
    a = run(A(leaf('dispositor_cycle', mode='in_loop', planet='Mercury'),
              leaf('dispositor_cycle', mode='in_loop', planet='Venus')), **win)
    b = run(leaf('mutual_reception', planetA='Mercury', planetB='Venus',
                 levels=['ruler'], pairing='any_pair', requireAspect=False), **win)
    assert len(b) >= 1
    # 环包含关系:水金庙互容 ⟹ 两星同环(环也可能含第三星,故 ⊇)
    covered_by(b, a)


# ── T22 龙脉裸复核:命中区间中点裸 calc_ut 复算北交轴两侧分布 ──

def test_t22_dragon_raw_recheck():
    import swisseph
    win = {'startDate': '2024/04/07', 'endDate': '2024/05/07'}
    ivs = run(leaf('pattern_overview', item='dragon_intercept'), **win)
    bodies = {'Sun': swisseph.SUN, 'Moon': swisseph.MOON, 'Mercury': swisseph.MERCURY,
              'Venus': swisseph.VENUS, 'Mars': swisseph.MARS,
              'Jupiter': swisseph.JUPITER, 'Saturn': swisseph.SATURN}
    checked = 0
    for iv in ivs[:3]:
        mid = 0.5 * (iv['startJd'] + iv['endJd'])
        node = swisseph.calc_ut(mid, swisseph.MEAN_NODE)[0][0]
        small = 0
        for v in bodies.values():
            lon = swisseph.calc_ut(mid, v)[0][0]
            if (lon - node) % 360.0 < 180.0:
                small += 1
        small = min(small, 7 - small)
        assert small in (1, 2), (iv, small)
        checked += 1
    assert checked >= 1, '一月窗内月亮扫轴必有龙截段'


# ── T23 映点金式:antiscia ≡ midpoint(单星,target=fixedLon 90°,mod 180,orb/2)
#    数学:|wrap180(180−a − t)| ≤ orb ⇔ dial180(mid(a,a) − 90 相对 t 对称式);
#    直接用双星表达:mid(A,A)=A 与「180−t」…改用第二独立路径 = numeric 组合:
#    A 映点合 fixedLon T ⇔ A ∈ [180−T−orb, 180−T+orb] ⇔ numeric between(两独立求解器)。──

def test_t23_antiscia_vs_numeric():
    win = {'startDate': '2024/04/16', 'endDate': '2024/04/24'}
    a = run(leaf('antiscia', planet='Moon', kind='antiscia',
                 target={'kind': 'fixedLon', 'lon': 340.0}, orb=4), **win)
    b = run(leaf('numeric', planet='Moon', field='Long', op='between',
                 value=196.0, value2=204.0), **win)   # 180−340=−160≡200
    assert len(a) == 1, a
    same_intervals(a, b)


def test_t23b_contra_vs_numeric():
    win = {'startDate': '2024/04/16', 'endDate': '2024/04/24'}
    a = run(leaf('antiscia', planet='Moon', kind='contra',
                 target={'kind': 'fixedLon', 'lon': 160.0}, orb=4), **win)
    b = run(leaf('numeric', planet='Moon', field='Long', op='between',
                 value=196.0, value2=204.0), **win)   # 360−160=200
    assert len(a) == 1, a
    same_intervals(a, b)


# ── T24 恒星触发 ≡ point_relation(fixedLon=星经)(两独立求解器;星经域中点冻结) ──

def test_t24_fixed_star_vs_point_relation():
    import swisseph
    win = {'startDate': '2024/04/14', 'endDate': '2024/04/20'}  # 月 4/17 过狮子尾轩辕
    jd_mid = 0.5 * (swisseph.julday(2024, 4, 14, 0) + swisseph.julday(2024, 4, 20, 0))
    reg_lon = swisseph.fixstar_ut('Regulus', jd_mid, swisseph.FLG_SWIEPH)[0][0]
    a = run(leaf('fixed_star', star='Regulus',
                 target={'kind': 'planet', 'id': 'Moon'}, orb=2), **win)
    b = run(leaf('point_relation', planet='Moon',
                 point={'kind': 'fixedLon', 'lon': reg_lon},
                 relation='angles', angles=[0], orb=2), **win)
    assert len(a) == 1, a   # 月每月过狮子轩辕一次
    same_intervals(a, b)


# ── T25 行星时:昼 12 时并集 ≡ 日在地平上(同 rise_trans 口径,近零容差);
#    值日星七政并 ≡ 全域 ──

def test_t25_planetary_hours_day_union_vs_sun_above():
    hours = run(O(*[leaf('planetary_hour', kind='hour_ruler', planet=pl)
                    for pl in ('Saturn', 'Jupiter', 'Mars', 'Sun', 'Venus', 'Mercury', 'Moon')]))
    full = 7 * 1440.0   # truth BASE 窗=7 天
    tot = sum(i['durationMin'] for i in hours)
    assert abs(tot - full) < 3.0, '24 时全并=全域'
    day_rulers = run(O(*[leaf('planetary_hour', kind='day_ruler', planet=pl)
                         for pl in ('Saturn', 'Jupiter', 'Mars', 'Sun', 'Venus', 'Mercury', 'Moon')]))
    tot_d = sum(i['durationMin'] for i in day_rulers)
    # day 并集=从首个域内日出到域尾(域首至首个日出前不属任何"日")
    assert tot_d <= full + 1e-6 and tot_d >= full - 24 * 60.0


def test_t25b_planetary_hour_boundary_vs_astroextra():
    """首个值时段边界 vs compute_planetary_hours(同日出同表,分钟容差)。"""
    import swisseph
    from astrostudy import perchart as pch
    from astrostudy import astroextra

    ivs = run(leaf('planetary_hour', kind='hour_ruler', planet='Sun'),
              endDate='2024/04/08')
    assert ivs
    mid = 0.5 * (ivs[0]['startJd'] + ivs[0]['endJd'])
    rec = es.date_time_from_jd(mid, '+00:00')
    ph = astroextra.compute_planetary_hours({
        'date': rec['date'].replace('-', '/'), 'time': rec['time'],
        'zone': '+00:00', 'lat': '39N54', 'lon': '116E28',
    })
    hit = [h for h in ph['hours'] if h.get('current')]
    assert hit and hit[0]['ruler'] == 'Sun', hit


# ── T26 生命主手推锚:北京正午太阳近 MC(10宫)=托勒密首选释放位 → hyleg=sun ──

def test_t26_hyleg_manual_noon_anchor():
    ivs = run(leaf('lifespan_state', item='hyleg_is', method='ptolemy', point='sun'),
              startDate='2024/04/08', startTime='03:30:00',
              endDate='2024/04/08', endTime='04:30:00', zone='+00:00')
    # 北京 11:30-12:30 当地,太阳在 10 宫(整宫)→昼盘首查太阳命中
    tot = sum(i['durationMin'] for i in ivs)
    assert tot > 50, ivs


# ── T27 家主星 ≡ 生命主座庙主(独立路径:rulership 家族推导) ──

def test_t27_oikodespotes_consistency():
    """hyleg=sun 段内,家主星=太阳所落座庙主——与 rulership(dispositor_is) 联立恒等。"""
    win = {'startDate': '2024/04/08', 'startTime': '03:30:00',
           'endDate': '2024/04/08', 'endTime': '04:30:00', 'zone': '+00:00'}
    # 太阳白羊(4/8)→庙主火星;联立:hyleg=sun ∧ oikodespotes=Mars 应=hyleg=sun 全段
    a = run(A(leaf('lifespan_state', item='hyleg_is', method='ptolemy', point='sun'),
              leaf('lifespan_state', item='oikodespotes_is', method='ptolemy', planet='Mars')), **win)
    b = run(leaf('lifespan_state', item='hyleg_is', method='ptolemy', point='sun'), **win)
    same_intervals(a, b)


# ── T28 显赫档自证:eminent 区间 pick 时刻引擎复算 ≥8;obscure 区间 <3(与页签同式) ──

def test_t28_eminence_band_pick_recheck():
    import swisseph
    from astrostudy import election_scan_ext as ext

    win = {'startDate': '2026/08/02', 'endDate': '2026/09/01', 'zone': '+08:00',
           'gpsLat': 26.08, 'gpsLon': 119.32}
    data = dict(BASE)
    data.update(win)
    ctx = es.ScanContext(data)
    ctx._syz_lo = swisseph.julday(2026, 8, 1, 0)
    ctx._syz_hi = swisseph.julday(2026, 9, 2, 0)
    checked = 0
    for band, lo, hi in (('eminent', 8.0, 10.01), ('ordinary', 3.0, 5.51)):
        ivs = run(leaf('eminence_level', op='band', band=band), **win)
        for iv in ivs[:3]:
            pick_jd = iv['startJd'] + min(90.0 / 86400.0, (iv['endJd'] - iv['startJd']) / 4.0)
            t = ext.eminence_total(ctx.moment(pick_jd), ctx)
            assert lo <= t < hi, (band, iv, t)
            checked += 1
    assert checked >= 1, '一月内至少一档非空'
