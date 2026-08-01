# -*- coding: utf-8 -*-
"""扩展大运（条件型宿系 8 式 + Chara 宫系）—— 结构/不变量/口径测试。

钉死项：
  - 8 式各「主运年数之和 == 该式总年」(总年不变量；转录错立即红)。
  - 每式起主由月宿种子决定(count ÷ N / 反向 / 28 宿分组)。
  - 起运余额 = 起主满期 × 月宿剩余比。
  - 适用条件命中/不命中(condition_not_met)。
  - Chara：lagna 起、12 连续星座、奇宫顺/偶宫逆、期长「数到主宫 −1」(奇宫顺数/偶宫逆数、
    本座 12、旺 +1 落 −1)、双主宫 classic(节点占座优先)取主、12 主运覆盖全部星座。
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'flatlib-ctrad2'))

from flatlib import const  # noqa: E402

from astrostudy.india import dasha_extended as dx  # noqa: E402
from astrostudy.india.primitives import SIGNS, ODD_SIGNS  # noqa: E402


# 一组样例行星布局(种子/期长/双主用；非真实命盘，仅测结构与口径)。
PLANET_SIGNS = {
    const.SUN: const.LEO,
    const.MOON: const.TAURUS,
    const.MARS: const.ARIES,
    const.MERCURY: const.VIRGO,
    const.JUPITER: const.CANCER,
    const.VENUS: const.LIBRA,
    const.SATURN: const.CAPRICORN,
    const.NORTH_NODE: const.GEMINI,
    const.SOUTH_NODE: const.SAGITTARIUS,
}
LAGNA = const.ARIES


# 8 式期望总年（命名澄清：Shatabdika=100，Shattrimsha-sama=36，二者不同）。
EXPECTED_TOTALS = {
    'shodashottari': ('Shodashottari', 116),
    'dvadashottari': ('Dvadashottari', 112),
    'panchottari': ('Panchottari', 105),
    'shatabdika': ('Shatabdika', 100),
    'chaturashitiSama': ('Chaturashiti-sama', 84),
    'dwisaptatiSama': ('Dwisaptati-sama', 72),
    'shashtihayani': ('Shashtihayani', 60),
    'shattrimshaSama': ('Shattrimsha-sama', 36),
}


# ════════════════════════════════════════════════════════════════════════
# A. 8 式总年不变量（核心：每式主运年数之和 == 总年）
# ════════════════════════════════════════════════════════════════════════

def test_all_eight_specs_total_year_invariant():
    for key, (name, total) in EXPECTED_TOTALS.items():
        spec = dx.CONDITIONAL_SPEC_BY_KEY[key]
        assert spec.name == name, (key, spec.name, name)
        assert spec.total == total, (key, spec.total, total)
        s = sum(y for _, y in spec.lords)
        assert s == total, (name, 'sum', s, '!=', total)


def test_spec_instances_match_module_validator():
    # 模块导入即跑的 _validate_totals 不抛 = 已过；这里再独立钉一遍各式。
    dx._validate_totals()
    assert len(dx.CONDITIONAL_SPECS) == 8


def test_built_mahadashas_full_years_sum_to_total():
    # 经 builder 实际构建后，各式「主运满期年(fullYears)之和」仍 == 总年(覆盖一整轮)。
    for key, (_name, total) in EXPECTED_TOTALS.items():
        spec = dx.CONDITIONAL_SPEC_BY_KEY[key]
        res = dx.build_nakshatra_dasha(spec, 45.0, 4, 0.6)
        assert len(res['mahadashas']) == len(spec.lords)
        s = sum(m['fullYears'] for m in res['mahadashas'])
        assert s == total, (key, s, total)
        assert res['totalYears'] == total


# ════════════════════════════════════════════════════════════════════════
# B. 月宿种子（count ÷ N / 反向 / 28 宿分组）
# ════════════════════════════════════════════════════════════════════════

def test_shodashottari_seed_pushya_maps_to_first_lord():
    # Pushya(#8) → lords[0] = Sun。月在 Pushya → 起主 Sun；下一宿 Ashlesha → Mars。
    lords = [(k, y) for k, y in dx.SHODASHOTTARI.lords]
    assert dx.SHODASHOTTARI.seed_fn(8, lords) == 0
    assert dx.SHODASHOTTARI.lords[0][0] == 'Sun'
    assert dx.SHODASHOTTARI.seed_fn(9, lords) == 1
    assert dx.SHODASHOTTARI.lords[1][0] == 'Mars'


def test_dvadashottari_seed_is_reverse_from_revati():
    # Dvadashottari 反向(月宿 → Revati)：Revati(#27) → lords[0]=Sun；U.Bhadra(#26) → Jupiter。
    lords = [(k, y) for k, y in dx.DVADASHOTTARI.lords]
    assert dx.DVADASHOTTARI.seed_fn(27, lords) == 0
    assert dx.DVADASHOTTARI.lords[0][0] == 'Sun'
    assert dx.DVADASHOTTARI.seed_fn(26, lords) == 1
    assert dx.DVADASHOTTARI.lords[1][0] == 'Jupiter'


def test_dvadashottari_and_shatabdika_seeds_are_opposite_direction():
    # 同一月宿下，Dvadashottari(月宿→Revati) 与 Shatabdika(Revati→月宿) 方向刻意相反。
    # 取月宿 = U.Bhadra(#26)：Dvada 起序 1；Shatabdika 起序 = (26−27)%7 = 6。
    dl = [(k, y) for k, y in dx.DVADASHOTTARI.lords]
    sl = [(k, y) for k, y in dx.SHATABDIKA.lords]
    assert dx.DVADASHOTTARI.seed_fn(26, dl) == 1
    assert dx.SHATABDIKA.seed_fn(26, sl) == (26 - 27) % 7


def test_shashtihayani_28nak_group_seed():
    # Shashtihayani 起主用含 Abhijit 的 28 宿分组：
    #   Ashwini → Jupiter 组；Revati → Mars 组；Abhijit → Saturn 组。
    lords = [(k, y) for k, y in dx.SHASHTIHAYANI.lords]
    assert dx.SHASHTIHAYANI.lords[dx.shashtihayani_seed_index(1, lords)][0] == 'Jupiter'
    assert dx.SHASHTIHAYANI.lords[dx.shashtihayani_seed_index(27, lords)][0] == 'Mars'
    # Abhijit(月落 28 宿织女段)：传 moon_nak_name='Abhijit' → Saturn 组。
    idx = dx.shashtihayani_seed_index(21, lords, moon_nak_name='Abhijit')
    assert dx.SHASHTIHAYANI.lords[idx][0] == 'Saturn'


def test_shashtihayani_abhijit_by_moon_lon():
    # 不传宿名、由 moon_lon 落在 Abhijit 区间(276°40′–280°53′20″)判属 Saturn 组。
    lords = [(k, y) for k, y in dx.SHASHTIHAYANI.lords]
    moon_lon = 278.0  # Abhijit 区段内
    idx = dx.shashtihayani_seed_index(21, lords, moon_lon=moon_lon)
    assert dx.SHASHTIHAYANI.lords[idx][0] == 'Saturn'


def test_first_balance_is_lord_years_times_remaining_ratio():
    # 起运余额 = 起主满期 × 月宿剩余比。Shodashottari 月在 Rohini(#4)→起主 Ketu(15 年)。
    res = dx.build_nakshatra_dasha(dx.SHODASHOTTARI, 45.0, 4, 0.6)
    assert res['firstLord']['key'] == 'Ketu'
    assert abs(res['firstBalanceYears'] - 15 * 0.6) < 1e-9
    assert res['mahadashas'][0]['balance'] is True
    assert abs(res['mahadashas'][0]['years'] - 15 * 0.6) < 1e-9


# ════════════════════════════════════════════════════════════════════════
# C. 适用条件（命中 / 不命中 condition_not_met）
# ════════════════════════════════════════════════════════════════════════

def test_shodashottari_condition_day_krishna_met():
    # 昼 + Krishna → available；mahadashas 仍给出(可手动查看)。
    res = dx.build_nakshatra_dasha(
        dx.SHODASHOTTARI, 45.0, 4, 0.6,
        ctx={'is_day': True, 'paksha': 'Krishna'})
    assert res['available'] is True
    assert 'mahadashas' in res and len(res['mahadashas']) == 8


def test_shodashottari_condition_not_met_still_computable():
    # 昼 + Shukla(条件不满足)→ available False + reason，但 mahadashas 仍可手动查看。
    res = dx.build_nakshatra_dasha(
        dx.SHODASHOTTARI, 45.0, 4, 0.6,
        ctx={'is_day': True, 'paksha': 'Shukla'})
    assert res['available'] is False
    assert res['reason'] == 'condition_not_met'
    assert len(res['mahadashas']) == 8                  # 仍给序列


def test_panchottari_condition_cancer_d12():
    # lagna 巨蟹 且 D12 巨蟹 → available。
    ctx_yes = {'lagna_sign': const.CANCER, 'd12_lagna_sign': const.CANCER}
    ctx_no = {'lagna_sign': const.CANCER, 'd12_lagna_sign': const.LEO}
    assert dx.build_nakshatra_dasha(dx.PANCHOTTARI, 45.0, 4, 0.6, ctx=ctx_yes)['available'] is True
    assert dx.build_nakshatra_dasha(dx.PANCHOTTARI, 45.0, 4, 0.6, ctx=ctx_no)['available'] is False


def test_shatabdika_condition_vargottama():
    # lagna Vargottama(D1=D9 同座)→ available。
    yes = {'lagna_sign': const.ARIES, 'd9_lagna_sign': const.ARIES}
    no = {'lagna_sign': const.ARIES, 'd9_lagna_sign': const.TAURUS}
    assert dx.build_nakshatra_dasha(dx.SHATABDIKA, 45.0, 4, 0.6, ctx=yes)['available'] is True
    assert dx.build_nakshatra_dasha(dx.SHATABDIKA, 45.0, 4, 0.6, ctx=no)['available'] is False


def test_condition_missing_ctx_defaults_not_available_but_has_series():
    # 缺 ctx → 条件判 False(保守)，但 mahadashas 仍在(可手动查看)。
    res = dx.build_nakshatra_dasha(dx.CHATURASHITI_SAMA, 45.0, 4, 0.6)
    assert res['available'] is False
    assert len(res['mahadashas']) == len(dx.CHATURASHITI_SAMA.lords)


# ════════════════════════════════════════════════════════════════════════
# D. 子运（AD_START 口径 + 比例分）
# ════════════════════════════════════════════════════════════════════════

def test_antardashas_self_start_default():
    # AD_START 默认 self：首主运的首个 AD = 本主自身。
    res = dx.build_nakshatra_dasha(dx.SHODASHOTTARI, 45.0, 8, 0.6)  # 起主 Sun
    first_md = res['mahadashas'][0]
    assert first_md['lord']['key'] == 'Sun'
    assert first_md['antardashas'][0]['lord']['key'] == 'Sun'       # self 起


def test_antardashas_next_start_option():
    # AD_START='next'：首个 AD = 下一主、末位本主。
    res = dx.build_nakshatra_dasha(dx.SHODASHOTTARI, 45.0, 8, 0.6, ad_start='next')
    first_md = res['mahadashas'][0]
    assert first_md['antardashas'][0]['lord']['key'] != 'Sun'
    assert first_md['antardashas'][-1]['lord']['key'] == 'Sun'      # next: 末位本主


def test_antardasha_years_proportional_sum_to_parent():
    # 子运年比例分：AD 年之和 == 主运年(比例法 cycle=total)。
    res = dx.build_nakshatra_dasha(dx.PANCHOTTARI, 45.0, 4, 0.6)
    for md in res['mahadashas']:
        ad_sum = sum(ad['years'] for ad in md['antardashas'])
        assert abs(ad_sum - md['years']) < 1e-9, (md['lord']['key'], ad_sum, md['years'])


# ════════════════════════════════════════════════════════════════════════
# E. Chara 大运（Jaimini 权威口径）
# ════════════════════════════════════════════════════════════════════════

def test_chara_twelve_consecutive_signs_cover_all():
    # 12 主运覆盖全部星座；从 lagna 起连续(非跳)。
    res = dx.chara_dasha(LAGNA, PLANET_SIGNS)
    assert res['system'] == 'Chara'
    assert len(res['mahadashas']) == 12
    assert len(res['order']) == 12
    assert set(res['order']) == set(SIGNS)              # 覆盖全 12 星座
    assert res['order'][0] == LAGNA                     # 从 lagna 起


def test_chara_direction_odd_lagna_forward_consecutive():
    # 奇宫 lagna(Aries)→ 顺连续(zodiacal)。
    res = dx.chara_dasha(const.ARIES, PLANET_SIGNS)
    assert res['direction'] == 'forward'
    seed_idx = SIGNS.index(res['order'][0])
    for i, s in enumerate(res['order']):
        assert SIGNS.index(s) == (seed_idx + i) % 12


def test_chara_direction_even_lagna_reverse_consecutive():
    # 偶宫 lagna(Taurus)→ 逆连续。
    res = dx.chara_dasha(const.TAURUS, PLANET_SIGNS)
    assert res['direction'] == 'reverse'
    seed_idx = SIGNS.index(res['order'][0])
    for i, s in enumerate(res['order']):
        assert SIGNS.index(s) == (seed_idx - i) % 12


def test_chara_period_years_in_range():
    for s in SIGNS:
        y = dx.chara_period_years(s, PLANET_SIGNS)
        assert 1 <= y <= 12, (s, y)


def test_chara_lord_in_own_sign_is_12():
    # 主在 dasa rasi 本座(距离 1)→ 12 年。火星(Ar 主)在 Ar。
    assert dx.chara_period_years(const.ARIES, {const.MARS: const.ARIES}) == 12


def test_chara_count_direction_by_sign_parity():
    # 数向按各宫自身奇偶(非奇足)：
    #   奇宫 Aquarius(10)→顺数到 Saturn@Capricorn → dist=(9−10)%12+1=12, −1=11。
    assert dx.chara_period_years(const.AQUARIUS, {const.SATURN: const.CAPRICORN}) == 11
    #   偶宫 Taurus(1)→逆数到 Venus@Libra → dist=(1−6)%12+1=8, −1=7。
    assert dx.chara_period_years(const.TAURUS, {const.VENUS: const.LIBRA}) == 7


def test_chara_exalted_lord_plus_one_debilitated_minus_one():
    # 旺主 +1：Ar→Mars 旺于 Capricorn → dist10−1=9, +1 = 10。
    assert dx.chara_period_years(const.ARIES, {const.MARS: const.CAPRICORN}) == 10
    # 落主 −1：Ar→Mars 落于 Cancer → dist4−1=3, −1 = 2。
    assert dx.chara_period_years(const.ARIES, {const.MARS: const.CANCER}) == 2


def test_chara_dual_lord_classic_default():
    # classic：Sc = Ketu(若占座)否则 Mars；Aq = Rahu(若占座)否则 Saturn。
    ps_ketu_sc = dict(PLANET_SIGNS); ps_ketu_sc[const.SOUTH_NODE] = const.SCORPIO
    assert dx._chara_lord(const.SCORPIO, ps_ketu_sc) == const.SOUTH_NODE
    assert dx._chara_lord(const.SCORPIO, PLANET_SIGNS) == const.MARS
    ps_rahu_aq = {const.NORTH_NODE: const.AQUARIUS}
    assert dx._chara_lord(const.AQUARIUS, ps_rahu_aq) == const.NORTH_NODE
    assert dx._chara_lord(const.AQUARIUS, PLANET_SIGNS) == const.SATURN


def test_chara_variant_stronger_uses_planet_strength():
    # variant='stronger'：双主宫改用行星 5 级强弱序(全级未分 → 传统主)。
    res = dx.chara_dasha(LAGNA, PLANET_SIGNS, variant='stronger')
    assert res['variant'] == 'stronger'
    # 全局 CHARA_VARIANT 用后复原(不泄漏)。
    assert dx.CHARA_VARIANT == 'classic'


def test_chara_antardashas_consecutive_same_direction():
    # 某主运的 AD：从 dasa rasi 起、同方向连续 12 宫。
    res = dx.chara_dasha(const.ARIES, PLANET_SIGNS)       # 顺
    md0 = res['mahadashas'][0]
    ads = [a['rasi'] for a in md0['antardashas']]
    assert len(ads) == 12 and set(ads) == set(SIGNS)
    seed_idx = SIGNS.index(md0['rasi'])
    for i, s in enumerate(ads):
        assert SIGNS.index(s) == (seed_idx + i) % 12       # 同向(顺)连续


# ════════════════════════════════════════════════════════════════════════
# F. 顶层聚合 build_extended_dashas
# ════════════════════════════════════════════════════════════════════════

def test_build_extended_full():
    inputs = {
        'lagna_sign': LAGNA,
        'planet_signs': PLANET_SIGNS,
        'moon_lon': 45.0,
        'moon_nak_index': 4,
        'moon_nak_name': 'Rohini',
        'moon_nak_remaining_ratio': 0.6,
        'conditionContext': {'is_day': True, 'paksha': 'Krishna'},
    }
    res = dx.build_extended_dashas(inputs)
    assert res['available'] is True
    assert set(res['conditional'].keys()) == set(EXPECTED_TOTALS.keys())
    # 各式总年不变量(聚合后再钉)。
    for key, (_name, total) in EXPECTED_TOTALS.items():
        assert res['conditional'][key]['totalYears'] == total
    assert res['chara']['system'] == 'Chara'
    assert len(res['chara']['mahadashas']) == 12


def test_build_extended_missing_moon_nak_degrades():
    res = dx.build_extended_dashas({'lagna_sign': LAGNA, 'planet_signs': PLANET_SIGNS})
    assert res['available'] is True
    assert res['conditional']['available'] is False
    assert res['conditional']['reason'] == 'missing_moon_nakshatra'
    assert res['chara']['system'] == 'Chara'             # Chara 仅需 lagna


def test_build_extended_missing_lagna():
    res = dx.build_extended_dashas({})
    assert res['available'] is False
    assert res['reason'] == 'missing_lagna'


def test_year_mode_default_julian():
    # 🔴 有意识的 golden 更正:默认年制由 solar(365.2425) 统一为 julian(365.25),
    #    与主 Vimshottari 同口径(权威 §10.1.5 之默认)。全局仅作默认值,运行期口径走形参。
    assert dx.YEAR_MODE == 'julian'
    assert abs(dx.year_days() - 365.25) < 1e-9
    assert abs(dx.year_days('julian') - 365.25) < 1e-9
    assert abs(dx.year_days('solar') - 365.2425) < 1e-9
    assert abs(dx.year_days('savana') - 360.0) < 1e-9
    assert abs(dx.year_days('tropical') - 365.2422) < 1e-9
    assert abs(dx.year_days('sidereal') - 365.2563) < 1e-9
    # 反查:五档命中口径名,非标准值 → custom
    assert dx.year_mode_of(365.25) == 'julian'
    assert dx.year_mode_of(365.2425) == 'solar'
    assert dx.year_mode_of(364.0) == 'custom'
