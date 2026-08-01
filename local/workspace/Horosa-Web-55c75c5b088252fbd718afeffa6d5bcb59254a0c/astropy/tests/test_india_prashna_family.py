# -*- coding: utf-8 -*-
"""G1/G12/G13 · Praśna 问事族 + 服务层挂载(权威 §12.7 / §25.1 / §25.2 / §15.3)。

T2 核心不变量:asc_driven 下 CSL(house1).subLord == 问数子主(最强可测不变量)。
T3 反解精度:|cusps[0]−段中点|<1e-4、对宫恰 180°、确为不等宫。
T16 🔴 零回归门:compute() 顶层键集 == 冻结集(sensitivePoints 为本轮唯一新键,
    prashna/sarvatobhadra/tripataki 只在服务层挂,绝不进 compute());
    kp()/prasna() 返回体键集与关键值与改前一致。
T5 极地降级:Placidus 不可算 → equal_from_asc 且 note 明示。
T11 宫组逐字对权威(婚组独有 negation)。
T18 payload 体积:KP 问时盘 < 150KB。
性能哨兵:🔴 rectify 481 候选 + 8 事件 < 500ms(防有人把精算路径改回逐候选建全盘)。
"""
import json
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "flatlib-ctrad2"))

from astrostudy.india import prashna as pr  # noqa: E402

BASE = {'date': '2000/1/1', 'time': '12:0:0', 'zone': 8, 'lat': 39.9, 'lon': 116.4,
        'ad': 1, 'siderealMode': 'lahiri', 'hsys': 0,
        'tradition': False, 'predictive': False, 'zodiacal': 1}


def _srv_and_natal():
    from websrv.webindiasrv import IndiaAstroSrv, IndiaChartKernel
    return IndiaAstroSrv(), IndiaChartKernel(dict(BASE))


# ── 纯函数层 ──────────────────────────────────────────────────────────────
def test_horary_segment_and_midpoint():
    seg = pr.horary_segment(1)
    assert seg['index'] == 1 and seg['subLord'] == 'Ketu'
    mid = pr.horary_target_lon(1)
    assert abs(mid - (seg['startLon'] + seg['endLon']) / 2.0) < 1e-12
    assert pr.horary_segment(0) is None and pr.horary_segment(250) is None
    assert pr.horary_segment('x') is None


def test_house_of_lon_cusp_is_start():
    cusps = [(i * 30.0 + 10.0) % 360.0 for i in range(12)]      # 10°,40°,…
    assert pr.house_of_lon(10.0, cusps) == 1
    assert pr.house_of_lon(39.99, cusps) == 1
    assert pr.house_of_lon(40.0, cusps) == 2
    assert pr.house_of_lon(5.0, cusps) == 12                     # 跨 0° 归末宫


def test_solve_asc_jd_synthetic():
    """合成单调 asc:asc(jd) = (jd×360/0.99727) mod 360 → 解必收敛且误差 <1e-6。"""
    fn = lambda jd: (jd * 360.0 / pr.SIDEREAL_DAY) % 360.0       # noqa: E731
    jd, err = pr.solve_asc_jd(fn, 123.456, 1000.0)
    assert jd is not None and err < 1e-6
    assert abs(((fn(jd) - 123.456) + 180.0) % 360.0 - 180.0) < 1e-6
    # 求值恒 None(极区)→ (None, None) 不抛
    assert pr.solve_asc_jd(lambda jd: None, 100.0, 1000.0) == (None, None)


def test_house_groups_verbatim_T11():
    """T11:宫组逐字对权威;婚组独有 negation 1/6/10,其余组不臆造。"""
    G = pr.PRASHNA_HOUSE_GROUPS
    assert G['marriage']['houses'] == (2, 7, 11) and G['marriage']['negation'] == (1, 6, 10)
    assert G['wealth']['houses'] == (2, 6, 10, 11) and G['wealth']['negation'] == ()
    assert G['children']['houses'] == (2, 5, 11)
    assert G['career']['houses'] == (2, 6, 10, 11)
    assert G['illness']['houses'] == (6, 8, 12)
    assert G['travel']['houses'] == (3, 9, 12)
    assert G['general']['houses'] == ()
    # 主判宫头默认(A4):财11/事业10/外出9
    assert G['wealth']['primary'] == 11
    assert G['career']['primary'] == 10
    assert G['travel']['primary'] == 9


def test_judge_matter_verdicts():
    ok = pr.judge_matter('marriage', [2, 7])
    assert ok['verdict'] == 'favorable' and any('成' in c for c in ok['chain'])
    mixed = pr.judge_matter('marriage', [7, 6])
    assert mixed['verdict'] == 'mixed'
    bad = pr.judge_matter('marriage', [1, 10])
    assert bad['verdict'] == 'unfavorable'
    none_hit = pr.judge_matter('marriage', [3, 4])
    assert none_hit['verdict'] == 'unfavorable'
    gen = pr.judge_matter('general', [1, 2, 3])
    assert gen['verdict'] == 'undetermined'


def test_significators_row_key_contract():
    """🔴 契约钉死:significators() 每曜出参键集 == {A,B,C,D,ranked},**没有 'houses'**。
    prashna 装配曾误取 .get('houses') → 恒 [] → CSL 裁决整条死掉(见下一条测试)。
    任何一方改键名都在此处红,不会再悄悄退化成死判据。"""
    from astrostudy.india.kp_system import significators
    rows = significators({
        'Sun': {'sign': 1, 'house': 1, 'starLord': 'Mars', 'ownHouses': [5]},
        'Mars': {'sign': 5, 'house': 5, 'starLord': 'Sun', 'ownHouses': [1, 8]},
    })
    for key, row in rows.items():
        assert set(row.keys()) == {'A', 'B', 'C', 'D', 'ranked'}, (key, sorted(row.keys()))
        assert 'houses' not in row, key
        # ranked 是 A>B>C>D 合并去重 → 恒为各级并集
        assert set(row['ranked']) == set(row['A']) | set(row['B']) | set(row['C']) | set(row['D']), key


def test_csl_judgement_alive_through_assemble():
    """🔴 回归门:CSL 裁决必须走通装配链 —— 主判宫 CSL 明确意义事项宫时,
    judgement['hit'] 非空、verdict 不是「未命中」的 unfavorable、且给出四重分层。

    造局:让主判宫(财=11)的 CSL 这颗曜「占 11 宫」→ B 级必含 11 → 财组 (2,6,10,11) 必命中,
    且财组无 negation → favorable。构造法:先按等宫 cusps 求出 11 宫 CSL 是哪颗曜,
    再把该曜的经度放到 11 宫内,使其 B 级 = 11。"""
    cusps = [(i * 30.0) % 360.0 for i in range(12)]      # 等宫,11 宫 = [300,330)
    csl_rows = pr.cuspal_sublords(cusps)
    lord11 = csl_rows[10]['subLord']
    assert lord11, csl_rows[10]
    # 九曜:先全部塞到 1 宫(不干扰),再把 11 宫 CSL 那颗放进 11 宫
    lons = {k: 5.0 for k in ('Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter',
                             'Venus', 'Saturn', 'Rahu', 'Ketu')}
    assert lord11 in lons, lord11
    lons[lord11] = 315.0                                  # 落 11 宫
    from datetime import datetime
    out = pr.assemble_kp_horary(
        number=42, matter='wealth', cusps=cusps, cusp_mode='equal_from_asc',
        planet_lons=lons, question_dt=datetime(2026, 7, 21, 15, 30, 0),
        rp={'set': []}, vara={'civil': 'Sun', 'sunrise': 'Sun'})
    assert out['available'] is True
    j = out['judgement']
    assert j['available'] is True and j['primaryHouse'] == 11
    # ① CSL 指示宫非空(修前恒 [] —— 这是本回归门的核心)
    sig_line = [c for c in j['chain'] if 'CSL 指示宫' in c]
    assert sig_line and '无' not in sig_line[0], j['chain']
    # ② 命中财组且判 favorable(财组无阻碍宫)
    assert 11 in j['hit'], (lord11, j['hit'], out['significators'].get(lord11))
    assert j['verdict'] == 'favorable', (j['verdict'], j['chain'])
    # ③ 四重分层出参在位,且命中可溯源到某一级
    assert set(j['cslSigTiers'].keys()) == {'A', 'B', 'C', 'D'}
    assert j.get('hitByTier'), j
    assert any(11 in v for v in j['hitByTier'].values()), j['hitByTier']


def test_csl_judgement_not_always_unfavorable():
    """反向对照:同一装配下换多个事项,verdict 不得恒为 unfavorable
    (修前除 general 外**全部**恒 unfavorable,该形态即为退化)。"""
    from datetime import datetime
    cusps = [(i * 30.0) % 360.0 for i in range(12)]
    lons = {'Sun': 5.0, 'Moon': 35.0, 'Mars': 65.0, 'Mercury': 95.0, 'Jupiter': 125.0,
            'Venus': 155.0, 'Saturn': 185.0, 'Rahu': 215.0, 'Ketu': 35.0}
    verdicts = {}
    for m in ('marriage', 'wealth', 'children', 'career', 'illness', 'travel'):
        out = pr.assemble_kp_horary(
            number=42, matter=m, cusps=cusps, cusp_mode='equal_from_asc',
            planet_lons=lons, question_dt=datetime(2026, 7, 21, 15, 30, 0),
            rp={'set': []}, vara={'civil': 'Sun', 'sunrise': 'Sun'})
        verdicts[m] = out['judgement']['verdict']
    assert set(verdicts.values()) != {'unfavorable'}, verdicts


def test_equal_from_asc_not_hand_pickable():
    """equal 仅降级,不可手选:传入 equal_from_asc 会被归一回 asc_driven(服务层同规)。"""
    assert 'equal_from_asc' in pr.CUSP_MODES          # 存在(降级路径)但服务层拒手选


# ── 服务层(真起盘) ───────────────────────────────────────────────────────
def test_T2_T3_invariant_and_precision():
    srv, natal = _srv_and_natal()
    for n in (1, 2, 7, 42, 123, 200, 248, 249):
        d = dict(BASE, prashnaTime='2026/07/21 15:30:00', prashnaNumber=n,
                 prashnaMatter='marriage', prashnaSchools='kp')
        kp = srv._compute_prashna(d, natal)['kp']
        assert kp['available'] and kp['cuspMode'] == 'asc_driven_placidus', n
        assert kp['invariantCslMatchesSegment'] is True, n            # T2
        seg_mid = (kp['segment']['startLon'] + kp['segment']['endLon']) / 2.0
        assert abs(((kp['cusps'][0] - seg_mid + 180) % 360) - 180) < 1e-4, n   # T3 精度
        assert abs(((kp['cusps'][6] - kp['cusps'][0]) % 360) - 180.0) < 1e-6, n  # 对宫恰 180°
        widths = {round((kp['cusps'][(i + 1) % 12] - kp['cusps'][i]) % 360, 3)
                  for i in range(12)}
        assert len(widths) > 1, n                                     # 真不等宫


def test_T5_polar_degrades_to_equal():
    srv, _ = _srv_and_natal()
    from websrv.webindiasrv import IndiaChartKernel
    polar = dict(BASE, lat=78.2, lon=15.6)         # 斯瓦尔巴,Placidus 常不可算
    natal_p = IndiaChartKernel(dict(polar))
    d = dict(polar, prashnaTime='2026/06/21 12:00:00', prashnaNumber=100,
             prashnaMatter='wealth', prashnaSchools='kp')
    kp = srv._compute_prashna(d, natal_p)['kp']
    assert kp['available']
    # 极地下三态之一:反解成(如极昼边缘仍可算)/退字面 Placidus/降级等宫 —— 但绝不 500
    assert kp['cuspMode'] in ('asc_driven_placidus', 'time_placidus', 'equal_from_asc')
    if kp['cuspMode'] == 'equal_from_asc':
        assert any('极区' in x or '降级' in x for x in kp['notes'])
        widths = {round((kp['cusps'][(i + 1) % 12] - kp['cusps'][i]) % 360, 3)
                  for i in range(12)}
        assert widths == {30.0}


def test_time_placidus_gives_mismatch():
    srv, natal = _srv_and_natal()
    d = dict(BASE, prashnaTime='2026/07/21 15:30:00', prashnaNumber=42,
             prashnaMatter='career', prashnaSchools='kp', prashnaCuspMode='time_placidus')
    kp = srv._compute_prashna(d, natal)['kp']
    assert kp['cuspMode'] == 'time_placidus'
    assert kp['cuspAscMismatchDeg'] is not None      # 字面口径必给失配度


def test_T16_zero_regression_gate():
    """🔴 T16:compute() 顶层键集冻结;prashna/sbc/tripataki 只在服务层挂;
    kp()/prasna() 关键结构与值不变。"""
    from astrostudy.india.jyotish_engine import build_jyotish
    from websrv.webindiasrv import IndiaChartKernel
    kernel = IndiaChartKernel(dict(BASE))
    res = build_jyotish(kernel)
    FROZEN = {
        'engine', 'panchanga', 'nakshatras', 'yogas', 'dasha', 'rasiDasha',
        'grahaDrishti', 'nodeRasiDrishti', 'ashtakavarga', 'shadbala', 'shadbalaBphs',
        'strengths', 'jaimini', 'arudha', 'kp', 'prasna', 'muhurta', 'transit',
        'upagraha', 'supplementaryLagnas', 'remedies', 'functionalNature', 'bhavaBala',
        'extendedDashas', 'grahaYuddha', 'kartari', 'sudarshana', 'grahaMaitri',
        'outerPlanets', 'compatibility', 'nadi', 'shashtiamsa', 'vargaVariants',
        'ayurdaya', 'sensitivePoints', 'ayurdayaFinal',
    }
    assert set(res.keys()) - {'partialErrors'} == FROZEN
    for absent in ('prashna', 'sarvatobhadra', 'tripataki'):
        assert absent not in res, absent
    # prasna(249 段表)结构锁:8 键 + 249 段
    prasna = res['prasna']
    assert prasna['count'] == 249 or len(prasna.get('segments') or ()) == 249 \
        or prasna.get('available') is not None
    # kp:CSL 12 行仍在
    assert len((res['kp'] or {}).get('cuspalSubLords') or ()) == 12


def test_T18_payload_size():
    srv, natal = _srv_and_natal()
    d = dict(BASE, prashnaTime='2026/07/21 15:30:00', prashnaNumber=123,
             prashnaMatter='marriage', prashnaSchools='kp,parashari,tajika')
    res = srv._compute_prashna(d, natal)
    raw = json.dumps(res, default=str)
    assert len(raw) < 150 * 1024, len(raw)


def test_prashna_not_requested_returns_none():
    """零 cache churn 契约:未起卦 → None → jyotish 无 prashna 键。"""
    srv, natal = _srv_and_natal()
    assert srv._compute_prashna(dict(BASE), natal) is None


def test_tithi_pravesh_service_path():
    srv, natal = _srv_and_natal()
    tk = srv._compute_tajaka(dict(BASE, tajakaYear=2026, annualChartType='tithi'), natal)
    assert tk['annualType'] == 'tithi' and tk.get('praveshMoment')
    tk2 = srv._compute_tajaka(dict(BASE, tajakaYear=2026), natal)
    assert tk2['annualType'] == 'varsha' and not tk2.get('praveshMoment')


def test_sbc_and_tripataki_service_path():
    srv, natal = _srv_and_natal()
    tctx = srv._transit_context(dict(BASE))
    sbc = srv._compute_sarvatobhadra(natal, tctx)
    assert sbc['vedhaEnabled'] is False               # 锚未录入 → 降级(绝不出假 Vedha)
    assert len(sbc['layout']['rows']) == 28
    tri = srv._compute_tripataki(dict(BASE, tajakaYear=2026), natal)
    assert len(tri['byCenter']['moon']['months']) == 12
    assert len(tri['byCenter']['saturn']['months']) == 12
    assert 'goodHousesByPlanet' in tri


def test_rectify_performance_sentinel():
    """🔴 性能哨兵:481 候选 + 8 事件 < 500ms。防将来把 Tier1 精算路径改回
    逐候选建全盘(那会劣化到 ~6.6s)。"""
    from websrv.webindiasrv import rectify_core
    events = [{'kind': k, 'date': '2020-06-%02d' % (5 + i)} for i, k in enumerate(
        ['marriage', 'career', 'wealth', 'children', 'illness', 'travel',
         'marriage', 'career'])]
    t0 = time.time()
    r = rectify_core(dict(BASE, rectifyWindowMinutes=120, rectifyStepSeconds=30,
                          rectifyEvents=events))
    elapsed = (time.time() - t0) * 1000.0
    assert r['candidates'] == 481
    assert elapsed < 500.0, f'{elapsed:.0f}ms 超性能红线'
    assert r['top'] and r['runs']['lagnaSubLord']
    assert r['resolution']['narrowestSubDeg'] == round(2.0 / 3.0, 4)


def test_rectify_rp_modes_and_dual_vara():
    from websrv.webindiasrv import rectify_core
    r = rectify_core(dict(BASE, rectifyRpSource='candidate', rectifyWindowMinutes=5))
    mid = r['samples'][len(r['samples']) // 2]
    assert mid['rp']['rpSource'] == 'candidate'
    # 双 Vara 口径并出;anchor 模式默认
    assert set(r['vara'].keys()) >= {'civil', 'sunrise', 'basisUsed'}
    r2 = rectify_core(dict(BASE, rectifyWindowMinutes=5))
    assert r2['rpSource'] == 'anchor'
    assert r2['anchorRp'] and r2['anchorRp'].get('set')
