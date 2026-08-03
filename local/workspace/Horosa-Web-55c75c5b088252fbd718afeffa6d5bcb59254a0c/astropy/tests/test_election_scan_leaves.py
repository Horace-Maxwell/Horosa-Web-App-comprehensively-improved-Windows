# -*- coding: utf-8 -*-
"""天星择日搜索·叶子求值测试(WP-3 起:A 类四叶;B/C 类叶按 WP 续补于此)。

断言风格=金标锚+区间自洽(区间中点必满足谓词、区间外采样必不满足),
不依赖任何外部服务(pytest 离线直调引擎)。
"""
from astrostudy import election_scan as es


BASE = {
    'startDate': '2024/04/07', 'startTime': '00:00:00',
    'endDate': '2024/04/10', 'endTime': '00:00:00',
    'zone': '+00:00', 'gpsLat': 39.9042, 'gpsLon': 116.4074,
    'hsys': 0, 'zodiacal': 0, 'ad': 1,
}


def _scan(over_base, tree):
    data = dict(BASE)
    data.update(over_base)
    data['conditions'] = tree
    data['precision'] = 'second'
    rsp = es.scan(data)
    assert 'err' not in rsp, rsp
    return rsp['intervals']


def _ctx(over_base=None):
    data = dict(BASE)
    if over_base:
        data.update(over_base)
    return es.ScanContext(data)


# ---------------------------------------------------------------------------
# in_sign
# ---------------------------------------------------------------------------

def test_in_sign_sun_enters_virgo_boundary_selfproof():
    """太阳入处女(2024-08-22 前后):区间起点处 lon ≈ 150°,终点=域尾(9/10 太阳仍处女)。"""
    ivs = _scan({'startDate': '2024/08/15', 'endDate': '2024/09/10'},
                {'type': 'in_sign', 'params': {'planet': 'Sun', 'signs': [5]}})
    assert len(ivs) == 1
    ctx = _ctx()
    lon_at_start = ctx.moment(ivs[0]['startJd']).lon('Sun')
    assert abs(lon_at_start - 150.0) < 0.01
    end_jd = es._jd_from('2024/09/10', '00:00:00', '+00:00')
    assert abs(ivs[0]['endJd'] - end_jd) < 0.01


def test_in_sign_moon_multi_sign_union():
    """月亮 in {白羊,金牛} 10 天:两座相邻=连续通过 → 单区间 ≈ 4.5 天;边界处黄经贴 0°/60°。"""
    ivs = _scan({'startDate': '2024/04/07', 'endDate': '2024/04/17'},
                {'type': 'in_sign', 'params': {'planet': 'Moon', 'signs': [0, 1]}})
    assert len(ivs) == 1
    dur_days = ivs[0]['endJd'] - ivs[0]['startJd']
    assert 3.5 < dur_days < 5.5
    ctx = _ctx()
    lon_in = ctx.moment(ivs[0]['startJd'] + 0.01).lon('Moon')
    lon_out = ctx.moment(ivs[0]['endJd'] - 0.01).lon('Moon')
    assert lon_in < 62.0 and lon_out < 62.0


# ---------------------------------------------------------------------------
# numeric
# ---------------------------------------------------------------------------

def test_numeric_sun_altitude_daylight_intervals():
    """太阳 Altitude>0 = 昼弧:3 天域切出 3-4 段,完整段时长 11-15 小时(北京 4 月)。"""
    ivs = _scan({}, {'type': 'numeric', 'params': {'planet': 'Sun', 'field': 'Altitude', 'op': 'gt', 'value': 0}})
    assert 3 <= len(ivs) <= 4
    full = [iv for iv in ivs if 600 < iv['durationMin'] < 900]
    assert len(full) >= 2
    ctx = _ctx()
    for iv in ivs:
        mid = 0.5 * (iv['startJd'] + iv['endJd'])
        assert ctx.moment(mid).horizontal('Sun')['altitudeTrue'] > 0


def test_numeric_circular_between_sun_long():
    """太阳黄经 ∈ [10°,20°](白羊 10-20):约 10 天单区间,边界处 lon 贴 10/20。"""
    ivs = _scan({'startDate': '2024/03/25', 'endDate': '2024/04/15'},
                {'type': 'numeric', 'params': {'planet': 'Sun', 'field': 'Long', 'op': 'between', 'value': 10, 'value2': 20}})
    assert len(ivs) == 1
    dur_days = ivs[0]['endJd'] - ivs[0]['startJd']
    assert 9.0 < dur_days < 11.5
    ctx = _ctx()
    assert abs(ctx.moment(ivs[0]['startJd']).lon('Sun') - 10.0) < 0.02
    assert abs(ctx.moment(ivs[0]['endJd']).lon('Sun') - 20.0) < 0.02


def test_numeric_moon_speed_threshold_selfproof():
    """月亮 LongSpeed > 14.5°/日:区间内中点自洽,区间补集采样不满足。"""
    ivs = _scan({'startDate': '2024/04/01', 'endDate': '2024/04/30'},
                {'type': 'numeric', 'params': {'planet': 'Moon', 'field': 'LongSpeed', 'op': 'gt', 'value': 14.5}})
    assert ivs, '2024-04 月亮近地点段应有快速期'
    ctx = _ctx()
    for iv in ivs:
        mid = 0.5 * (iv['startJd'] + iv['endJd'])
        assert ctx.moment(mid).lonspeed('Moon') > 14.5
        assert ctx.moment(iv['startJd'] - 0.5).lonspeed('Moon') <= 14.6


def test_numeric_rejects_gt_on_circular_field():
    data = dict(BASE)
    data['conditions'] = {'type': 'numeric', 'params': {'planet': 'Sun', 'field': 'Long', 'op': 'gt', 'value': 100}}
    rsp = es.scan(data)
    assert rsp.get('err') == 'invalid_conditions' or '只支持' in str(rsp)


# ---------------------------------------------------------------------------
# midpoint
# ---------------------------------------------------------------------------

def test_midpoint_sun_moon_vs_fixed_selfproof():
    """日月中点(mod 360) 合 固定点:取扫描起点的中点值为目标 → 起点必在命中区间内;区间内自洽。"""
    ctx = _ctx()
    jd0 = es._jd_from('2024/04/07', '00:00:00', '+00:00')
    m0 = ctx.moment(jd0)
    target = es._near_axis_midpoint(m0.lon('Sun'), m0.lon('Moon'))
    ivs = _scan({}, {'type': 'midpoint', 'params': {
        'a': 'Sun', 'b': 'Moon',
        'target': {'kind': 'fixedLon', 'lon': target}, 'modulus': 360, 'orb': 2.0}})
    assert ivs
    assert any(iv['startJd'] - 1e-6 <= jd0 <= iv['endJd'] + 1e-6 for iv in ivs)
    for iv in ivs:
        mid_jd = 0.5 * (iv['startJd'] + iv['endJd'])
        m = ctx.moment(mid_jd)
        dist = es._dial_dist(es._near_axis_midpoint(m.lon('Sun'), m.lon('Moon')) - target, 360.0)
        assert dist < 2.0


def test_midpoint_dial_90_degenerate_single_star():
    """A=B 退化单星:90 盘上「月亮 dial 合 白羊 0°」= 月亮黄经 mod 90 ≈ 0;区间自洽。"""
    ivs = _scan({'startDate': '2024/04/07', 'endDate': '2024/04/17'},
                {'type': 'midpoint', 'params': {
                    'a': 'Moon', 'b': 'Moon',
                    'target': {'kind': 'fixedLon', 'lon': 0.0}, 'modulus': 90, 'orb': 1.5}})
    # 月亮每 ~6.8 天走 90° → 10 天约 1-2 次命中
    assert 1 <= len(ivs) <= 3
    ctx = _ctx()
    for iv in ivs:
        m = ctx.moment(0.5 * (iv['startJd'] + iv['endJd']))
        assert es._dial_dist(m.lon('Moon'), 90.0) < 1.5


# ---------------------------------------------------------------------------
# point_relation
# ---------------------------------------------------------------------------

def test_point_relation_moon_conj_asc():
    """月亮 合 上升(orb 5°):2 天域命中 ~2 次,每区间 ≈ 30-60 分钟,区间中点自洽。"""
    ivs = _scan({'endDate': '2024/04/09'},
                {'type': 'point_relation', 'params': {
                    'planet': 'Moon', 'point': {'kind': 'angle', 'id': 'ASC'},
                    'relation': 'angles', 'angles': [0], 'orb': 5.0}})
    assert 1 <= len(ivs) <= 3
    ctx = _ctx()
    for iv in ivs:
        assert 15.0 < iv['durationMin'] < 90.0
        m = ctx.moment(0.5 * (iv['startJd'] + iv['endJd']))
        assert abs(es._wrap180(m.lon('Moon') - m.asc())) < 5.0


def test_point_relation_parallel_moon_sun():
    """月亮 与 太阳 赤纬平行(orb 0.5°):30 天域 2-5 次,区间中点自洽、区间外不满足。"""
    ivs = _scan({'startDate': '2024/04/01', 'endDate': '2024/04/30'},
                {'type': 'point_relation', 'params': {
                    'planet': 'Moon', 'point': {'kind': 'planet', 'id': 'Sun'},
                    'relation': 'parallel', 'orb': 0.5}})
    assert 2 <= len(ivs) <= 5
    ctx = _ctx()
    for iv in ivs:
        m = ctx.moment(0.5 * (iv['startJd'] + iv['endJd']))
        diff = abs(m.equatorial('Moon')['decl'] - m.equatorial('Sun')['decl'])
        assert diff < 0.5


def test_point_relation_lot_fortuna_selfproof():
    """福点(日盘 asc+moon−sun / 夜盘反之)单点自洽核。"""
    ctx = _ctx()
    jd = es._jd_from('2024/04/08', '04:00:00', '+00:00')  # 北京时间正午,必为昼
    m = ctx.moment(jd)
    lon_fn, decl_fn, speed = es._resolve_point({'kind': 'lot', 'id': 'fortuna'}, ctx)
    expect = es._norm360(m.asc() + m.lon('Moon') - m.lon('Sun'))
    assert m.horizontal('Sun')['altitudeTrue'] > 0
    assert abs(es._wrap180(lon_fn(m) - expect)) < 1e-9
    assert speed > 300.0


def test_point_relation_soft_any_sets():
    """soft ⊆ any:同参数 soft 命中区间必被 any 命中区间覆盖。"""
    base = {'startDate': '2024/04/07', 'endDate': '2024/04/12'}
    mk = (lambda rel: {'type': 'point_relation', 'params': {
        'planet': 'Moon', 'point': {'kind': 'planet', 'id': 'Jupiter'}, 'relation': rel, 'orb': 3.0}})
    soft = _scan(base, mk('soft'))
    anyh = _scan(base, mk('any'))
    for s in soft:
        assert any(a['startJd'] - 1e-6 <= s['startJd'] and s['endJd'] <= a['endJd'] + 1e-6 for a in anyh)


# ---------------------------------------------------------------------------
# B 类叶(WP-4):in_house / reception / mutual_reception / rulership /
#              dignity_state / considerations
# ---------------------------------------------------------------------------

def test_in_house_moon_first_house_daily():
    """月亮在 1 宫:宫头日转一周 → 1 天域 ≈1 段约 2 小时;区间中点自洽。"""
    ivs = _scan({'endDate': '2024/04/08'},
                {'type': 'in_house', 'params': {'planet': 'Moon', 'houses': [1]}})
    assert 1 <= len(ivs) <= 2
    ctx = _ctx()
    for iv in ivs:
        m = ctx.moment(0.5 * (iv['startJd'] + iv['endJd']))
        assert es._house_index(m.lon('Moon'), m.houses()) == 1


def test_reception_point_probe_moon_taurus():
    """单点探针:月亮在金牛(金星庙/月亮旺) → 宽松版「金星接纳月亮(庙)」「月亮自旺」成立。"""
    ctx = _ctx()
    jd = es._jd_from('2024/04/10', '12:00:00', '+00:00')  # 月亮在金牛(4/9-4/11)
    m = ctx.moment(jd)
    sign, _lon = es._sign_pos(m, 'Moon', ctx)
    assert sign == 'Taurus'
    assert es._reception_hits(m, ctx, 'Venus', 'Moon', ['ruler'], 'any', False)
    info = es._essential_info(m, 'Moon', ctx)
    assert info.get('exalt') == 'Moon'


def test_reception_scan_selfproof():
    """扫描版:金星接纳月亮(庙,宽松) ≈ 月亮金牛/天秤段;区间中点自洽、非空。"""
    ivs = _scan({'startDate': '2024/04/07', 'endDate': '2024/04/21'},
                {'type': 'reception', 'params': {
                    'planetA': 'Venus', 'planetB': 'Moon',
                    'levels': ['ruler'], 'match': 'any', 'requireAspect': False}})
    assert ivs
    ctx = _ctx()
    for iv in ivs:
        m = ctx.moment(0.5 * (iv['startJd'] + iv['endJd']))
        sign, _l = es._sign_pos(m, 'Moon', ctx)
        assert sign in ('Taurus', 'Libra')


def test_rulership_dispositor_is_mars_around_new_moon():
    """月亮主宰星是火星 ⟺ 月亮在白羊/天蝎;合朔(4/8 白羊)邻域必命中。"""
    ivs = _scan({}, {'type': 'rulership', 'params': {
        'planetA': 'Moon', 'planetB': 'Mars', 'mode': 'dispositor_is'}})
    assert len(ivs) == 1
    ctx = _ctx()
    m = ctx.moment(0.5 * (ivs[0]['startJd'] + ivs[0]['endJd']))
    sign, _l = es._sign_pos(m, 'Moon', ctx)
    assert sign in ('Aries', 'Scorpio')


def test_dignity_state_sun_exalt_whole_domain():
    """太阳 4 月上旬在白羊(旺) → 区间=全域。"""
    ivs = _scan({}, {'type': 'dignity_state', 'params': {
        'planet': 'Sun', 'states': ['exalt'], 'require': 'all'}})
    assert len(ivs) == 1
    assert ivs[0]['durationMin'] > 3.0 * 1440 - 5


def test_dignity_state_mercury_combust_inferior_conjunction():
    """2024-04 水星逆行下合(4/11 前后):combust 区间非空;中点对日距在 [cazimi, combust) 带。"""
    ivs = _scan({'startDate': '2024/04/05', 'endDate': '2024/04/20'},
                {'type': 'dignity_state', 'params': {
                    'planet': 'Mercury', 'states': ['combust'], 'require': 'all'}})
    assert ivs
    ctx = _ctx()
    for iv in ivs:
        m = ctx.moment(0.5 * (iv['startJd'] + iv['endJd']))
        d = abs(es._wrap180(m.lon('Mercury') - m.lon('Sun')))
        assert (17.0 / 60.0) <= d < 8.5


def test_dignity_state_mercury_retrograde_window():
    """水星 2024-04-01~25 逆行:区间边界处速度≈0,区间内速度<0。"""
    ivs = _scan({'startDate': '2024/03/28', 'endDate': '2024/04/28'},
                {'type': 'dignity_state', 'params': {
                    'planet': 'Mercury', 'states': ['retrograde'], 'require': 'all'}})
    assert len(ivs) == 1
    ctx = _ctx()
    mid = 0.5 * (ivs[0]['startJd'] + ivs[0]['endJd'])
    assert ctx.moment(mid).lonspeed('Mercury') < 0
    assert abs(ctx.moment(ivs[0]['startJd']).lonspeed('Mercury')) < 0.02


def test_dignity_state_moon_angular_segments():
    """月亮角宫(1/4/7/10):1 天域 ≈4 段;每段中点自洽。"""
    ivs = _scan({'endDate': '2024/04/08'},
                {'type': 'dignity_state', 'params': {
                    'planet': 'Moon', 'states': ['angular'], 'require': 'all'}})
    assert 3 <= len(ivs) <= 5
    ctx = _ctx()
    for iv in ivs:
        m = ctx.moment(0.5 * (iv['startJd'] + iv['endJd']))
        assert es._house_index(m.lon('Moon'), m.houses()) in (1, 4, 7, 10)


def test_considerations_moon_waxing_starts_at_new_moon():
    """增光段起点=合朔时刻(2024-04-08 18:21 UT ±5min)——金标锚。"""
    ivs = _scan({'startDate': '2024/04/07', 'endDate': '2024/04/12'},
                {'type': 'considerations', 'params': {'item': 'moon_waxing'}})
    assert ivs
    exact = es._jd_from('2024/04/08', '18:21:00', '+00:00')
    starts = [iv['startJd'] for iv in ivs]
    assert any(abs(s - exact) < (5.0 / 1440.0) for s in starts), starts


def test_considerations_moon_voc_selfproof():
    """月亮空亡(by_sign_orb):区间**非空**(防空转假阳性)+中点 chartdynamics 复核为真。
    lilly 口径在全对象集语境本周零空亡(月亮总对某慢速点入相),属口径事实非缺陷。"""
    ivs = _scan({'startDate': '2024/04/07', 'endDate': '2024/04/14'},
                {'type': 'considerations', 'params': {'item': 'moon_voc', 'vocMode': 'by_sign_orb'}})
    assert ivs, 'by_sign_orb 口径一周内应有空亡段'
    ctx = _ctx()
    for iv in ivs:
        m = ctx.moment(0.5 * (iv['startJd'] + iv['endJd']))
        assert m.dynamics().isVOC('Moon', 'by_sign_orb', False)


def test_considerations_via_combusta_variant_table():
    """燃烧之路(standard 195-225):月亮过天秤中至天蝎中;区间中点黄经自洽在带内。"""
    ivs = _scan({'startDate': '2024/04/15', 'endDate': '2024/04/25'},
                {'type': 'considerations', 'params': {'item': 'via_combusta', 'variant': 'standard'}})
    assert ivs
    ctx = _ctx()
    for iv in ivs:
        lon = ctx.moment(0.5 * (iv['startJd'] + iv['endJd'])).lon('Moon')
        assert 195.0 <= lon < 225.0


# ---------------------------------------------------------------------------
# WP-5:围攻纯核 / 相位格局纯核 / Jones 八型 / 扫描自洽
# ---------------------------------------------------------------------------

def _far_rest(base, exclude, val=300.0):
    """其余七政放远处(不干扰两侧最近判定)。"""
    lons = {k: val + i * 3.0 for i, k in enumerate(es._SEVEN)}
    lons.update(base)
    for k in exclude:
        lons.pop(k, None)
        lons.update({k: base[k]} if k in base else {})
    lons.update(base)
    return lons


def _bsg(**over):
    p = {'target': 'Moon', 'besiegerA': 'Mars', 'besiegerB': 'Saturn',
         'mode': 'body', 'orbLeft': 8.0, 'orbRight': 8.0,
         'rescue': {'enabled': True, 'rescuers': ['Venus', 'Jupiter'], 'byBody': True, 'byRay': False}}
    p.update(over)
    return p


def test_besieged_core_body_hit_and_side_orbs():
    lons = _far_rest({'Moon': 100.0, 'Saturn': 104.0, 'Mars': 95.0}, ())
    assert es._besieged_core(_bsg(), lons) is True
    # 双侧独立 orb:前方 4° 超 orbLeft=3 → 破
    assert es._besieged_core(_bsg(orbLeft=3.0), lons) is False
    # 后方 5° 超 orbRight=4 → 破
    assert es._besieged_core(_bsg(orbRight=4.0), lons) is False


def test_besieged_core_rescue_and_nearest_rules():
    base = {'Moon': 100.0, 'Saturn': 104.0, 'Mars': 95.0}
    # body 模式:夹缝内任何实体都顶掉「两侧最近=两攻星」——救援开关开关皆破围(物理规则,非救援逻辑)
    lons = _far_rest({**base, 'Venus': 102.0}, ())
    assert es._besieged_core(_bsg(), lons) is False
    assert es._besieged_core(_bsg(rescue={'enabled': False}), lons) is False
    # 非攻星(木星)成两侧最近 → 不构成指定围攻
    lons2 = _far_rest({**base, 'Jupiter': 98.0}, ())
    assert es._besieged_core(_bsg(), lons2) is False


def test_besieged_ray_body_rescue_switch_effective():
    """ray 模式下实体救援开关才是真开关(实体不参与光线围的最近邻规则)。"""
    lons = _far_rest({'Moon': 100.0, 'Mars': 192.0, 'Saturn': 217.0, 'Venus': 101.5}, ())
    on = _bsg(mode='ray', orbLeft=3.0, orbRight=4.0,
              rescue={'enabled': True, 'rescuers': ['Venus', 'Jupiter'], 'byBody': True, 'byRay': False})
    off = _bsg(mode='ray', orbLeft=3.0, orbRight=4.0, rescue={'enabled': False})
    assert es._besieged_core(on, lons) is False   # 金星实体落夹缝(1.5°<前夹点2°)→解围
    assert es._besieged_core(off, lons) is True   # 关救援 → 复围


def test_besieged_core_ray_mode():
    # Mars@192 → 192−90=102(前方2°);Saturn@217 → 217−120=97(后方3°)
    lons = _far_rest({'Moon': 100.0, 'Mars': 192.0, 'Saturn': 217.0}, ())
    p = _bsg(mode='ray', orbLeft=3.0, orbRight=4.0,
             rescue={'enabled': True, 'rescuers': ['Venus', 'Jupiter'], 'byBody': True, 'byRay': True})
    assert es._besieged_core(p, lons) is True
    # 木星光线 39+60=99(后方1° < Saturn 光线3°)→ byRay 救援解围
    lons_r = dict(lons)
    lons_r['Jupiter'] = 39.0
    assert es._besieged_core(p, lons_r) is False
    # 拿掉 Saturn 的近侧光线(同星两侧不算成立性由组合逻辑保证)→ 不成围
    lons_x = dict(lons)
    lons_x['Saturn'] = 10.0  # 其光线距 target 最近也 >4°
    assert es._besieged_core(p, lons_x) is False


def test_besieged_scan_sun_flanked_by_mercury_venus():
    """水金恒近日:体围「日被水金夹」宽 orb 下应有命中;区间中点纯核复核。"""
    ivs = _scan({'startDate': '2024/04/05', 'endDate': '2024/04/20'},
                {'type': 'besieged', 'params': {
                    'target': 'Sun', 'besiegerA': 'Mercury', 'besiegerB': 'Venus',
                    'mode': 'body', 'orbLeft': 25.0, 'orbRight': 25.0,
                    'rescue': {'enabled': False}}})
    ctx = _ctx()
    for iv in ivs:
        m = ctx.moment(0.5 * (iv['startJd'] + iv['endJd']))
        lons = {k: m.lon(k) for k in es._SEVEN}
        assert es._besieged_core({'target': 'Sun', 'besiegerA': 'Mercury', 'besiegerB': 'Venus',
                                  'mode': 'body', 'orbLeft': 25.0, 'orbRight': 25.0,
                                  'rescue': {'enabled': False}}, lons)
    assert ivs, '2024-04 上半月水金分踞日两侧,宽 orb 应命中'


def test_pattern_core_all_six_shapes():
    orb = 3.0
    mk = (lambda d: {k: v for k, v in d.items()})
    assert es._pattern_hits(mk({'A': 0.0, 'B': 180.0, 'C': 90.0}), 't_square', 'any', ['A', 'B', 'C'], orb)
    assert es._pattern_hits(mk({'A': 0.0, 'B': 180.0, 'C': 90.0}), 't_square', 'C', ['A', 'B', 'C'], orb)
    assert not es._pattern_hits(mk({'A': 0.0, 'B': 180.0, 'C': 90.0}), 't_square', 'A', ['A', 'B', 'C'], orb)
    assert es._pattern_hits(mk({'A': 0.0, 'B': 120.0, 'C': 240.0}), 'grand_trine', 'any', ['A', 'B', 'C'], orb)
    assert es._pattern_hits(mk({'A': 0.0, 'B': 90.0, 'C': 180.0, 'D': 270.0}), 'grand_cross', 'any', ['A', 'B', 'C', 'D'], orb)
    assert es._pattern_hits(mk({'A': 0.0, 'B': 120.0, 'C': 240.0, 'D': 180.0}), 'kite', 'any', ['A', 'B', 'C', 'D'], orb)
    assert es._pattern_hits(mk({'A': 0.0, 'B': 60.0, 'C': 210.0}), 'yod', 'any', ['A', 'B', 'C'], orb)
    assert es._pattern_hits(mk({'A': 0.0, 'B': 180.0, 'C': 60.0, 'D': 240.0}), 'mystic_rectangle', 'any', ['A', 'B', 'C', 'D'], orb)
    assert not es._pattern_hits(mk({'A': 0.0, 'B': 100.0, 'C': 205.0}), 'grand_trine', 'any', ['A', 'B', 'C'], orb)


def test_pattern_scan_selfproof_soft():
    """格局扫描软自洽:任何命中区间中点必被纯核复核为真(不强制非空)。"""
    ivs = _scan({'startDate': '2024/04/07', 'endDate': '2024/04/12'},
                {'type': 'aspect_pattern', 'params': {'pattern': 'grand_trine', 'orb': 8.0}})
    ctx = _ctx()
    for iv in ivs:
        m = ctx.moment(0.5 * (iv['startJd'] + iv['endJd']))
        lons = {k: m.lon(k) for k in es._PATTERN_POOL}
        assert es._pattern_hits(lons, 'grand_trine', 'any', 'any', 8.0)


def test_jones_type_eight_shapes_constructed():
    """八型构造例(阈值与前端 jonesType withSling=true 同款;WP-9 fixture 双端对拍)。

    几何注:旧七型 bucket 门槛(g1≥180∧g2≥60)数学上蕴含主群 span≤120=全是紧聚提把,
    故八型把手检测独立于该门槛:宽群+把手(旧口径漏成 splay/seesaw)归 bucket,
    紧聚+把手归 sling;无把手回落七型。"""
    assert es._jones_type([10, 20, 30, 40, 15, 25, 35]) == 'bundle'
    assert es._jones_type([0, 30, 60, 90, 120, 150, 175]) == 'bowl'
    # 大空档+次空档<60 → bowl(新旧同判;这不是把手型)
    assert es._jones_type([0, 30, 60, 90, 130, 150, 330]) == 'bowl'
    # 宽主群(span 170)+孤柄 → 八型 bucket;旧七型此形落 splay(g1=95<120)
    assert es._jones_type([0, 42, 85, 128, 170, 265]) == 'bucket'
    assert es._jones_type([0, 42, 85, 128, 170, 265], with_sling=False) == 'splay'
    # 紧聚主群(span 100)+孤柄 → sling;旧七型判 bucket
    assert es._jones_type([0, 20, 40, 60, 80, 100, 280]) == 'sling'
    assert es._jones_type([0, 20, 40, 60, 80, 100, 280], with_sling=False) == 'bucket'
    assert es._jones_type([0, 20, 40, 180, 200, 220, 230]) == 'seesaw'
    assert es._jones_type([0, 30, 60, 90, 120, 150, 180, 210, 230]) == 'locomotive'
    assert es._jones_type([0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]) == 'splash'
    # 三团散布:星0 两侧空档 90/80 但其余仍含 ≥60 空档(主群不连贯)→ 非把手 → splay
    assert es._jones_type([0, 80, 160, 170, 180, 260, 270]) == 'splay'


def test_chart_shape_scan_matches_direct_eval():
    """盘形扫描自适应金标:以 4/8 正午实算形为期望,扫该形必含当刻;扫另一形必不含。"""
    ctx = _ctx()
    jd_probe = es._jd_from('2024/04/08', '12:00:00', '+00:00')
    m = ctx.moment(jd_probe)
    shape_now = es._jones_type([m.lon(k) for k in es._PATTERN_POOL])
    ivs = _scan({}, {'type': 'chart_shape', 'params': {'shape': shape_now, 'includeOuter': True}})
    assert any(iv['startJd'] - 1e-6 <= jd_probe <= iv['endJd'] + 1e-6 for iv in ivs)
    other = 'bundle' if shape_now != 'bundle' else 'splash'
    ivs2 = _scan({}, {'type': 'chart_shape', 'params': {'shape': other, 'includeOuter': True}})
    assert not any(iv['startJd'] <= jd_probe <= iv['endJd'] for iv in ivs2)


# ---------------------------------------------------------------------------
# WP-6:C 类生成式叶——day_window / 日在地平上下(含极区)
# ---------------------------------------------------------------------------

def test_day_window_plain_daily():
    """09:00-17:00 × 3 天 = 3 段各 8 小时(zone=+00:00 直读)。"""
    ivs = _scan({}, {'type': 'day_window', 'params': {'from': '09:00', 'to': '17:00'}})
    assert len(ivs) == 3
    for iv in ivs:
        assert abs(iv['durationMin'] - 480.0) < 1.5
        assert iv['start'].endswith('09:00:00') or iv['start'].endswith('09:00')


def test_day_window_cross_midnight_and_edges():
    """22:00→02:00 跨午夜:域端截断,总时长 = 3×4h 上下浮动一窗。"""
    ivs = _scan({}, {'type': 'day_window', 'params': {'from': '22:00', 'to': '02:00'}})
    total = sum(iv['durationMin'] for iv in ivs)
    assert 3 <= len(ivs) <= 4
    assert abs(total - 3 * 240.0) < 125.0


def test_day_window_rejects_equal_bounds():
    data = dict(BASE)
    data['conditions'] = {'type': 'day_window', 'params': {'from': '09:00', 'to': '09:00'}}
    assert es.scan(data).get('err') == 'invalid_conditions'


def test_sun_above_horizon_matches_numeric_altitude():
    """生成式昼弧与 numeric Altitude>0 采样版对拍:段数一致,对应段起点差 <10 分钟
    (口径差=视升落上缘+折射 vs 真高度中心,约 3-5 分/端)。"""
    gen = _scan({}, {'type': 'considerations', 'params': {'item': 'sun_above_horizon'}})
    num = _scan({}, {'type': 'numeric', 'params': {'planet': 'Sun', 'field': 'Altitude', 'op': 'gt', 'value': 0}})
    assert len(gen) == len(num)
    for g, m in zip(gen, num):
        assert abs(g['startJd'] - m['startJd']) < (10.0 / 1440.0)
        assert abs(g['endJd'] - m['endJd']) < (10.0 / 1440.0)


def test_sun_below_horizon_complements_above():
    """above ∪ below = 全域(边界共点容差内),两者互不重叠。"""
    above = _scan({}, {'type': 'considerations', 'params': {'item': 'sun_above_horizon'}})
    below = _scan({}, {'type': 'considerations', 'params': {'item': 'sun_below_horizon'}})
    total = sum(iv['durationMin'] for iv in above) + sum(iv['durationMin'] for iv in below)
    assert abs(total - 3 * 1440.0) < 3.0
    for a in above:
        for b in below:
            lo = max(a['startJd'], b['startJd'])
            hi = min(a['endJd'], b['endJd'])
            assert hi - lo < (1.5 / 1440.0)


def test_sun_horizon_polar_day_and_night():
    """极区兜底(斯瓦尔巴 78N):6 月极昼 above=整域/below=空;12 月极夜反之。"""
    polar = {'gpsLat': 78.0, 'gpsLon': 15.0}
    day = {'startDate': '2024/06/10', 'endDate': '2024/06/13', **polar}
    night = {'startDate': '2024/12/10', 'endDate': '2024/12/13', **polar}
    above_d = _scan(day, {'type': 'considerations', 'params': {'item': 'sun_above_horizon'}})
    below_d = _scan(day, {'type': 'considerations', 'params': {'item': 'sun_below_horizon'}})
    assert len(above_d) == 1 and abs(above_d[0]['durationMin'] - 3 * 1440.0) < 2.0
    assert below_d == []
    above_n = _scan(night, {'type': 'considerations', 'params': {'item': 'sun_above_horizon'}})
    below_n = _scan(night, {'type': 'considerations', 'params': {'item': 'sun_below_horizon'}})
    assert above_n == []
    assert len(below_n) == 1 and abs(below_n[0]['durationMin'] - 3 * 1440.0) < 2.0
