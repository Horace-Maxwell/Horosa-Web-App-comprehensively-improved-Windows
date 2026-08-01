# -*- coding: utf-8 -*-
"""宫力 Bhava Bala 结构与不变量测试。

覆盖(可断言项)：
- 十二宫齐全(1-12)，字段完备。
- 四分量(宫主力/宫方位力/宫受视力/居宫星力)各非负。
- 总虚拉 = 四分量之和(内部自洽)。
- Rupas = 总虚拉 ÷ 60。
- 名次 rank 为 1..12 的双射，且与总虚拉降序一致。
- 宫方位力按宫起点星座类别给档(0–60)。
- 宫受视力复用六力分段虚拉式；含符号原值与「净受凶相位计 0」规则一致。
- 入参降级：缺六力 / 缺经度 / 缺宫主与上升 时不崩，按 pending 或不可用优雅退化。
- 整宫制宫中点近似 cusp 时标 pending；显式传 cusp 时按之算。
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'flatlib-ctrad2'))

from flatlib import const  # noqa: E402
from astrostudy.india import bhava_bala as bb  # noqa: E402


# ── 示例数据(中性虚构，仅供结构断言)──────────────────────────────────────
def _sample_shadbala():
    return {
        const.SUN: {'totalVirupa': 410.0},
        const.MOON: {'totalVirupa': 435.0},
        const.MARS: {'totalVirupa': 300.0},
        const.MERCURY: {'totalVirupa': 497.0},
        const.JUPITER: {'totalVirupa': 490.0},
        const.VENUS: {'totalVirupa': 405.0},
        const.SATURN: {'totalVirupa': 422.0},
    }


def _sample_lons():
    return {
        const.SUN: 340.0, const.MOON: 261.8, const.MARS: 350.0,
        const.MERCURY: 330.0, const.JUPITER: 8.88,
        const.VENUS: 291.15, const.SATURN: 18.58,
    }


def _sample_signs():
    return {
        const.SUN: const.PISCES, const.MOON: const.SAGITTARIUS,
        const.MARS: const.PISCES, const.MERCURY: const.PISCES,
        const.JUPITER: const.ARIES, const.VENUS: const.AQUARIUS,
        const.SATURN: const.ARIES,
    }


def _full():
    return bb.bhava_bala(
        lagna_sign=const.AQUARIUS,
        planet_shadbala=_sample_shadbala(),
        planet_lons=_sample_lons(),
        planet_signs=_sample_signs(),
    )


_FIELDS = (
    'house', 'sign', 'lord', 'bhavadhipatiBala', 'bhavaDigBala',
    'bhavaDrishtiBala', 'occupantBala', 'totalVirupa', 'rupas', 'rank',
)


# ── 十二宫齐全 + 字段完备 ───────────────────────────────────────────────
def test_twelve_houses_present_and_fields():
    r = _full()
    assert r['available'] is True
    houses = r['houses']
    assert len(houses) == 12
    assert [h['house'] for h in houses] == list(range(1, 13))
    for h in houses:
        for f in _FIELDS:
            assert f in h, (h['house'], f)


# ── 四分量各非负 ────────────────────────────────────────────────────────
def test_components_non_negative():
    r = _full()
    for h in r['houses']:
        assert h['bhavadhipatiBala'] >= 0.0, h['house']
        assert h['bhavaDigBala'] >= 0.0, h['house']
        assert h['bhavaDrishtiBala'] >= 0.0, h['house']
        assert h['occupantBala'] >= 0.0, h['house']
        assert h['totalVirupa'] >= 0.0, h['house']


# ── 总 = 四分量之和(内部自洽)──────────────────────────────────────────
def test_total_equals_sum_of_components():
    r = _full()
    for h in r['houses']:
        s = round(h['bhavadhipatiBala'] + h['bhavaDigBala']
                  + h['bhavaDrishtiBala'] + h['occupantBala'], 4)
        assert s == h['totalVirupa'], (h['house'], s, h['totalVirupa'])


# ── Rupas = 总 ÷ 60 ────────────────────────────────────────────────────
def test_rupas_is_total_over_60():
    r = _full()
    for h in r['houses']:
        assert abs(h['rupas'] - h['totalVirupa'] / 60.0) < 1e-4, h['house']


# ── 名次 rank 是 1..12 的双射，且与总虚拉降序一致 ─────────────────────────
def test_rank_consistent():
    r = _full()
    houses = r['houses']
    ranks = sorted(h['rank'] for h in houses)
    assert ranks == list(range(1, 13))
    # 按 rank 升序排，对应 totalVirupa 应单调不增。
    by_rank = sorted(houses, key=lambda h: h['rank'])
    totals = [h['totalVirupa'] for h in by_rank]
    assert all(totals[i] >= totals[i + 1] for i in range(len(totals) - 1)), totals
    # 最强/最弱与 rank 端点一致。
    assert by_rank[0]['house'] == r['strongest']
    assert by_rank[-1]['house'] == r['weakest']


# ── 宫主力 = 该宫宫主的 totalVirupa ─────────────────────────────────────
def test_bhavadhipati_is_lord_total_shadbala():
    sb = _sample_shadbala()
    r = _full()
    for h in r['houses']:
        lord = h['lord']
        expected = sb.get(lord, {}).get('totalVirupa', 0.0)
        assert abs(h['bhavadhipatiBala'] - expected) < 1e-4, (h['house'], lord)
    # 上升水瓶 → 第1宫主土星(422)、第2宫主木星(490)…
    assert r['houses'][0]['lord'] == const.SATURN
    assert abs(r['houses'][0]['bhavadhipatiBala'] - 422.0) < 1e-4


# ── 宫方位力按宫起点星座类别给档(0–60)─────────────────────────────────
def test_bhava_dig_bala_range_and_table():
    r = _full()
    for h in r['houses']:
        assert 0.0 <= h['bhavaDigBala'] <= 60.0, h['house']
    # 通行口径:类别满力宫(人1/四足10/水栖4/虫7)满 60,对宫 0,环距线性。
    # 🔴 旧断言锁的是「按星座查定值、与宫位无关」的退化实现,已按正口径改锁。
    assert bb.bhava_dig_bala_for_sign(const.GEMINI, 1) == 60.0    # 人类座在 1 宫满
    assert bb.bhava_dig_bala_for_sign(const.GEMINI, 7) == 0.0     # 对宫 0
    assert bb.bhava_dig_bala_for_sign(const.ARIES, 10) == 60.0    # 四足座在 10 宫满
    assert bb.bhava_dig_bala_for_sign(const.ARIES, 4) == 0.0
    assert bb.bhava_dig_bala_for_sign(const.CANCER, 4) == 60.0    # 水栖座在 4 宫满
    assert bb.bhava_dig_bala_for_sign(const.SCORPIO, 7) == 60.0   # 虫座在 7 宫满
    assert bb.bhava_dig_bala_for_sign(const.GEMINI, 4) == 30.0    # 环距 3 → 半力


# ── 宫受视力：含符号原值 + 「净受凶相位计 0」规则 ────────────────────────
def test_bhava_drishti_sign_and_clamp():
    r = _full()
    for h in r['houses']:
        raw = h['bhavaDrishtiRaw']
        rep = h['bhavaDrishtiBala']
        # 报告值 = max(0, 原值)。
        assert abs(rep - max(0.0, raw)) < 1e-4, (h['house'], raw, rep)
    # 至少存在一个净受凶相位的宫(原值 < 0、报告值 = 0)，验证 clamp 生效。
    assert any(h['bhavaDrishtiRaw'] < 0.0 and h['bhavaDrishtiBala'] == 0.0
               for h in r['houses'])


def test_bhava_drishti_reuses_segmented_formula():
    """宫受视力须与六力模块 sphuta_drishti 分段虚拉式一致(同一真值源)。"""
    from astrostudy.india import shadbala_bphs as sb
    lons = _sample_lons()
    # 第1宫(水瓶)宫中点 = 水瓶起点 + 15° = 300 + 15 = 315°。
    cusp = 315.0
    expect = 0.0
    for p, lon in lons.items():
        a = (cusp - lon) % 360.0
        d = sb.sphuta_drishti(p, a)
        expect += (1.0 if p in bb.NATURAL_BENEFIC else -1.0) * d
    expect = expect / 4.0
    r = _full()
    assert abs(r['houses'][0]['bhavaDrishtiRaw'] - round(expect, 4)) < 1e-3


# ── 居宫星力 = 落该宫各曜总六力之和 ─────────────────────────────────────
def test_occupant_bala():
    sb = _sample_shadbala()
    r = _full()
    for h in r['houses']:
        exp = sum(sb.get(p, {}).get('totalVirupa', 0.0) for p in h['occupants'])
        assert abs(h['occupantBala'] - exp) < 1e-4, h['house']
    # 上升水瓶 → 金星(水瓶)落第1宫，居宫力含金星 405。
    h1 = r['houses'][0]
    assert const.VENUS in h1['occupants']
    assert abs(h1['occupantBala'] - 405.0) < 1e-4


# ── cusp 模式：默认整宫中点 → pending；显式 cusp → provided ───────────────
def test_cusp_mode_whole_sign_pending():
    r = _full()
    assert r['cuspMode'] == 'wholeSignMid'
    assert r['anyPending'] is True
    assert all(h['pending']['drishti'] for h in r['houses'])


def test_cusp_mode_provided():
    hc = {h: ((h - 1) * 30.0 + 15.0) for h in range(1, 13)}
    r = bb.bhava_bala(
        lagna_sign=const.AQUARIUS,
        planet_shadbala=_sample_shadbala(),
        planet_lons=_sample_lons(),
        planet_signs=_sample_signs(),
        house_cusps=hc,
    )
    assert r['cuspMode'] == 'provided'


# ── 显式 house_lords / house_occupancy 入参亦可用 ───────────────────────
def test_explicit_lords_and_occupancy():
    hl, _ = bb._derive_house_lords(const.AQUARIUS)
    occ = bb._derive_occupancy(_sample_signs(), const.AQUARIUS)
    r = bb.bhava_bala(
        house_lords=hl, house_occupancy=occ,
        planet_shadbala=_sample_shadbala(),
        planet_lons=_sample_lons(),
        lagna_sign=const.AQUARIUS,
    )
    assert r['available'] is True
    assert len(r['houses']) == 12
    assert const.VENUS in r['houses'][0]['occupants']


# ── 降级：缺六力 → 宫主力/居宫力计 0，仍出 12 宫 ─────────────────────────
def test_degrade_missing_shadbala():
    r = bb.bhava_bala(lagna_sign=const.ARIES)
    assert r['available'] is True
    assert len(r['houses']) == 12
    for h in r['houses']:
        assert h['bhavadhipatiBala'] == 0.0
        assert h['occupantBala'] == 0.0
        # 仍有方位力(由星座类别给)。
        assert h['bhavaDigBala'] >= 0.0
        assert h['pending']['bhavadhipati'] is True
    assert r['anyPending'] is True


# ── 降级：缺经度 → 受视计 0 且 pending ──────────────────────────────────
def test_degrade_missing_lons():
    r = bb.bhava_bala(
        lagna_sign=const.ARIES,
        planet_shadbala=_sample_shadbala(),
        planet_signs=_sample_signs(),
    )
    assert r['available'] is True
    for h in r['houses']:
        assert h['bhavaDrishtiBala'] == 0.0
        assert h['pending']['drishti'] is True


# ── 降级：缺宫主与上升 → 不可用(不崩)────────────────────────────────────
def test_degrade_no_lords_no_lagna():
    r = bb.bhava_bala(planet_shadbala=_sample_shadbala())
    assert r['available'] is False
    assert r['houses'] == []


# ── 整体光滑：任意只读不抛 ───────────────────────────────────────────────
def test_full_pipeline_smoke():
    r = _full()
    assert isinstance(r['note'], str) and r['note']
    assert r['strongest'] in range(1, 13)
    assert r['weakest'] in range(1, 13)
