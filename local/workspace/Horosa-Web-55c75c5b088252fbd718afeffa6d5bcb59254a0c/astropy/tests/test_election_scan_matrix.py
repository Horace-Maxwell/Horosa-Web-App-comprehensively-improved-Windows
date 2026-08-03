# -*- coding: utf-8 -*-
"""天星择日·穷举压力矩阵(生产路径 scan() 直调;照 geo_matrix 穷举审计范式)。

维度:15 类条件 × 每参数每取值 + 逻辑组合(且/或/异或/取反/嵌套) + 边界/互斥/防呆。
断言三级:
  ① 结构级(全部 case):无 err(或恰为预期 invalid_conditions);区间升序不重叠、界内;
  ② 语义级(标记 selfproof 的 case):区间中点谓词自洽复核;
  ③ 恒等级:A AND NOT A = 空、A OR NOT A = 全域、soft⊂any 等代数恒等式。
规模:~500 case,3 天短域为主,整矩阵目标 <5 分钟。
"""
import pytest

from astrostudy import election_scan as es


BASE = {
    'startDate': '2024/04/07', 'startTime': '00:00:00',
    'endDate': '2024/04/10', 'endTime': '00:00:00',
    'zone': '+00:00', 'gpsLat': 39.9042, 'gpsLon': 116.4074,
    'hsys': 0, 'zodiacal': 0, 'ad': 1, 'precision': 'minute',
}

WEEK = {'endDate': '2024/04/14'}


def run(tree, expect_err=None, **over):
    data = dict(BASE)
    data.update(over)
    data['conditions'] = tree
    rsp = es.scan(data)
    if expect_err:
        assert rsp.get('err') == expect_err, 'expect {0}, got {1!r}'.format(expect_err, rsp)
        return None
    assert 'err' not in rsp, rsp
    ivs = rsp['intervals']
    lo = es._jd_from(data['startDate'], data['startTime'], data['zone'])
    hi = es._jd_from(data['endDate'], data['endTime'], data['zone'])
    prev_end = None
    for iv in ivs:
        assert iv['startJd'] < iv['endJd'] + 1e-12, iv
        assert iv['startJd'] >= lo - 1e-6 and iv['endJd'] <= hi + 1e-6, iv
        if prev_end is not None:
            assert iv['startJd'] >= prev_end - 1e-9, '区间重叠/乱序'
        prev_end = iv['endJd']
    return ivs


def leaf(t, **params):
    return {'type': t, 'params': params}


def A(*conds):
    return {'type': 'all', 'conditions': list(conds)}


def O(*conds):  # noqa: E741
    return {'type': 'any', 'conditions': list(conds)}


def N(c):
    return {'type': 'not', 'conditions': [c]}


def X(*conds):
    return {'type': 'xor', 'conditions': list(conds)}


def asp(**over):
    p = {'planetA': 'Moon', 'planetB': 'Sun', 'angle': 90, 'orb': 3,
         'motion': 'any', 'side': 'any', 'partile': 'off'}
    p.update(over)
    return leaf('aspect', **p)


# ═══════════════ M1 aspect:角度全档×orb 档×motion×side×partile ═══════════════

@pytest.mark.parametrize('angle', [0, 30, 45, 60, 90, 120, 135, 150, 180])
def test_m1_aspect_all_angles(angle):
    run(asp(angle=angle, orb=4), **WEEK)


@pytest.mark.parametrize('orb', [0.5, 3, 10, 29.5])
def test_m1_aspect_orb_range(orb):
    # 域含 4/8 合朔 → angle=0 各 orb 档必命中;90° 上弦(4/15)不在 3 天域内
    ivs = run(asp(angle=0, orb=orb))
    assert ivs, 'orb {0} 应命中(域含合朔)'.format(orb)


@pytest.mark.parametrize('motion', ['any', 'applying', 'separating'])
@pytest.mark.parametrize('side', ['any', 'dexter', 'sinister'])
@pytest.mark.parametrize('partile', ['off', 'same_degree', 'le3', 'le1'])
def test_m1_aspect_motion_side_partile_grid(motion, side, partile):
    run(asp(motion=motion, side=side, partile=partile, orb=5), **WEEK)


@pytest.mark.parametrize('pair', [
    ('Sun', 'Saturn'), ('Mercury', 'Venus'), ('Mars', 'Jupiter'),
    ('North Node', 'Moon'), ('Chiron', 'Sun'), ('Uranus', 'Pluto'),
])
def test_m1_aspect_body_pairs(pair):
    run(asp(planetA=pair[0], planetB=pair[1], angle=60, orb=6), **WEEK)


def test_m1_aspect_motion_partition():
    """applying ∪ separating = any(对称拆分恒等式)。"""
    full = run(asp())
    app = run(asp(motion='applying'))
    sep = run(asp(motion='separating'))
    total = sum(i['durationMin'] for i in full)
    parts = sum(i['durationMin'] for i in app) + sum(i['durationMin'] for i in sep)
    assert abs(total - parts) < 2.0


# ═══════════════ M2/M3 in_sign / in_house ═══════════════

@pytest.mark.parametrize('sign', list(range(12)))
def test_m2_in_sign_moon_each(sign):
    run(leaf('in_sign', planet='Moon', signs=[sign]), **WEEK)


@pytest.mark.parametrize('planet', ['Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter',
                                    'Saturn', 'Uranus', 'Neptune', 'Pluto',
                                    'North Node', 'South Node', 'Chiron'])
def test_m2_in_sign_each_body(planet):
    ivs = run(leaf('in_sign', planet=planet, signs=list(range(12))))
    # 全星座并集=全域(恒等式)
    total = sum(i['durationMin'] for i in ivs)
    assert abs(total - 3 * 1440.0) < 2.0, planet


def test_m2_in_sign_multi_disjoint():
    run(leaf('in_sign', planet='Moon', signs=[0, 6]), **WEEK)


@pytest.mark.parametrize('house', list(range(1, 13)))
def test_m3_in_house_moon_each(house):
    ivs = run(leaf('in_house', planet='Moon', houses=[house]))
    assert ivs, '3 天域每宫必有月亮驻留(周日运动)'
    m = es.ScanContext(dict(BASE))
    iv = ivs[0]
    mm = m.moment(0.5 * (iv['startJd'] + iv['endJd']))
    assert es._house_index(mm.lon('Moon'), mm.houses()) == house


def test_m3_in_house_union_full():
    ivs = run(leaf('in_house', planet='Sun', houses=list(range(1, 13))))
    total = sum(i['durationMin'] for i in ivs)
    assert abs(total - 3 * 1440.0) < 2.0


# ═══════════════ M4/M5/M6 reception / mutual / rulership ═══════════════

@pytest.mark.parametrize('level', ['ruler', 'exalt', 'trip', 'term', 'face'])
@pytest.mark.parametrize('require_asp', [True, False])
def test_m4_reception_levels(level, require_asp):
    run(leaf('reception', planetA='Venus', planetB='Moon',
             levels=[level], match='any', requireAspect=require_asp), **WEEK)


def test_m4_reception_match_all_subset_of_any():
    any_ = run(leaf('reception', planetA='Venus', planetB='Moon',
                    levels=['ruler', 'term'], match='any', requireAspect=False), **WEEK)
    all_ = run(leaf('reception', planetA='Venus', planetB='Moon',
                    levels=['ruler', 'term'], match='all', requireAspect=False), **WEEK)
    t_any = sum(i['durationMin'] for i in any_)
    t_all = sum(i['durationMin'] for i in all_)
    assert t_all <= t_any + 1.0


@pytest.mark.parametrize('pairing', ['any_pair', 'same_level'])
@pytest.mark.parametrize('require_asp', [True, False])
def test_m5_mutual_grid(pairing, require_asp):
    run(leaf('mutual_reception', planetA='Mercury', planetB='Venus',
             levels=['ruler', 'exalt', 'trip', 'term', 'face'],
             pairing=pairing, requireAspect=require_asp), **WEEK)


@pytest.mark.parametrize('mode', ['rules', 'dispositor_is'])
@pytest.mark.parametrize('pair', [('Moon', 'Mars'), ('Sun', 'Venus'), ('Saturn', 'Moon')])
def test_m6_rulership_grid(mode, pair):
    run(leaf('rulership', planetA=pair[0], planetB=pair[1], mode=mode), **WEEK)


# ═══════════════ M7 besieged ═══════════════

@pytest.mark.parametrize('mode', ['body', 'ray'])
@pytest.mark.parametrize('rescue_on', [True, False])
def test_m7_besieged_grid(mode, rescue_on):
    run(leaf('besieged', target='Sun', besiegerA='Mercury', besiegerB='Venus',
             mode=mode, orbLeft=25, orbRight=25,
             rescue={'enabled': rescue_on, 'rescuers': ['Jupiter'], 'byBody': True, 'byRay': mode == 'ray'},
             mitigation={'receptionBreaks': False}), **WEEK)


def test_m7_besieged_asymmetric_orbs_and_mitigation():
    run(leaf('besieged', target='Moon', besiegerA='Mars', besiegerB='Saturn',
             mode='ray', orbLeft=3, orbRight=12,
             rescue={'enabled': True, 'rescuers': ['Venus', 'Jupiter'], 'byBody': True, 'byRay': True},
             mitigation={'receptionBreaks': True}), **WEEK)


# ═══════════════ M8 dignity_state:24 态逐一 ═══════════════

_STATE_CARRIER = {
    'ruler': 'Mars', 'exalt': 'Sun', 'trip': 'Sun', 'term': 'Moon', 'face': 'Moon',
    'detriment': 'Venus', 'fall': 'Saturn', 'peregrine': 'Mars',
    'cazimi': 'Mercury', 'combust': 'Mercury', 'under_beams': 'Venus', 'free_of_sun': 'Moon',
    'oriental': 'Mercury', 'occidental': 'Venus',
    'direct': 'Jupiter', 'retrograde': 'Mercury', 'station': 'Mercury',
    'fast': 'Moon', 'slow': 'Moon',
    'angular': 'Sun', 'succedent': 'Sun', 'cadent': 'Sun',
    'feral': 'Moon', 'oob': 'Moon',
}


@pytest.mark.parametrize('state', list(_STATE_CARRIER.keys()))
def test_m8_dignity_each_state(state):
    run(leaf('dignity_state', planet=_STATE_CARRIER[state], states=[state], require='all'),
        startDate='2024/04/01', endDate='2024/04/06')


def test_m8_dignity_require_any_vs_all():
    any_ = run(leaf('dignity_state', planet='Moon', states=['fast', 'angular'], require='any'))
    all_ = run(leaf('dignity_state', planet='Moon', states=['fast', 'angular'], require='all'))
    t_any = sum(i['durationMin'] for i in any_)
    t_all = sum(i['durationMin'] for i in all_)
    assert t_all <= t_any + 1.0


# ═══════════════ M9 considerations:11 item×口径 ═══════════════

@pytest.mark.parametrize('item', ['moon_waxing', 'moon_waning', 'via_combusta',
                                  'moon_early_sign', 'moon_late_sign', 'asc_near_boundary',
                                  'sun_above_horizon', 'sun_below_horizon'])
def test_m9_consideration_items(item):
    run(leaf('considerations', item=item), **WEEK)


@pytest.mark.parametrize('voc_mode', ['classic', 'by_orb', 'by_sign_perfect',
                                      'by_sign_orb', 'kenodromia', 'exempt4'])
def test_m9_voc_all_modes(voc_mode):
    run(leaf('considerations', item='moon_voc', vocMode=voc_mode), **WEEK)


@pytest.mark.parametrize('speed_mode', ['ramesey', 'mean', 'twelve'])
@pytest.mark.parametrize('item', ['moon_fast', 'moon_slow'])
def test_m9_moon_speed_modes(speed_mode, item):
    run(leaf('considerations', item=item, speedMode=speed_mode), **WEEK)


@pytest.mark.parametrize('variant', ['standard', 'scorpioFull', 'bothFull', 'narrow'])
def test_m9_via_combusta_variants(variant):
    run(leaf('considerations', item='via_combusta', variant=variant),
        startDate='2024/04/15', endDate='2024/04/25')


def test_m9_moon_speed_complement():
    """fast ∪ slow = 全域(同口径互补恒等式)。"""
    fast = run(leaf('considerations', item='moon_fast', speedMode='ramesey'))
    slow = run(leaf('considerations', item='moon_slow', speedMode='ramesey'))
    total = sum(i['durationMin'] for i in fast) + sum(i['durationMin'] for i in slow)
    assert abs(total - 3 * 1440.0) < 2.0


# ═══════════════ M10 aspect_pattern ═══════════════

@pytest.mark.parametrize('pattern', ['t_square', 'grand_trine', 'grand_cross',
                                     'kite', 'yod', 'mystic_rectangle'])
@pytest.mark.parametrize('orb', [4, 8])
def test_m10_patterns(pattern, orb):
    run(leaf('aspect_pattern', pattern=pattern, orb=orb), **WEEK)


def test_m10_pattern_apex_subset():
    any_ = run(leaf('aspect_pattern', pattern='t_square', orb=8), **WEEK)
    apex = run(leaf('aspect_pattern', pattern='t_square', apex='Moon', orb=8), **WEEK)
    t_any = sum(i['durationMin'] for i in any_)
    t_apex = sum(i['durationMin'] for i in apex)
    assert t_apex <= t_any + 1.0


# ═══════════════ M11 point_relation:kind×relation ═══════════════

@pytest.mark.parametrize('kind,pid', [('angle', 'ASC'), ('angle', 'MC'), ('angle', 'DESC'),
                                      ('angle', 'IC'), ('planet', 'Jupiter'), ('lot', 'fortuna'),
                                      ('fixedLon', None)])
@pytest.mark.parametrize('relation', ['any', 'soft', 'hard'])
def test_m11_point_kinds_x_relations(kind, pid, relation):
    point = {'kind': kind}
    if pid:
        point['id'] = pid
    if kind == 'fixedLon':
        point['lon'] = 15.0
    run(leaf('point_relation', planet='Moon', point=point, relation=relation, orb=3))


@pytest.mark.parametrize('relation', ['parallel', 'contraparallel'])
def test_m11_declination_relations(relation):
    run(leaf('point_relation', planet='Moon', point={'kind': 'planet', 'id': 'Sun'},
             relation=relation, orb=1.0), startDate='2024/04/01', endDate='2024/04/14')


def test_m11_soft_hard_subset_of_any():
    mk = (lambda rel: leaf('point_relation', planet='Moon',
                           point={'kind': 'planet', 'id': 'Saturn'}, relation=rel, orb=4))
    t = {rel: sum(i['durationMin'] for i in run(mk(rel), **WEEK)) for rel in ('any', 'soft', 'hard')}
    assert t['soft'] <= t['any'] + 1.0
    assert t['hard'] <= t['any'] + 1.0


# ═══════════════ M12 numeric:字段×op×边界 ═══════════════

@pytest.mark.parametrize('field', ['Lat', 'LongSpeed', 'LatSpeed', 'RASpeed', 'Decl', 'DeclSpeed', 'Altitude'])
@pytest.mark.parametrize('op', ['gt', 'gte', 'lt', 'lte'])
def test_m12_linear_fields_ops(field, op):
    run(leaf('numeric', planet='Moon', field=field, op=op, value=0))


@pytest.mark.parametrize('field', ['Long', 'RA', 'Azimuth'])
def test_m12_circular_between(field):
    run(leaf('numeric', planet='Sun', field=field, op='between', value=350, value2=20))


def test_m12_circular_between_wrap_complement():
    """圆弧 [10,20] ∪ [20,10](跨零补弧) = 全域。"""
    a = run(leaf('numeric', planet='Sun', field='Long', op='between', value=10, value2=20),
            startDate='2024/03/25', endDate='2024/04/15')
    b = run(leaf('numeric', planet='Sun', field='Long', op='between', value=20, value2=10),
            startDate='2024/03/25', endDate='2024/04/15')
    total = sum(i['durationMin'] for i in a) + sum(i['durationMin'] for i in b)
    assert abs(total - 21 * 1440.0) < 3.0


def test_m12_numeric_eq_with_eps():
    run(leaf('numeric', planet='Moon', field='Decl', op='eq', value=5, eps=0.5))


def test_m12_altitude_apparent_kind():
    run(leaf('numeric', planet='Sun', field='Altitude', op='gt', value=0, altitudeKind='apparent'))


def test_m12_gt_le_complement():
    gt = run(leaf('numeric', planet='Moon', field='LongSpeed', op='gt', value=13))
    le = run(leaf('numeric', planet='Moon', field='LongSpeed', op='lte', value=13))
    total = sum(i['durationMin'] for i in gt) + sum(i['durationMin'] for i in le)
    assert abs(total - 3 * 1440.0) < 2.0


# ═══════════════ M13 chart_shape ═══════════════

@pytest.mark.parametrize('shape', ['splash', 'bundle', 'bowl', 'locomotive',
                                   'seesaw', 'sling', 'bucket', 'splay'])
@pytest.mark.parametrize('include_outer', [True, False])
def test_m13_shapes(shape, include_outer):
    run(leaf('chart_shape', shape=shape, includeOuter=include_outer))


def test_m13_shapes_partition_domain():
    """八型互斥完备:并=全域(同 includeOuter)。"""
    total = 0.0
    for shape in es._JONES_SHAPES:
        ivs = run(leaf('chart_shape', shape=shape, includeOuter=True))
        total += sum(i['durationMin'] for i in ivs)
    assert abs(total - 3 * 1440.0) < 3.0


# ═══════════════ M14 midpoint:modulus×target ═══════════════

@pytest.mark.parametrize('modulus', [360, 90, 45, 22.5, 11.25])
def test_m14_midpoint_moduli(modulus):
    run(leaf('midpoint', a='Sun', b='Moon',
             target={'kind': 'fixedLon', 'lon': 0.0}, modulus=modulus, orb=min(1.5, modulus / 4)))


@pytest.mark.parametrize('target', [
    {'kind': 'planet', 'id': 'Venus'},
    {'kind': 'midpoint', 'pair': ['Mars', 'Jupiter']},
    {'kind': 'angle', 'id': 'MC'},
    {'kind': 'lot', 'id': 'fortuna'},
])
def test_m14_midpoint_targets(target):
    run(leaf('midpoint', a='Sun', b='Moon', target=target, modulus=90, orb=1.5))


def test_m14_midpoint_degenerate_same_star():
    run(leaf('midpoint', a='Moon', b='Moon',
             target={'kind': 'fixedLon', 'lon': 0.0}, modulus=90, orb=1.0), **WEEK)


# ═══════════════ M15 day_window ═══════════════

@pytest.mark.parametrize('win', [('09:00', '17:00'), ('22:00', '02:00'),
                                 ('00:00', '23:59'), ('23:00', '23:30')])
def test_m15_day_windows(win):
    ivs = run(leaf('day_window', **{'from': win[0], 'to': win[1]}))
    assert ivs


# ═══════════════ 逻辑组合层 ═══════════════

_REP_LEAVES = [
    asp(orb=8),
    leaf('in_sign', planet='Moon', signs=[0, 1, 2]),
    leaf('in_house', planet='Sun', houses=[1, 4, 7, 10]),
    leaf('dignity_state', planet='Sun', states=['exalt']),
    leaf('considerations', item='sun_above_horizon'),
    leaf('day_window', **{'from': '08:00', 'to': '20:00'}),
    leaf('numeric', planet='Moon', field='LongSpeed', op='gt', value=12),
    leaf('chart_shape', shape='bowl', includeOuter=True),
]


@pytest.mark.parametrize('i', range(len(_REP_LEAVES)))
def test_c1_not_complement_identity(i):
    """A ∪ ¬A = 全域 且 A ∩ ¬A = 空(逐代表叶)。"""
    a = run(_REP_LEAVES[i])
    na = run(N(_REP_LEAVES[i]))
    total = sum(x['durationMin'] for x in a) + sum(x['durationMin'] for x in na)
    assert abs(total - 3 * 1440.0) < 3.0
    both = run(A(_REP_LEAVES[i], N(_REP_LEAVES[i])))
    assert sum(x['durationMin'] for x in both) < 1.5


@pytest.mark.parametrize('i,j', [(0, 4), (1, 5), (2, 3), (5, 6), (4, 7), (0, 1), (3, 6)])
def test_c2_pairwise_and_or_de_morgan(i, j):
    """两两组合:AND⊂OR;德摩根 ¬(A∧B) = ¬A∨¬B(时长恒等)。"""
    a, b = _REP_LEAVES[i], _REP_LEAVES[j]
    t_and = sum(x['durationMin'] for x in run(A(a, b)))
    t_or = sum(x['durationMin'] for x in run(O(a, b)))
    assert t_and <= t_or + 1.0
    lhs = sum(x['durationMin'] for x in run(N(A(a, b))))
    rhs = sum(x['durationMin'] for x in run(O(N(a), N(b))))
    assert abs(lhs - rhs) < 2.0


def test_c3_xor_identity():
    """XOR = (A∪B)−(A∩B)(时长恒等);三元 XOR=奇数覆盖。"""
    a, b = _REP_LEAVES[4], _REP_LEAVES[5]
    t_xor = sum(x['durationMin'] for x in run(X(a, b)))
    t_or = sum(x['durationMin'] for x in run(O(a, b)))
    t_and = sum(x['durationMin'] for x in run(A(a, b)))
    assert abs(t_xor - (t_or - t_and)) < 2.0
    run(X(a, b, _REP_LEAVES[0]))


def test_c4_three_level_nesting():
    tree = A(
        O(asp(orb=10), leaf('in_sign', planet='Moon', signs=list(range(6)))),
        N(X(leaf('considerations', item='moon_waxing'),
            leaf('day_window', **{'from': '06:00', 'to': '18:00'}))),
        leaf('considerations', item='sun_above_horizon'),
    )
    run(tree, **WEEK)


def test_c5_bare_leaf_as_root():
    """裸叶作根(不包组)= 合法。"""
    ivs = run(asp(orb=5))
    assert ivs is not None


# ═══════════════ 边界/防呆/极端 ═══════════════

def test_b1_full_span_93_days_ok_94_rejected():
    run(leaf('in_sign', planet='Sun', signs=list(range(12))),
        startDate='2024/01/01', endDate='2024/04/02')
    run(asp(), expect_err='span_too_large', startDate='2024/01/01', endDate='2024/04/15')


def test_b2_invalid_trees():
    run({'type': 'all', 'conditions': []}, expect_err='invalid_conditions')
    run({'type': 'not', 'conditions': [asp(), asp()]}, expect_err='invalid_conditions')
    run(leaf('aspect', planetA='Moon', planetB='Moon', angle=90, orb=3), expect_err='invalid_conditions')
    run(leaf('numeric', planet='Sun', field='Long', op='gt', value=10), expect_err='invalid_conditions')
    run(leaf('numeric', planet='Sun', field='Long', op='between', value=10), expect_err='invalid_conditions')
    run(leaf('day_window', **{'from': '09:00', 'to': '09:00'}), expect_err='invalid_conditions')
    run(leaf('day_window', **{'from': '9am', 'to': '17:00'}), expect_err='invalid_conditions')
    run(leaf('in_house', planet='Moon', houses=[13]), expect_err='invalid_conditions')
    run(leaf('in_sign', planet='Moon', signs=[]), expect_err='invalid_conditions')
    run(leaf('besieged', target='Moon', besiegerA='Moon', besiegerB='Saturn'), expect_err='invalid_conditions')
    run(leaf('midpoint', a='Sun', b='Moon', target={'kind': 'fixedLon', 'lon': 0}, modulus=90, orb=60),
        expect_err='invalid_conditions')
    run(leaf('aspect_pattern', pattern='hexagram'), expect_err='invalid_conditions')
    run(leaf('chart_shape', shape='donut'), expect_err='invalid_conditions')
    run(leaf('dignity_state', planet='Moon', states=['glorious']), expect_err='invalid_conditions')
    run(leaf('considerations', item='mercury_retro_shadow'), expect_err='invalid_conditions')
    run(leaf('point_relation', planet='Moon', point={'kind': 'star', 'id': 'Spica'}, relation='any'),
        expect_err='invalid_conditions')


def test_b3_sidereal_lahiri_sign_and_numeric():
    """恒星制(lahiri):in_sign 边界处 sid 黄经贴 30 整;numeric Long 同减。"""
    ivs = run(leaf('in_sign', planet='Sun', signs=[0]),
              startDate='2024/04/10', endDate='2024/04/20', zodiacal=1, siderealAyanamsa='lahiri')
    assert ivs, 'lahiri 白羊(太阳 4/13 入)应命中'
    ctx = es.ScanContext({**BASE, 'zodiacal': 1, 'siderealAyanamsa': 'lahiri'})
    edge = ivs[0]['startJd']
    sid = es._sid_lon(ctx.moment(edge), 'Sun', ctx)
    assert min(sid % 30.0, 30.0 - (sid % 30.0)) < 0.02
    run(leaf('numeric', planet='Sun', field='Long', op='between', value=0, value2=5),
        startDate='2024/04/10', endDate='2024/04/20', zodiacal=1, siderealAyanamsa='lahiri')


def test_b4_polar_in_house_and_asc_boundary():
    """极区(78N):宫位叶(cusps 回退 Porphyry)与 ASC 边界考量不炸。"""
    polar = {'gpsLat': 78.0, 'gpsLon': 15.0}
    run(leaf('in_house', planet='Moon', houses=[1]), **polar)
    run(leaf('considerations', item='asc_near_boundary'), **polar)


def test_b5_zone_variants_and_default_endtime():
    run(asp(), zone='+08:00')
    data = dict(BASE)
    data.pop('endTime', None)
    data['conditions'] = asp()
    rsp = es.scan(data)
    assert 'err' not in rsp


def test_b6_conflicting_combo_empty_fast():
    """互斥组合:月亮同时在白羊与天秤 = 恒空。"""
    ivs = run(A(leaf('in_sign', planet='Moon', signs=[0]),
                leaf('in_sign', planet='Moon', signs=[6])), **WEEK)
    assert sum(i['durationMin'] for i in ivs) < 1.0


def test_b7_truncation_cap():
    """海量区间截断:midpoint 22.5 盘小 orb 高频命中,intervals ≤ 600 且 truncated 标记。"""
    data = dict(BASE)
    data.update({'endDate': '2024/07/08'})
    data['conditions'] = leaf('midpoint', a='Moon', b='Moon',
                              target={'kind': 'fixedLon', 'lon': 0.0}, modulus=11.25, orb=2.0)
    rsp = es.scan(data)
    assert 'err' not in rsp
    assert len(rsp['intervals']) <= 600
    if rsp['truncated']:
        assert len(rsp['intervals']) == 600


def test_b8_precision_second_vs_minute():
    sec = run(asp(angle=0), precision='second')
    minu = run(asp(angle=0), precision='minute')
    assert len(sec) == len(minu)
    assert len(sec[0]['start']) == 19 and len(minu[0]['start']) == 16


# ═══════════════ M16 light_dynamics(R3):八学说×槽位过滤×防呆 ═══════════════

def _ld(item, **params):
    p = {'item': item}
    p.update(params)
    return leaf('light_dynamics', **p)


@pytest.mark.parametrize('item', ['translation', 'collection', 'prohibition', 'frustration',
                                  'refranation', 'aversion', 'bending', 'void'])
def test_m16_light_dynamics_all_items(item):
    run(_ld(item), **WEEK)


def test_m16_light_dynamics_role_subset():
    """槽位过滤 ⊆ 全 any(存在量词收缩律);月为 mover 的传光 ⊆ 任意传光。"""
    full = run(_ld('translation'), **WEEK)
    sub = run(_ld('translation', mover='Moon'), **WEEK)
    tot = lambda ivs: sum(i['durationMin'] for i in ivs)  # noqa: E731
    assert tot(sub) <= tot(full) + 1e-6


def test_m16_light_dynamics_bending_which_union():
    """北弯∪南弯 = which=any(分域完备)。"""
    n = run(_ld('bending', planet='Moon', which='north'), **WEEK)
    s = run(_ld('bending', planet='Moon', which='south'), **WEEK)
    both = run(O(_ld('bending', planet='Moon', which='north'),
                 _ld('bending', planet='Moon', which='south')), **WEEK)
    any_ = run(_ld('bending', planet='Moon', which='any'), **WEEK)
    tot = lambda ivs: sum(i['durationMin'] for i in ivs)  # noqa: E731
    assert abs(tot(both) - tot(any_)) < 2.0
    assert tot(n) + tot(s) >= tot(any_) - 2.0


def test_m16_light_dynamics_void_classical_variant():
    run(_ld('void', voidClassical=True), **WEEK)


@pytest.mark.parametrize('bad', [
    {'item': 'no_such'},
    {'item': 'translation', 'mover': 'Pluto'},
    {'item': 'void', 'planet': 'Venus'},
    {'item': 'bending', 'planet': 'Moon', 'which': 'east'},
    {'item': 'aversion', 'a': 'Moon', 'b': 'Moon'},
])
def test_m16_light_dynamics_rejects(bad):
    run(leaf('light_dynamics', **bad), expect_err='invalid_conditions')


# ═══════════════ M17 royal_attendance(R3):皇室伴寝 ═══════════════

@pytest.mark.parametrize('slot', ['first_occidental', 'first_oriental',
                                  'any_occidental', 'any_oriental'])
def test_m17_royal_slots(slot):
    run(leaf('royal_attendance', ref='Moon', slot=slot, companion='Venus'), **WEEK)


def test_m17_royal_first_subset_of_any():
    first = run(leaf('royal_attendance', ref='Sun', slot='first_occidental', companion='Mercury'), **WEEK)
    any_ = run(leaf('royal_attendance', ref='Sun', slot='any_occidental', companion='Mercury'), **WEEK)
    tot = lambda ivs: sum(i['durationMin'] for i in ivs)  # noqa: E731
    assert tot(first) <= tot(any_) + 1e-6


def test_m17_royal_occidental_oriental_complement():
    """对任意 companion:西没侧∪东升侧=全域(除黄经差恰 0/180 的测度零点)。"""
    occ = run(leaf('royal_attendance', ref='Moon', slot='any_occidental', companion='Saturn'), **WEEK)
    ori = run(leaf('royal_attendance', ref='Moon', slot='any_oriental', companion='Saturn'), **WEEK)
    tot = sum(i['durationMin'] for i in occ) + sum(i['durationMin'] for i in ori)
    span = 7 * 1440.0
    assert abs(tot - span) < 5.0


@pytest.mark.parametrize('bad', [
    {'ref': 'Moon', 'slot': 'first_occidental', 'companion': 'Moon'},
    {'ref': 'Pluto', 'slot': 'first_occidental', 'companion': 'Venus'},
    {'ref': 'Moon', 'slot': 'nearest', 'companion': 'Venus'},
])
def test_m17_royal_rejects(bad):
    run(leaf('royal_attendance', **bad), expect_err='invalid_conditions')


# ═══════════════ M18 sect_joy(R3):宗派/得时/喜乐 ═══════════════

def test_m18_sect_joy_diurnal_complement():
    """昼盘 ∪ NOT 昼盘 = 全域(真地平口径)。"""
    a = run(leaf('sect_joy', item='diurnal'))
    b = run(N(leaf('sect_joy', item='diurnal')))
    tot = sum(i['durationMin'] for i in a) + sum(i['durationMin'] for i in b)
    assert abs(tot - 3 * 1440.0) < 3.0


@pytest.mark.parametrize('planet', ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'])
def test_m18_sect_joy_of_sect_all(planet):
    run(leaf('sect_joy', item='of_sect', planet=planet), **WEEK)


def test_m18_sect_joy_of_sect_daystar_equals_diurnal():
    """日间星(木)同宗 ≡ 昼盘;夜间星(金)同宗 ≡ NOT 昼盘(定义级恒等)。"""
    jup = run(leaf('sect_joy', item='of_sect', planet='Jupiter'))
    day = run(leaf('sect_joy', item='diurnal'))
    assert len(jup) == len(day)
    for x, y in zip(jup, day):
        assert abs(x['startJd'] - y['startJd']) * 1440 < 2.5
        assert abs(x['endJd'] - y['endJd']) * 1440 < 2.5


def test_m18_sect_joy_hayyiz_levels_union_subset():
    """levels 子集律:[Hayyiz] ⊆ [Hayyiz,DemiHayyiz];四档并=全域。"""
    one = run(leaf('sect_joy', item='hayyiz', planet='Mars', hayyizLevels=['Hayyiz']), **WEEK)
    two = run(leaf('sect_joy', item='hayyiz', planet='Mars', hayyizLevels=['Hayyiz', 'DemiHayyiz']), **WEEK)
    allv = run(leaf('sect_joy', item='hayyiz', planet='Mars',
                    hayyizLevels=['Hayyiz', 'DemiHayyiz', 'InWrongPos', 'None']), **WEEK)
    tot = lambda ivs: sum(i['durationMin'] for i in ivs)  # noqa: E731
    assert tot(one) <= tot(two) + 1e-6
    assert abs(tot(allv) - 7 * 1440.0) < 3.0


@pytest.mark.parametrize('item,planet', [('house_joy', 'Moon'), ('sign_joy', 'Moon'), ('sign_joy', 'Saturn')])
def test_m18_sect_joy_joys(item, planet):
    run(leaf('sect_joy', item=item, planet=planet), **WEEK)


@pytest.mark.parametrize('bad', [
    {'item': 'no_such'},
    {'item': 'of_sect', 'planet': 'Pluto'},
    {'item': 'hayyiz', 'planet': 'Mars', 'hayyizLevels': ['Super']},
])
def test_m18_sect_joy_rejects(bad):
    run(leaf('sect_joy', **bad), expect_err='invalid_conditions')


# ═══════════════ M19 degree_state(R3):度性查表 ═══════════════

def test_m19_mansion_union_is_full_domain():
    """28 宿并集=全域(月站分域完备,恒等级)。"""
    tree = O(*[leaf('degree_state', planet='Moon', item='mansion', mansion=i) for i in range(1, 29)])
    ivs = run(tree)
    tot = sum(i['durationMin'] for i in ivs)
    assert abs(tot - 3 * 1440.0) < 3.0


@pytest.mark.parametrize('ruler', ['Saturn', 'Jupiter', 'Mars', 'Sun', 'Venus', 'Mercury', 'Moon'])
def test_m19_monomoiria_each_ruler(ruler):
    run(leaf('degree_state', planet='Moon', item='monomoiria', ruler=ruler))


def test_m19_monomoiria_union_full():
    """单度主星七政并=全域(迦勒底序逐度循环)。"""
    tree = O(*[leaf('degree_state', planet='Moon', item='monomoiria', ruler=r)
               for r in ('Saturn', 'Jupiter', 'Mars', 'Sun', 'Venus', 'Mercury', 'Moon')])
    ivs = run(tree)
    tot = sum(i['durationMin'] for i in ivs)
    assert abs(tot - 3 * 1440.0) < 3.0


@pytest.mark.parametrize('q', ['B', 'D', 'E', 'S'])
def test_m19_quality_each(q):
    run(leaf('degree_state', planet='Moon', item='quality', quality=q), **WEEK)


@pytest.mark.parametrize('sp', ['pitted', 'azemene', 'increasing_fortune'])
def test_m19_special_each(sp):
    run(leaf('degree_state', planet='Moon', item='special', special=sp), **WEEK)


def test_m19_darijan_runs():
    run(leaf('degree_state', planet='Moon', item='darijan', ruler='Mars'), **WEEK)


def test_m19_sidereal_variant():
    run(leaf('degree_state', planet='Moon', item='mansion', mansion=5),
        zodiacal=1, siderealAyanamsa='lahiri')


@pytest.mark.parametrize('bad', [
    {'planet': 'Moon', 'item': 'mansion', 'mansion': 29},
    {'planet': 'Moon', 'item': 'monomoiria', 'ruler': 'Pluto'},
    {'planet': 'Moon', 'item': 'quality', 'quality': 'X'},
    {'planet': 'Moon', 'item': 'special', 'special': 'lucky'},
    {'planet': 'Moon', 'item': 'no_such'},
])
def test_m19_degree_rejects(bad):
    run(leaf('degree_state', **bad), expect_err='invalid_conditions')


# ═══════════════ M20 decan_state(R3):三十六旬 ═══════════════

def test_m20_decan_union_full():
    """36 旬并=全域。"""
    tree = O(*[leaf('decan_state', mode='planet_in', planet='Moon', decans=list(range(1, 19))),
               leaf('decan_state', mode='planet_in', planet='Moon', decans=list(range(19, 37)))])
    ivs = run(tree)
    tot = sum(i['durationMin'] for i in ivs)
    assert abs(tot - 3 * 1440.0) < 3.0


def test_m20_decan_ruler_union_full():
    """旬主(迦勒底面)七政并=全域。"""
    tree = O(*[leaf('decan_state', mode='ruler_is', planet='Moon', ruler=r)
               for r in ('Saturn', 'Jupiter', 'Mars', 'Sun', 'Venus', 'Mercury', 'Moon')])
    ivs = run(tree)
    tot = sum(i['durationMin'] for i in ivs)
    assert abs(tot - 3 * 1440.0) < 3.0


def test_m20_decan_talisman_runs():
    ivs = run(leaf('decan_state', mode='talisman', decans=[10, 11, 12]), **WEEK)
    assert ivs, '一周内 ASC 每日扫全轮,第10-12旬必有命中'


@pytest.mark.parametrize('bad', [
    {'mode': 'planet_in', 'planet': 'Moon', 'decans': []},
    {'mode': 'planet_in', 'planet': 'Moon', 'decans': [37]},
    {'mode': 'ruler_is', 'planet': 'Moon', 'ruler': 'Pluto'},
    {'mode': 'no_such'},
])
def test_m20_decan_rejects(bad):
    run(leaf('decan_state', **bad), expect_err='invalid_conditions')


# ═══════════════ M21 pattern_overview(R3):大势格局 ═══════════════

@pytest.mark.parametrize('item', ['dragon_embrace', 'dragon_intercept', 'lone_moon',
                                  'apriori_power', 'eight_kill', 'strong_jupiter',
                                  'afflicted_ruler', 'sentient_link'])
def test_m21_overview_all_items(item):
    run(leaf('pattern_overview', item=item), **WEEK)


def test_m21_overview_eight_kill_subset_of_apriori():
    """八杀朝天(先验+夜生) ⊆ 先验权力(子集律)。"""
    ek = run(leaf('pattern_overview', item='eight_kill'), **WEEK)
    ap = run(leaf('pattern_overview', item='apriori_power'), **WEEK)
    tot = lambda ivs: sum(i['durationMin'] for i in ivs)  # noqa: E731
    assert tot(ek) <= tot(ap) + 1e-6


def test_m21_overview_which_union():
    """which 分域:8_12 ∪ 8_1 ⊇ any 且 any ⊇ 各分支。"""
    w12 = run(leaf('pattern_overview', item='apriori_power', which='8_12'), **WEEK)
    w81 = run(leaf('pattern_overview', item='apriori_power', which='8_1'), **WEEK)
    anyw = run(leaf('pattern_overview', item='apriori_power', which='any'), **WEEK)
    both = run(O(leaf('pattern_overview', item='apriori_power', which='8_12'),
                 leaf('pattern_overview', item='apriori_power', which='8_1')), **WEEK)
    tot = lambda ivs: sum(i['durationMin'] for i in ivs)  # noqa: E731
    assert abs(tot(both) - tot(anyw)) < 2.5
    assert tot(w12) <= tot(anyw) + 1e-6 and tot(w81) <= tot(anyw) + 1e-6


def test_m21_overview_strong_jupiter_minlit_monotone():
    a = run(leaf('pattern_overview', item='strong_jupiter', minLit=0), **WEEK)
    b = run(leaf('pattern_overview', item='strong_jupiter', minLit=3), **WEEK)
    tot = lambda ivs: sum(i['durationMin'] for i in ivs)  # noqa: E731
    assert tot(b) <= tot(a) + 1e-6


def test_m21_overview_sentient_pure_union():
    """三有情档并 = any_pure(分域完备)。"""
    parts = [run(leaf('pattern_overview', item='sentient_link', purity=k), **WEEK)
             for k in ('mundane_pure', 'eso_pure', 'eso_mundane')]
    anyp = run(leaf('pattern_overview', item='sentient_link', purity='any_pure'), **WEEK)
    union = run(O(*[leaf('pattern_overview', item='sentient_link', purity=k)
                    for k in ('mundane_pure', 'eso_pure', 'eso_mundane')]), **WEEK)
    tot = lambda ivs: sum(i['durationMin'] for i in ivs)  # noqa: E731
    assert abs(tot(union) - tot(anyp)) < 2.5
    assert sum(tot(p) for p in parts) >= tot(anyp) - 2.5


@pytest.mark.parametrize('bad', [
    {'item': 'no_such'},
    {'item': 'dragon_intercept', 'planet': 'Pluto'},
    {'item': 'apriori_power', 'which': '12_1'},
    {'item': 'strong_jupiter', 'minLit': 9},
    {'item': 'sentient_link', 'purity': 'super'},
])
def test_m21_overview_rejects(bad):
    run(leaf('pattern_overview', **bad), expect_err='invalid_conditions')


# ═══════════════ M22 dispositor_cycle(R3):主宰循环 ═══════════════

@pytest.mark.parametrize('mode', ['final_is', 'final_exists', 'in_loop', 'loop_exists'])
def test_m22_dispositor_all_modes(mode):
    p = {'mode': mode}
    if mode in ('final_is', 'in_loop'):
        p['planet'] = 'Mars'
    run(leaf('dispositor_cycle', **p), **WEEK)


def test_m22_dispositor_final_union_equals_exists():
    """七政 final_is 并 = final_exists(分域完备)。"""
    union = run(O(*[leaf('dispositor_cycle', mode='final_is', planet=pl)
                    for pl in ('Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn')]), **WEEK)
    ex = run(leaf('dispositor_cycle', mode='final_exists'), **WEEK)
    tot = lambda ivs: sum(i['durationMin'] for i in ivs)  # noqa: E731
    assert abs(tot(union) - tot(ex)) < 2.5


@pytest.mark.parametrize('bad', [
    {'mode': 'final_is'},
    {'mode': 'in_loop', 'planet': 'Pluto'},
    {'mode': 'no_such'},
])
def test_m22_dispositor_rejects(bad):
    run(leaf('dispositor_cycle', **bad), expect_err='invalid_conditions')


# ═══════════════ M23-M26 almuten/distribution/temperament/accidental(R3) ═══════════════

def test_m23_almuten_chart_union_full():
    """盘主七政并=全域(每时刻必有唯一胜者,max 平分首序决)。"""
    union = run(O(*[leaf('almuten_is', scope='chart', planet=pl)
                    for pl in ('Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn')]))
    tot = sum(i['durationMin'] for i in union)
    assert abs(tot - 3 * 1440.0) < 3.0


def test_m23_almuten_topic_runs():
    run(leaf('almuten_is', scope='topic', house=7, planet='Venus'), **WEEK)


@pytest.mark.parametrize('bad', [
    {'scope': 'chart', 'planet': 'Pluto'},
    {'scope': 'topic', 'planet': 'Sun', 'house': 13},
    {'scope': 'no', 'planet': 'Sun'},
])
def test_m23_almuten_rejects(bad):
    run(leaf('almuten_is', **bad), expect_err='invalid_conditions')


def test_m24_distribution_element_exclusive_max():
    """四元素严格最多两两互斥(同一时刻至多一个真)。"""
    ivs = {k: run(leaf('distribution_state', axis='element', key=k, op='max'), **WEEK)
           for k in ('Fire', 'Earth', 'Air', 'Water')}
    for k1 in ivs:
        for k2 in ivs:
            if k1 >= k2:
                continue
            both = run(A(leaf('distribution_state', axis='element', key=k1, op='max'),
                         leaf('distribution_state', axis='element', key=k2, op='max')), **WEEK)
            assert not both, (k1, k2, both)


def test_m24_distribution_gte_lte_complement():
    """gte(N) ∪ lte(N−1) = 全域(整数计数互补)。"""
    a = run(leaf('distribution_state', axis='hemisphere', key='above', op='gte', value=5))
    b = run(leaf('distribution_state', axis='hemisphere', key='above', op='lte', value=4))
    tot = sum(i['durationMin'] for i in a) + sum(i['durationMin'] for i in b)
    assert abs(tot - 3 * 1440.0) < 3.0


def test_m24_distribution_seven_vs_ten():
    run(leaf('distribution_state', axis='mode', key='Fixed', op='gte', value=3, includeOuter=False), **WEEK)


@pytest.mark.parametrize('bad', [
    {'axis': 'element', 'key': 'east', 'op': 'max'},
    {'axis': 'hemisphere', 'key': 'above', 'op': 'gte', 'value': 11},
    {'axis': 'no', 'key': 'Fire', 'op': 'max'},
])
def test_m24_distribution_rejects(bad):
    run(leaf('distribution_state', **bad), expect_err='invalid_conditions')


def test_m25_temperament_dominant_exclusive():
    """四气质严格主导互斥。"""
    hits = []
    for v in ('Choleric', 'Melancholic', 'Sanguine', 'Phlegmatic'):
        hits.append(run(leaf('temperament', kind='temperament', value=v, op='dominant')))
    for i in range(4):
        for j in range(i + 1, 4):
            vi = ('Choleric', 'Melancholic', 'Sanguine', 'Phlegmatic')
            both = run(A(leaf('temperament', kind='temperament', value=vi[i], op='dominant'),
                         leaf('temperament', kind='temperament', value=vi[j], op='dominant')))
            assert not both


def test_m25_temperament_quality_gte():
    run(leaf('temperament', kind='quality', value='Hot', op='gte', count=4), **WEEK)


@pytest.mark.parametrize('bad', [
    {'kind': 'temperament', 'value': 'Hot'},
    {'kind': 'quality', 'value': 'Hot', 'op': 'gte', 'count': 13},
])
def test_m25_temperament_rejects(bad):
    run(leaf('temperament', **bad), expect_err='invalid_conditions')


def test_m26_accidental_gte_lte_complement():
    """gte(N) ∪ lte(N−1) = 全域(整数分互补)。"""
    a = run(leaf('accidental_score', planet='Jupiter', op='gte', value=5))
    b = run(leaf('accidental_score', planet='Jupiter', op='lte', value=4))
    tot = sum(i['durationMin'] for i in a) + sum(i['durationMin'] for i in b)
    assert abs(tot - 3 * 1440.0) < 3.0


def test_m26_accidental_top1_at_most_one():
    """top1 严格最高:任两星同刻不可同真。"""
    both = run(A(leaf('accidental_score', planet='Jupiter', op='top1'),
                 leaf('accidental_score', planet='Venus', op='top1')))
    assert not both


@pytest.mark.parametrize('bad', [
    {'planet': 'Pluto', 'op': 'gte', 'value': 0},
    {'planet': 'Moon', 'op': 'gte', 'value': 99},
    {'planet': 'Moon', 'op': 'no'},
])
def test_m26_accidental_rejects(bad):
    run(leaf('accidental_score', **bad), expect_err='invalid_conditions')


# ═══════════════ M27/M28 classical_pattern/eminence_level(R3) ═══════════════

@pytest.mark.parametrize('pattern', ['doryphory', 'overcoming', 'besieging_degree'])
def test_m27_classical_all(pattern):
    run(leaf('classical_pattern', pattern=pattern), **WEEK)


def test_m27_overcoming_aspect_union():
    """三分/四分/六分压制并 = any(分域完备)。"""
    parts = [leaf('classical_pattern', pattern='overcoming', over='Saturn', aspectKind=k)
             for k in ('trine', 'square', 'sextile')]
    union = run(O(*parts), **WEEK)
    anyk = run(leaf('classical_pattern', pattern='overcoming', over='Saturn', aspectKind='any'), **WEEK)
    tot = lambda ivs: sum(i['durationMin'] for i in ivs)  # noqa: E731
    assert abs(tot(union) - tot(anyk)) < 2.5


def test_m27_doryphory_subset_of_sect_light():
    """护卫星过滤 ⊆ any。"""
    sub = run(leaf('classical_pattern', pattern='doryphory', planet='Venus'), **WEEK)
    anyp = run(leaf('classical_pattern', pattern='doryphory', planet='any'), **WEEK)
    tot = lambda ivs: sum(i['durationMin'] for i in ivs)  # noqa: E731
    assert tot(sub) <= tot(anyp) + 1e-6


@pytest.mark.parametrize('bad', [
    {'pattern': 'no_such'},
    {'pattern': 'overcoming', 'over': 'Mars', 'under': 'Mars'},
    {'pattern': 'doryphory', 'planet': 'Pluto'},
    {'pattern': 'overcoming', 'aspectKind': 'quintile'},
])
def test_m27_classical_rejects(bad):
    run(leaf('classical_pattern', **bad), expect_err='invalid_conditions')


def test_m28_eminence_band_partition():
    """四档并=全域且两两互斥(band 分域完备)。"""
    bands = ('eminent', 'notable', 'ordinary', 'obscure')
    union = run(O(*[leaf('eminence_level', op='band', band=b) for b in bands]))
    tot = sum(i['durationMin'] for i in union)
    assert abs(tot - 3 * 1440.0) < 3.0
    for i in range(4):
        for j in range(i + 1, 4):
            both = run(A(leaf('eminence_level', op='band', band=bands[i]),
                         leaf('eminence_level', op='band', band=bands[j])))
            assert not both, (bands[i], bands[j])


def test_m28_eminence_gte_monotone():
    a = run(leaf('eminence_level', op='gte', value=3))
    b = run(leaf('eminence_level', op='gte', value=6))
    tot = lambda ivs: sum(i['durationMin'] for i in ivs)  # noqa: E731
    assert tot(b) <= tot(a) + 1e-6


@pytest.mark.parametrize('bad', [
    {'op': 'band', 'band': 'legendary'},
    {'op': 'gte', 'value': 11},
    {'op': 'no'},
])
def test_m28_eminence_rejects(bad):
    run(leaf('eminence_level', **bad), expect_err='invalid_conditions')


# ═══════════════ M32 lifespan_state(R3):寿命格局 ═══════════════

@pytest.mark.parametrize('method', ['ptolemy', 'alcabitius', 'dorotheus'])
def test_m32_lifespan_hyleg_partition(method):
    """五释放点∪none = 全域(每时刻 hyleg 结论唯一,分域完备)。"""
    tree = O(*[leaf('lifespan_state', item='hyleg_is', method=method, point=pt)
               for pt in ('sun', 'moon', 'asc', 'fortune', 'syzygy', 'none')])
    ivs = run(tree)
    tot = sum(i['durationMin'] for i in ivs)
    assert abs(tot - 3 * 1440.0) < 3.0


def test_m32_lifespan_epikratetor_equals_hyleg():
    """占控星 ≡ 生命主(定义级恒等)。"""
    a = run(leaf('lifespan_state', item='hyleg_is', method='ptolemy', point='sun'), **WEEK)
    b = run(leaf('lifespan_state', item='epikratetor_is', method='ptolemy', point='sun'), **WEEK)
    assert len(a) == len(b)
    for x, y in zip(a, b):
        assert abs(x['startJd'] - y['startJd']) * 1440 < 2.5


def test_m32_lifespan_items_run():
    for item, extra in (('alcocoden_is', {'planet': 'Jupiter'}),
                        ('oikodespotes_is', {'planet': 'Mars'}),
                        ('kurios_is', {'planet': 'Saturn'}),
                        ('medical_crisis', {})):
        run(leaf('lifespan_state', item=item, method='alcabitius', **extra), **WEEK)


def test_m32_lifespan_kurios_union_full():
    tree = O(*[leaf('lifespan_state', item='kurios_is', method='ptolemy', planet=pl)
               for pl in ('Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn')])
    ivs = run(tree)
    tot = sum(i['durationMin'] for i in ivs)
    assert abs(tot - 3 * 1440.0) < 3.0


@pytest.mark.parametrize('bad', [
    {'item': 'no_such'},
    {'item': 'hyleg_is', 'method': 'bonatti', 'point': 'sun'},
    {'item': 'hyleg_is', 'method': 'ptolemy', 'point': 'mc'},
    {'item': 'alcocoden_is', 'planet': 'Pluto'},
])
def test_m32_lifespan_rejects(bad):
    run(leaf('lifespan_state', **bad), expect_err='invalid_conditions')


# ═══════════════ M33(R5):恒星制全类+新旧组合深嵌套 ═══════════════

_R5_ALL_LEAVES = {
    'aspect': {'planetA': 'Moon', 'planetB': 'Sun', 'angle': 90, 'orb': 4, 'motion': 'any', 'side': 'any', 'partile': 'off'},
    'in_sign': {'planet': 'Moon', 'signs': [0, 1, 2, 3]},
    'numeric': {'planet': 'Moon', 'field': 'Lat', 'op': 'gte', 'value': 0},
    'midpoint': {'a': 'Sun', 'b': 'Moon', 'target': {'kind': 'planet', 'id': 'Venus'}, 'modulus': 90, 'orb': 2},
    'point_relation': {'planet': 'Moon', 'point': {'kind': 'angle', 'id': 'ASC'}, 'relation': 'any', 'orb': 8},
    'in_house': {'planet': 'Moon', 'houses': [1, 2, 3, 10, 11, 12]},
    'reception': {'planetA': 'Moon', 'planetB': 'Venus', 'levels': ['ruler', 'exalt', 'trip', 'term', 'face'], 'match': 'any', 'requireAspect': False},
    'mutual_reception': {'planetA': 'Mercury', 'planetB': 'Venus', 'levels': ['ruler', 'exalt', 'trip', 'term', 'face'], 'pairing': 'any_pair', 'requireAspect': False},
    'rulership': {'planetA': 'Mars', 'planetB': 'Moon', 'mode': 'dispositor_is'},
    'dignity_state': {'planet': 'Venus', 'states': ['direct'], 'require': 'any'},
    'considerations': {'item': 'moon_waxing'},
    'besieged': {'target': 'Moon', 'besiegerA': 'Venus', 'besiegerB': 'Mars', 'mode': 'ray', 'orbLeft': 30, 'orbRight': 30, 'rescue': {'enabled': False}, 'mitigation': {}},
    'aspect_pattern': {'pattern': 'grand_trine', 'apex': 'any', 'members': 'any', 'orb': 8},
    'chart_shape': {'shape': 'bowl', 'includeOuter': False},
    'day_window': {'from': '06:00', 'to': '18:00'},
    'light_dynamics': {'item': 'aversion', 'a': 'Moon', 'b': 'any'},
    'royal_attendance': {'ref': 'Moon', 'slot': 'any_occidental', 'companion': 'Venus'},
    'sect_joy': {'item': 'of_sect', 'planet': 'Venus'},
    'degree_state': {'planet': 'Moon', 'item': 'mansion', 'mansion': 5},
    'decan_state': {'mode': 'planet_in', 'planet': 'Moon', 'decans': [10, 11, 12, 13, 14, 15]},
    'pattern_overview': {'item': 'afflicted_ruler', 'planet': 'any'},
    'dispositor_cycle': {'mode': 'final_exists'},
    'almuten_is': {'scope': 'chart', 'planet': 'Mars'},
    'distribution_state': {'axis': 'element', 'key': 'Water', 'op': 'gte', 'value': 3},
    'temperament': {'kind': 'quality', 'value': 'Hot', 'op': 'gte', 'count': 3},
    'accidental_score': {'planet': 'Jupiter', 'op': 'gte', 'value': 3},
    'classical_pattern': {'pattern': 'overcoming', 'over': 'Saturn', 'under': 'any', 'aspectKind': 'any'},
    'eminence_level': {'op': 'gte', 'value': 4},
    'lifespan_state': {'item': 'hyleg_is', 'method': 'ptolemy', 'point': 'sun'},
    'antiscia': {'planet': 'Moon', 'kind': 'antiscia', 'target': {'kind': 'planet', 'id': 'Venus'}, 'orb': 3},
    'fixed_star': {'star': 'Regulus', 'target': {'kind': 'planet', 'id': 'Moon'}, 'orb': 2},
    'planetary_hour': {'kind': 'hour_ruler', 'planet': 'Jupiter'},
}


@pytest.mark.parametrize('t', sorted(_R5_ALL_LEAVES.keys()))
def test_m33_sidereal_every_type(t):
    """恒星制(lahiri)下全 32 类逐一可扫(座派生类走 _sid_lon 的全量证明)。"""
    run(leaf(t, **_R5_ALL_LEAVES[t]), zodiacal=1, siderealAyanamsa='lahiri')


_R5_PAIRS = [
    ('light_dynamics', 'considerations'), ('royal_attendance', 'in_sign'),
    ('sect_joy', 'day_window'), ('pattern_overview', 'dignity_state'),
    ('almuten_is', 'aspect'), ('eminence_level', 'planetary_hour'),
    ('lifespan_state', 'in_house'), ('degree_state', 'decan_state'),
    ('temperament', 'distribution_state'), ('classical_pattern', 'accidental_score'),
]


@pytest.mark.parametrize('ta,tb', _R5_PAIRS)
def test_m33_cross_pair_demorgan(ta, tb):
    """新旧类两两:AND⊂OR + 德摩根 NOT(A∪B)=NOT A∩NOT B(不同求解器族跨界代数)。"""
    a = leaf(ta, **_R5_ALL_LEAVES[ta])
    b = leaf(tb, **_R5_ALL_LEAVES[tb])
    tot = lambda ivs: sum(i['durationMin'] for i in ivs)  # noqa: E731
    and_ = run(A(a, b))
    or_ = run(O(a, b))
    assert tot(and_) <= tot(or_) + 1e-6
    lhs = run(N(O(a, b)))
    rhs = run(A(N(a), N(b)))
    assert abs(tot(lhs) - tot(rhs)) < 2.5


def test_m33_deep_nested_mixed():
    """三层深嵌套混门:XOR(NOT(A∧B), C∨D) 结构级+子域界内。"""
    t1 = X(N(A(leaf('light_dynamics', **_R5_ALL_LEAVES['light_dynamics']),
               leaf('sect_joy', **_R5_ALL_LEAVES['sect_joy']))),
           O(leaf('eminence_level', **_R5_ALL_LEAVES['eminence_level']),
             leaf('day_window', **_R5_ALL_LEAVES['day_window'])))
    run(t1)
    t2 = A(X(leaf('almuten_is', **_R5_ALL_LEAVES['almuten_is']),
             leaf('dispositor_cycle', **_R5_ALL_LEAVES['dispositor_cycle'])),
           N(leaf('pattern_overview', **_R5_ALL_LEAVES['pattern_overview'])))
    run(t2)
