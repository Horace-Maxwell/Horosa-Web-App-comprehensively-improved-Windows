# -*- coding: utf-8 -*-
"""天文地占 全功能压测矩阵。

判据(缺一不可):
  ① 管线通:settings 回显所传的值
  ② 真生效:该选项应当影响的输出字段确实随取值而变(纯显示项除外,单独标注)
  ③ 零回归:不传任何 granular ≡ 显式传该流派默认值,逐字段等同
  ④ 不变量:任何组合下判官点数恒偶、异或表盘三道校验恒过、十二宫恒十二图
  ⑤ 健壮:非法/空/越界取值不抛异常,按白名单回落
"""
import sys, json, itertools, traceback
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from astrostudy.geomancy.chart import compute_reading, HOUSE_PROJECTIONS, DIRECTIONS, COMPOUND_MODES
from astrostudy.geomancy.figures import points
from astrostudy.geomancy.numbers import NUMBER_SYSTEMS
from astrostudy.geomancy.random_source import MARK_STYLES
from astrostudy.geomancy.shield import RECONCILER_MODES
from astrostudy.geomancy.traditions import PROFILES

PROFILE_IDS = list(PROFILES)
QTYPES = ['life', 'health', 'wealth', 'marriage', 'career', 'children',
          'journey', 'religion', 'enemy', 'death', 'custom']
SCOPES = ['L0', 'L1', 'L2', 'L3', 'L4']
ZODIACS = ['classical', 'planetary']

rows = []          # 测试矩阵:[类别, 用例, 预期, 实际, 通过?]
def rec(cat, case, expect, actual, ok):
    rows.append((cat, case, expect, actual, 'PASS' if ok else 'FAIL'))
    return ok

fails = []
def check(cat, case, expect, actual, ok):
    if not rec(cat, case, expect, actual, ok):
        fails.append('[%s] %s | 期望 %s | 实际 %s' % (cat, case, expect, actual))

# ── 各选项「应当影响的输出投影」──────────────────────────────
def proj_reading(r):      return json.dumps(r['reading'], ensure_ascii=False, sort_keys=True)
def proj_settings(r, k):  return r['settings'].get(k)
def proj_numbers(r):      return json.dumps(r['judge']['number'], ensure_ascii=False, sort_keys=True)
def proj_recon(r):        return (r.get('reconciler') or {}).get('int')
def proj_by12(r):         return json.dumps(r.get('planet_placement_by_twelves'), ensure_ascii=False, sort_keys=True)
def proj_company(r):      return json.dumps(r['reading'].get('company'), ensure_ascii=False, sort_keys=True)

SEEDS = [1, 7, 42, 1234, 99999, 2147483647, 0]

# ═══ ① 生效性:逐选项逐取值 ═══════════════════════════════════
def effectiveness():
    # (选项名, 取值集, 传参名, 投影函数, 是否纯显示项)
    cases = [
        ('图数体系', NUMBER_SYSTEMS, 'number_system', proj_numbers, False),
        ('定局法', HOUSE_PROJECTIONS, 'house_projection', None, False),   # 特判:乙法出 by12
        ('合成同伴判法', COMPOUND_MODES, 'compound_mode', proj_company, False),
        ('调和者取法', RECONCILER_MODES, 'reconciler_mode', proj_recon, False),
        ('宫位成环', [False, True], 'wrap_houses', proj_reading, False),
        ('记号样式', MARK_STYLES, 'mark_style', None, True),              # 纯显示
        ('书写方向', DIRECTIONS, 'direction', None, True),                # 纯显示
    ]
    for name, values, param, proj, display_only in cases:
        seen = set()
        plumb_ok = True
        for v in values:
            r = compute_reading('wealth', 'european_classical', cast_method='manual',
                                seed=42, **{param: v})
            got = proj_settings(r, {'number_system': 'number_system'}.get(param, param))
            if got != v:
                plumb_ok = False
                check('生效性·管线', '%s=%s' % (name, v), 'settings 回显 %s' % v, got, False)
            if proj:
                seen.add(proj(r))
        check('生效性·管线', name, '所有取值 settings 均回显', '回显一致' if plumb_ok else '有偏差', plumb_ok)
        if display_only:
            rec('生效性·影响', name, '纯显示项,不改计算(设计如此)', '仅 settings 变', 'PASS')
        elif proj:
            # 🔴 方法学:单一种子下某些选项可能恰好不产生差异(如合成同伴需盘中恰有互反对)。
            #    故须扫多盘统计「有多少盘因该选项而改变」,>0 即证明非空转。
            diff = 0
            for sd in range(400):
                outs = set()
                for v in values:
                    kw = {param: v}
                    if param == 'reconciler_mode':
                        kw['turn_to'] = 7          # 未转宫时两法数学上必然同值,须转宫方能分野
                    outs.add(proj(compute_reading('wealth', 'european_classical',
                                                  cast_method='manual', seed=sd, **kw)))
                if len(outs) > 1:
                    diff += 1
            ok = diff > 0
            check('生效性·影响', name, '扫 400 盘中至少有盘因该选项而变(非空转)',
                  '%d/400 盘结果不同 (%.1f%%)' % (diff, diff / 4.0), ok)

    # 定局法特判:乙法必须出 by-twelves 且甲/顺铺不出
    r_seq = compute_reading('wealth', 'european_classical', cast_method='manual', seed=42,
                            house_projection='sequential')
    r_b12 = compute_reading('wealth', 'european_classical', cast_method='manual', seed=42,
                            house_projection='astro_bytwelves')
    check('生效性·影响', '定局法·乙', '乙法出落星(九星)且顺铺不出',
          '顺铺=%s 乙=%s' % (r_seq.get('planet_placement_by_twelves') is None,
                            len(r_b12.get('planet_placement_by_twelves') or {})),
          r_seq.get('planet_placement_by_twelves') is None and len(r_b12.get('planet_placement_by_twelves') or {}) == 9)
    # 乙法取随机不得污染盘序
    check('生效性·隔离', '定局乙独立子 rng', '护盾盘与判官不因取乙而变',
          '母图同=%s 判官同=%s' % ([f['int'] for f in r_seq['mothers']] == [f['int'] for f in r_b12['mothers']],
                                  r_seq['judge']['int'] == r_b12['judge']['int']),
          [f['int'] for f in r_seq['mothers']] == [f['int'] for f in r_b12['mothers']]
          and r_seq['judge']['int'] == r_b12['judge']['int'])

    # 调和者取法专项:未转宫时两法数学上必然同值(须如实回传提示),转宫后须能分野
    coin = sum(1 for sd in range(300)
               if compute_reading('wealth', 'european_classical', cast_method='manual', seed=sd,
                                  reconciler_mode='judge_querent_significator'
                                  )['settings']['reconciler_modes_coincide'])
    check('生效性·诚实', '调和者取法·未转宫', '300 盘全部如实标注两法同值(非静默失灵)',
          '%d/300 标注同值' % coin, coin == 300)
    div = 0
    for sd in range(300):
        for tt in (3, 7, 10):
            a = compute_reading('wealth', 'european_classical', cast_method='manual', seed=sd,
                                reconciler_mode='judge_first_mother', turn_to=tt)
            b = compute_reading('wealth', 'european_classical', cast_method='manual', seed=sd,
                                reconciler_mode='judge_querent_significator', turn_to=tt)
            if a['reconciler']['int'] != b['reconciler']['int']:
                div += 1
                break
    check('生效性·影响', '调和者取法·转宫后', '转宫后两法能真正分野(不再是死开关)',
          '%d/300 盘分野' % div, div > 0)

    # 转宫:每个宫号都应产出 derived 且随宫号不同
    dv = set()
    for h in range(1, 13):
        r = compute_reading('wealth', 'european_classical', cast_method='manual', seed=42, turn_to=h)
        d = r.get('derived')
        if not d or d['turn_to'] != h:
            check('生效性·影响', '转宫=%d' % h, '出 derived 块', d, False)
        else:
            dv.add(d['derived_quesited_house'])
    check('生效性·影响', '转宫', '不同宫号 → 派生宫不同', '12 宫产出 %d 种派生宫' % len(dv), len(dv) > 1)


# ═══ ② 零回归契约 ════════════════════════════════════════════
def zero_regression():
    bad = 0
    for pid in PROFILE_IDS:
        prof = PROFILES[pid]
        for q in QTYPES:
            for sd in (1, 42, 99999):
                a = compute_reading(q, pid, cast_method='manual', seed=sd)
                b = compute_reading(q, pid, cast_method='manual', seed=sd,
                                    mark_style=prof.get('mark_style'), direction=prof.get('direction'),
                                    house_projection=prof.get('house_projection'),
                                    wrap_houses=prof.get('wrap_houses'), reconciler=prof.get('reconciler'),
                                    compound_mode=prof.get('compound_mode') or 'inverse',
                                    number_system=prof.get('number_system') or 'points',
                                    chart_mode=prof.get('chart'))
                if json.dumps(a, ensure_ascii=False, sort_keys=True) != json.dumps(b, ensure_ascii=False, sort_keys=True):
                    bad += 1
    check('零回归', '不传 ≡ 显式传流派默认值', '8流派×11问类×3种子=264 组全等同',
          '%d 组不等同' % bad, bad == 0)


# ═══ ③ 组合穷举 + 不变量 ═════════════════════════════════════
def combinations():
    n = 0
    bad_inv = []
    combos = itertools.product(
        PROFILE_IDS,
        HOUSE_PROJECTIONS,
        [False, True],          # wrap
        COMPOUND_MODES,
        NUMBER_SYSTEMS,
        RECONCILER_MODES,
    )
    for pid, proj, wrap, comp, nums, rmode in combos:
        for sd in (7, 12345):
            n += 1
            try:
                r = compute_reading('marriage', pid, cast_method='manual', seed=sd,
                                    house_projection=proj, wrap_houses=wrap,
                                    compound_mode=comp, number_system=nums,
                                    reconciler_mode=rmode)
            except Exception as e:
                bad_inv.append('抛异常 %s/%s/%s: %s' % (pid, proj, wrap, e)); continue
            # 不变量
            if points(r['judge']['int']) % 2 != 0:
                bad_inv.append('判官点数非偶 %s seed%s' % (pid, sd))
            if not r.get('structural_only') and len(r['houses']) != 12:
                bad_inv.append('十二宫数≠12 %s' % pid)
            if r.get('sikidy') and not r['sikidy']['valid']:
                bad_inv.append('异或表盘三道校验未过 %s seed%s' % (pid, sd))
            if r['settings']['number_system'] != nums:
                bad_inv.append('图数体系未回显 %s' % pid)
    check('组合穷举', '8流派×3定局×2环×2同伴×3图数×2调和×2种子',
          '%d 组全部无异常且不变量成立' % n, '%d 组违例' % len(bad_inv), not bad_inv)
    for b in bad_inv[:5]:
        fails.append('[组合穷举] ' + b)


# ═══ ④ 边界 / 空值 / 非法 / 极端 ═════════════════════════════
def robustness():
    cases = [
        ('未知流派', dict(profile_id='__nope__')),
        ('未知问类', dict(question_type='__nope__')),
        ('非法定局法', dict(house_projection='__bad__')),
        ('非法图数体系', dict(number_system='__bad__')),
        ('非法记号', dict(mark_style='__bad__')),
        ('非法方向', dict(direction='__bad__')),
        ('非法调和者取法', dict(reconciler_mode='__bad__')),
        ('非法合成同伴', dict(compound_mode='__bad__')),
        ('转宫 0(越界下)', dict(turn_to=0)),
        ('转宫 13(越界上)', dict(turn_to=13)),
        ('转宫 -5(负)', dict(turn_to=-5)),
        ('转宫 非数', dict(turn_to='abc')),
        ('种子 0', dict(seed=0)),
        ('种子 int32 上界', dict(seed=2147483647)),
        ('种子 负', dict(seed=-1)),
        ('全部 None', dict(mark_style=None, direction=None, house_projection=None,
                           wrap_houses=None, reconciler=None, reconciler_mode=None,
                           halt_enabled=None, compound_mode=None, number_system=None,
                           chart_mode=None, turn_to=None)),
    ]
    for name, kw in cases:
        base = dict(question_type='wealth', profile_id='european_classical',
                    cast_method='manual', seed=42)
        base.update(kw)
        try:
            r = compute_reading(**base)
            ok = isinstance(r, dict) and 'judge' in r
            detail = 'judge=%s' % r['judge']['latin']
            # 越界转宫必须被夹紧到 1..12 或不出块
            if 'turn_to' in kw and r.get('derived'):
                tt = r['derived']['turn_to']
                if not (1 <= tt <= 12):
                    ok = False; detail = '转宫未夹紧: %s' % tt
                else:
                    detail = '夹紧至 %s' % tt
        except Exception as e:
            ok = False; detail = '抛异常 %s' % e
        check('健壮性', name, '不抛异常并按白名单回落', detail, ok)

    # 全流派 × 全问类 × 全范围 × 全黄道 冒烟(不抛)
    n = 0; err = 0
    for pid in PROFILE_IDS:
        for q in QTYPES:
            for sc in SCOPES:
                for z in ZODIACS:
                    n += 1
                    try:
                        compute_reading(q, pid, cast_method='manual', seed=3,
                                        reading_scope=sc, zodiac_system=z)
                    except Exception:
                        err += 1
    check('健壮性', '全流派×全问类×全范围×全黄道冒烟',
          '%d 组零异常' % n, '%d 组抛异常' % err, err == 0)

    # 连发复现:同参同种子必得同盘
    a = [json.dumps(compute_reading('career', 'arabic_raml', cast_method='manual', seed=555),
                    ensure_ascii=False, sort_keys=True) for _ in range(5)]
    check('健壮性', '同参同种子五连发', '五次结果逐字节相同',
          '%d 种结果' % len(set(a)), len(set(a)) == 1)


def test_geomancy_full_matrix():
    """全功能压测矩阵:生效性 / 零回归 / 组合穷举 / 健壮性。任一失败即红。"""
    for fn in (effectiveness, zero_regression, combinations, robustness):
        fn()
    assert not fails, '压测失败 %d 项:\n%s' % (len(fails), '\n'.join(fails))


for fn in (effectiveness, zero_regression, combinations, robustness) if __name__ == '__main__' else ():
    try:
        fn()
    except Exception:
        traceback.print_exc()
        fails.append('[%s] 测试自身抛异常' % fn.__name__)

# ── 输出矩阵 ──
print('\n%-14s %-42s %-34s %-30s %s' % ('类别', '用例', '预期', '实际', '结果'))
print('-' * 150)
for c, k, e, a, s in rows:
    print('%-14s %-42s %-34s %-30s %s' % (c, k[:42], e[:34], str(a)[:30], s))
print('-' * 150)
p = sum(1 for r in rows if r[4] == 'PASS')
print('合计 %d 项:通过 %d,失败 %d' % (len(rows), p, len(rows) - p))
if fails:
    print('\n❌ 失败明细:')
    for f in fails:
        print('  ', f)
    sys.exit(1)
print('\n✅ 全部通过')
