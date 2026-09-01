# -*- coding: utf-8 -*-
"""[Z7] 七政择日扫描引擎金标。锚=2026-01-01 12:30 北京(日在丑宫斗宿——首跑天文自证:
1 月初太阳黄经 ~280°=摩羯段=GONG_SEQ[9] 丑;判别纪律(定案19):su28Mode 2/3 换档
(活体距星 vs 开禧+ayanamsha)在界近曜上判定确不同;nodeType 平/真罗计位差实证。
🔴 尾部「全链同口径判别锚」四测=审查实抓四病防回潮(罗计互换/紫炁 OSCU_APOG 错点/
宿界线性表≠主页/化曜慢步漏窗)——引擎自比对对跨层契约 bug 零判别力,必须锚主页真源。
运行: PYTHONPATH=Horosa-Web/astropy python3 -m pytest Horosa-Web/astropy/tests/test_qizheng_election_scan.py -q
"""
import pytest

from astrostudy.qizheng_election_scan import (
    scan, explain_at, QizhengScanContext, CONDITION_TYPES, _EVALUATORS, GONG_SEQ,
)
from astrostudy.election_scan import _jd_from
from astrostudy import guolao_const as gc

GEO = {'gpsLat': 39.9, 'gpsLon': 116.46, 'zone': '+08:00'}


def _ctx(extra=None):
    d = dict(GEO)
    if extra:
        d.update(extra)
    return QizhengScanContext(d)


def _jd(t):
    d, hm = t.split(' ')
    return _jd_from(d, hm + ':00', '+08:00', 1)


JD_ANCHOR = None


def setup_module(_m):
    global JD_ANCHOR
    JD_ANCHOR = _jd('2026-01-01 12:30')


def test_registry_contract():
    assert set(CONDITION_TYPES.keys()) == set(_EVALUATORS.keys())
    assert len(CONDITION_TYPES) >= 10


def test_anchor_positions():
    m = _ctx().moment(JD_ANCHOR)
    assert m.gong('日') == '丑'
    assert m.xiu('日') == '斗'
    assert m.gong('土') == '亥'
    # 罗计恒对宫
    assert abs((m.lon('罗睺') - m.lon('计都')) % 360.0 - 180.0) < 1e-9


def test_dignity_leaf_pos_neg():
    ctx = _ctx()
    dom = (JD_ANCHOR - 0.01, JD_ANCHOR + 0.01)
    # 土在亥=平(表列 idx11);判「平」真、「庙旺」假
    ivs = _EVALUATORS['dignity']({'body': '土', 'values': ['平']}, ctx, dom)
    assert any(s <= JD_ANCHOR <= e for s, e in ivs)
    ivs2 = _EVALUATORS['dignity']({'body': '土', 'values': ['庙', '旺']}, ctx, dom)
    assert not any(s <= JD_ANCHOR <= e for s, e in ivs2)


def test_su28_mode_discriminates():
    """判别时刻三层断言:两档各自值对+界近曜确不同(su28Mode 2 vs 3 宿界差 ~4.4°+岁差)。"""
    c2 = _ctx({'su28Mode': 2})
    c3 = _ctx({'su28Mode': 3})
    # 找一个界近曜:扫锚日 11 曜,取两档宿名不同者(必存在:界差 4.4°+岁差,28 宿平均 12.8° 宽)
    m2 = c2.moment(JD_ANCHOR)
    m3 = c3.moment(JD_ANCHOR)
    diff = [b for b in ['日', '月', '金', '木', '水', '火', '土', '罗睺', '计都', '月孛', '紫炁']
            if m2.xiu(b) != m3.xiu(b)]
    assert diff, 'su28Mode 两档在锚日 11 曜上无一宿名差=零判别(应至少一曜跨界)'
    b = diff[0]
    assert m2.xiu(b) in gc.SU28 and m3.xiu(b) in gc.SU28
    # 不支持档必拒
    with pytest.raises(ValueError):
        _ctx({'su28Mode': 5})


def test_node_type_discriminates():
    lon_mean = _ctx({'nodeType': 'mean'}).moment(JD_ANCHOR).lon('计都')
    lon_true = _ctx({'nodeType': 'true'}).moment(JD_ANCHOR).lon('计都')
    assert abs(lon_mean - lon_true) > 0.01


def test_scan_interval_matches_pointwise():
    """一日窗恒等:扫描区间覆盖 ≡ 独立逐 30 分钟真值(月在宫谓词)。"""
    data = dict(GEO)
    data.update({'startDate': '2026-01-01', 'startTime': '00:00:00',
                 'endDate': '2026-01-01', 'endTime': '23:59:59',
                 'conditions': {'type': 'body_in_gong', 'params': {'body': '月', 'values': ['午']}}})
    r = scan(data)
    assert 'err' not in r
    ivs = [(iv['start'], iv['end']) for iv in r['intervals']]
    ctx = _ctx()
    jd0 = _jd('2026-01-01 00:00')
    mism = 0
    hits = 0
    for k in range(48):
        jd = jd0 + k * (30.0 / 1440.0)
        truth = ctx.moment(jd).gong('月') == '午'
        if truth:
            hits += 1
        rec_in = False
        for s, e in ivs:
            if s <= _fmt(jd) <= e:
                rec_in = True
                break
        if truth != rec_in:
            mism += 1
    assert mism == 0
    # 树有判别力自证(该日月过午宫与否——不强制真,但恒真/恒假都要能解释)
    assert hits < 48


def _fmt(jd):
    from astrostudy.election_scan import date_time_from_jd
    return date_time_from_jd(jd, '+08:00')['datetime'][:16]


def test_explain_same_source():
    e = explain_at(dict(GEO, t='2026-01-01 12:30', conditions={
        'type': 'all', 'conditions': [
            {'type': 'body_in_gong', 'params': {'body': '日', 'values': ['丑']}},
            {'type': 'combust', 'params': {'body': '水', 'mode': 'free'}},
        ]}))
    assert 'err' not in e
    tree = e['tree']
    assert tree['kind'] == 'group'
    leaf0 = tree['children'][0]
    assert leaf0['pass'] is True
    assert '丑宫' in leaf0['actual']


def test_guard_and_span():
    bad = scan(dict(GEO, startDate='2026-01-01', endDate='2027-01-01',
                    conditions={'type': 'day_night', 'params': {}}))
    assert bad.get('err') == 'span_too_large'
    bad2 = scan(dict(GEO, startDate='2026-01-01', endDate='2026-01-02',
                     conditions={'type': 'nope', 'params': {}}))
    assert bad2.get('err') == 'invalid_conditions'


# ── 全链同口径判别锚(2026-08-29 审查实抓四病防回潮) ──

def test_rahu_is_ascending_node_mainline():
    """罗睺=升交点直取(Java QizhengMoiraRuleService「North Node→罗」全链同口径);
    曾互换(计都吃 node、罗睺+180°)——直锚 swisseph 升交点黄经,非自比对宫。"""
    import swisseph
    res, _f = swisseph.calc_ut(JD_ANCHOR, swisseph.MEAN_NODE, swisseph.FLG_SWIEPH)
    node_lon = res[0] % 360.0
    m = _ctx().moment(JD_ANCHOR)
    assert abs(m.lon('罗睺') - node_lon) < 1e-9
    # horosa_circular_delta_assert_v1(Windows 侧测试修;建议上游化):对冲断言必须用圆距,
    # 裸 (Δ-180)%360 在精确对冲时随 libm 尾差落 0+ε 或 360-ε 两侧 —— Windows 实测
    # 359.99999999999994(=360-6e-14,产品值正确、断言模界脆断;alcabitius 同族平台尾差)。
    _ketu_delta = (m.lon('计都') - node_lon - 180.0) % 360.0
    assert min(_ketu_delta, 360.0 - _ketu_delta) < 1e-9


def test_ziqi_is_purple_cloud_28y():
    """紫炁=28 年平行度(flatlib ephem/tools.py pcLon 同式,主页盘唯一口径);
    曾错用 OSCU_APOG(与主页差 ~99°,lilithType=true 时紫炁≡月孛恒同宫)。"""
    expect = (188.6849 + 360.0 * (JD_ANCHOR - 2451543.5) / 10226.78132) % 360.0
    m = _ctx().moment(JD_ANCHOR)
    assert abs(m.lon('紫炁') - expect) < 1e-9
    mt = _ctx({'lilithType': 'true'}).moment(JD_ANCHOR)
    assert abs(mt.lon('紫炁') - mt.lon('月孛')) > 1.0


def test_su28_bounds_same_source_as_perchart():
    """mode2 宿界=perchart._moira_distar_lons 活体距星黄经逐值同源;mode3=开禧基值
    +活 ayanamsha(非冻结)。曾用 guolao_const 线性表(界差最大 2.18°/mode3 整表错位
    3.7°):判别点=月 λ130.64° 主页判鬼、线性表误判柳。"""
    from astrostudy.perchart import (
        MOIRA_KAIXI_STELLAR_DEGREES, MOIRA_STELLAR_ORDER, _moira_ayanamsha, _moira_distar_lons,
    )
    c2 = _ctx({'su28Mode': 2})
    lon_by_name = _moira_distar_lons(JD_ANCHOR)
    for b, n in c2.xiu_bounds(JD_ANCHOR):
        assert abs(b - lon_by_name[n] % 360.0) < 1e-9
    jd2 = _jd('2026-01-05 15:30')
    assert c2.xiu_of(jd2, 130.64) == '鬼'
    c3 = _ctx({'su28Mode': 3})
    ayan = _moira_ayanamsha(JD_ANCHOR)
    expect3 = sorted(((MOIRA_KAIXI_STELLAR_DEGREES[i] + ayan) % 360.0, MOIRA_STELLAR_ORDER[i])
                     for i in range(28))
    assert c3.xiu_bounds(JD_ANCHOR) == expect3


def test_hua_lu_moon_short_window():
    """己年化禄=太阴:月过觜(1° 宿,真窗 ~2h)必须抓到(曾 6h 慢步整窗漏检)。"""
    r = scan(dict(GEO, startDate='2049-03-11', endDate='2049-03-13',
                  conditions={'type': 'hua_lu', 'params': {'where': 'xiu', 'values': ['觜']}}))
    ivs = r.get('intervals') or []
    assert ivs and ivs[0]['start'].startswith('2049-03-12 01')


def test_bc_era_minute_not_truncated():
    """BC 5 位天文年('-1043-…')输出剁秒必须 rsplit(曾 [:16] 截掉分钟个位)。"""
    import re
    r = scan(dict(GEO, ad=-1, startDate='1044-06-01', endDate='1044-06-02',
                  conditions={'type': 'body_in_gong',
                              'params': {'body': '木', 'values': list('子丑寅卯辰巳午未申酉戌亥')}}))
    ivs = r.get('intervals') or []
    assert ivs
    assert ivs[0]['start'].startswith('-1043-')
    assert re.search(r'\d{2}:\d{2}$', ivs[0]['start'])

def test_w7_dignity_seven_and_speed_gears():
    """[W7 全谱轮] 七态表函数正反(垣乐/空支/喜)+迟速档谓词接线(evaluator 在注册表)。"""
    assert gc.qizheng_sign_statuses('月', '未') == ['垣', '乐']
    assert gc.qizheng_sign_statuses('月', '子') == []
    assert gc.qizheng_sign_statuses('孛', '亥') == ['喜']
    assert 'dignity_seven' in CONDITION_TYPES and 'dignity_seven' in _EVALUATORS
    # 迟速谱=js STAR_SPEED_SPEC 镜像逐值(注:木/土 stat>slow 本就合法——留判优先于迟速,非单调关系)
    assert gc.QIZHENG_SPEED_SPEC == {
        '金': {'stat': 0.15, 'slow': 0.71, 'fast': 1.245},
        '木': {'stat': 0.07, 'slow': 0.05, 'fast': 0.23},
        '水': {'stat': 0.10, 'slow': 0.88, 'fast': 1.50},
        '火': {'stat': 0.20, 'slow': 0.40, 'fast': 0.70},
        '土': {'stat': 0.05, 'slow': 0.02, 'fast': 0.13},
    }
    # 扫描面实弹:月七态(垣)在锚窗至少产出区间良构(不断言具体命中,恒等由 stress 盖)
    ivs = _EVALUATORS['dignity_seven']({'body': '月', 'values': ['垣']}, _ctx(), (JD_ANCHOR, JD_ANCHOR + 2.0))
    for a, b in ivs:
        assert a < b

