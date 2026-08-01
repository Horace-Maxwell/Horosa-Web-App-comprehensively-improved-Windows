# -*- coding: utf-8 -*-
"""印占·大运流派开关(21 键)守卫。

T1 🔴 默认字节零回归:variants 全默认 == 不传 variants(输出 JSON 逐字节一致)。
T2 规格完整性:21 键、每键默认 ∈ 取值域、resolve 容错。
T3 逐键切换不炸:每键每非默认值,compute() 全量成功且顶层键集不变。
T4 强开关有差:已实证影响面的开关,切换后对应子块确实变化。
"""
import json

import pytest

from astrostudy.india.india_chart_kernel import IndiaChartKernel
from astrostudy.india.jyotish_engine import JyotishEngine
from astrostudy.india.dasha_variants import (
    VARIANT_SPECS, DEFAULT_VARIANTS, resolve_variants, is_default_variants,
)

DATA = {'date': '1990/3/15', 'time': '07:30:00', 'zone': '+05:30',
        'lat': '28n36', 'lon': '77e12', 'indiaHsys': 0, 'indiaAyanamsa': 'lahiri'}


def _compute(variants=None):
    return JyotishEngine(IndiaChartKernel(DATA), dasha_variants=variants).compute()


def test_default_variants_byte_identical():
    a = json.dumps(_compute(None), sort_keys=True, ensure_ascii=False, default=str)
    b = json.dumps(_compute(dict(DEFAULT_VARIANTS)), sort_keys=True, ensure_ascii=False, default=str)
    assert a == b


def test_spec_integrity_and_tolerant_resolve():
    # 22 = 21 原键 + vedhaBlockers(过运 Vedha 遮蔽者;罗计计入/除名,默认 all=零回归)
    assert len(VARIANT_SPECS) == 22
    for k, spec in VARIANT_SPECS.items():
        assert spec['default'] in spec['values'], k
        assert spec['values'][0] == spec['default'], (k, '首值须为默认')
    assert resolve_variants('not-json') == DEFAULT_VARIANTS
    assert resolve_variants({'charaDirection': 'bogus'})['charaDirection'] == 'lagna_parity_sign'
    assert is_default_variants(resolve_variants(None))


@pytest.mark.parametrize('key', sorted(VARIANT_SPECS.keys()))
def test_each_switch_value_no_crash(key):
    base_keys = set(_compute(None).keys())
    for val in VARIANT_SPECS[key]['values']:
        if val == VARIANT_SPECS[key]['default']:
            continue
        res = _compute({key: val})
        assert set(res.keys()) == base_keys, (key, val)
        d = res.get('dasha') or {}
        assert (d.get('vimshottari') or {}).get('available'), (key, val)


def test_strong_switches_do_differ():
    base = _compute(None)
    # charaDirection:方向规则字段随开关
    alt = _compute({'charaDirection': 'ninth_foot'})
    assert alt['extendedDashas']['chara']['directionRule'] == 'ninth_foot'
    assert base['extendedDashas']['chara']['directionRule'] == 'lagna_parity_sign'
    # charaDignity:期长口径记录
    alt2 = _compute({'charaDignity': 'none'})
    assert alt2['extendedDashas']['chara']['dignityRule'] == 'none'
    # ashtottariReckoning:reckoning 标注切换
    alt3 = _compute({'ashtottariReckoning': 'krittikadi'})
    assert alt3['dasha']['ashtottari']['reckoning'] == 'Krittikadi'
    assert base['dasha']['ashtottari']['reckoning'] == 'Ardradi'
    # kalachakraCycle:nextCycle.method 跟随
    alt4 = _compute({'kalachakraCycle': 'same_nak_carry'})
    kc = alt4['rasiDasha']['kalachakra']
    assert kc['cycleMethod'] == 'same_nak_carry'
    if kc.get('nextCycle'):
        assert kc['nextCycle']['method'] == 'same_nak_carry'
    # naisargikaOrder:orderMode 跟随
    alt5 = _compute({'naisargikaOrder': 'kendra_strength'})
    assert alt5['dasha']['naisargika']['orderMode'] == 'kendra_strength'
    # ayurdayaMethod:手动覆盖生效
    alt6 = _compute({'ayurdayaMethod': 'amsayu'})
    assert alt6['ayurdayaFinal']['methodSelection']['selected'] == 'amsayu'
    # krurodayaDenominator/ayuClassBoundaries:记录字段跟随
    alt7 = _compute({'ayuClassBoundaries': 'popular_32_70'})
    assert alt7['ayurdayaFinal']['classBoundaries'] == 'popular_32_70'
    # ── 🔴 真计算差分(防「只断回显」装饰化:回显字段原样写回输入,断它挡不住空开关)──
    # varnadaPeriodRule=equal_nine:首轮 12 段全 9 年(曾为空开关——选了年数逐字不变还谎报规则)
    alt8 = _compute({'varnadaPeriodRule': 'equal_nine'})
    vn = alt8['rasiDasha']['varnada']
    assert vn['periodRule'] == 'equal_nine'
    _c1 = [m for m in vn['mahadashas'] if m.get('cycle') == 1]
    assert len(_c1) == 12 and all(abs(float(m['years']) - 9.0) < 1e-9 for m in _c1)
    base_vn = base['rasiDasha']['varnada']
    assert base_vn['periodRule'] == 'count_to_lord'
    assert [m['years'] for m in base_vn['mahadashas']] != [m['years'] for m in vn['mahadashas']]
    # naisargikaOrder=kendra_strength:主星序列真变(不只 orderMode 回显)
    _nat = [m.get('lord') or m.get('planet') for m in base['dasha']['naisargika']['periods']]
    _ken = [m.get('lord') or m.get('planet') for m in alt5['dasha']['naisargika']['periods']]
    assert _nat != _ken, 'kendra 重排须真改主星序'


def test_condition_ctx_covers_all_applicable_keys():
    """🔴 生产链路 ctx ⊇ 全部条件式 applicable_fn 所读键。

    防「纯函数测试绿、生产恒 False」型盲区:Panchottari/Shattrimsha-sama 曾因引擎
    从不生产 d12_lagna_sign / lagna_hora 而 available 恒 False,合成 ctx 的单测照绿。
    此处直调引擎真 ctx,任何 applicable_fn 新增读键而引擎漏产 → 当场红。
    """
    eng = JyotishEngine(IndiaChartKernel(DATA))
    ctx = eng._dasha_condition_context()
    # dasha_extended 各 applicable_fn 实际读键全集(grep ctx.get 同步维护)
    required = {'lagna_sign', 'is_day', 'paksha', 'd9_lagna_sign', 'lagna_is_vargottama',
                'sun_in_lagna', 'tenth_lord_in_tenth', 'lagna_lord_in_1_or_7',
                'd12_lagna_sign', 'lagna_hora'}
    produced = {k for k, v in ctx.items() if v is not None}
    missing = required - produced
    assert not missing, f'引擎 ctx 缺条件式所需键: {sorted(missing)}'
    assert ctx['lagna_hora'] in ('Sun', 'Moon')


def test_new_systems_present_and_shapes():
    res = _compute(None)
    rd = res['rasiDasha']
    assert rd['chakra']['available'] and len(rd['chakra']['mahadashas']) == 12
    assert all(m['years'] == 10 for m in rd['chakra']['mahadashas'])
    assert rd['trikona']['available'] and len(set(rd['trikona']['order'])) == 12
    assert rd['navamsaDasha'].get('varga') == 'D9'
    assert 'paryaya' in rd
    d = res['dasha']
    assert d['taraDasha']['available'] and d['taraDasha']['totalYears'] == 120
    assert d['akkg']['available'] and len(d['akkg']['mahadashas']) == 18
