# -*- coding: utf-8 -*-
"""
次要推运(minor)月长算法 minorVariant 锁定测试。
- 'synodic'(缺省·标准·朔望月/年): age_days*29.530589/365.2425(权威「a lunar month for a year」;[Q-180/T-95] 起为缺省)。
- 'sidereal'(月亮回归·恒星月/年): age_days*27.321661/365.2425。
- 'engine'(历史值,显式选档才走): age_days/12.3685/365.2425 —— 漏乘一次 /365.2425,推运天数仅应有值的 1/365(≈无推进)。
secondary/tertiary 不受 minorVariant 影响。不传 minor_variant ⇒ 与 'synodic' 逐字一致;未知档亦回落 synodic。
"""
import os
import sys

_ASTRO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if _ASTRO not in sys.path:
    sys.path.insert(0, _ASTRO)

from astrostudy.astroextra import progression_date  # noqa: E402


class _DT:
    def __init__(self, jd):
        self.jd = jd


BASE = _DT(2451545.0)          # J2000
TARGET = _DT(2451545.0 + 10957.0)  # +30 历年
AGE = 10957.0


def _approx(a, b, eps=1e-6):
    return abs(a - b) <= eps


def test_secondary_unchanged():
    assert _approx(progression_date(BASE, TARGET, 'secondary'), BASE.jd + AGE / 365.2425)


def test_tertiary_unchanged():
    assert _approx(progression_date(BASE, TARGET, 'tertiary'), BASE.jd + AGE / 27.321661)


def test_minor_default_is_synodic_and_engine_is_explicit_legacy():
    legacy = BASE.jd + AGE / 12.3685 / 365.2425
    synodic = BASE.jd + AGE * 29.530589 / 365.2425
    # [Q-180] 不传 variant == 显式 'synodic' == 未知档;'engine' 只在显式选档时才走历史值
    assert _approx(progression_date(BASE, TARGET, 'minor'), synodic)
    assert _approx(progression_date(BASE, TARGET, 'minor', None), synodic)
    assert _approx(progression_date(BASE, TARGET, 'minor', 'whatever'), synodic)
    assert _approx(progression_date(BASE, TARGET, 'minor', 'engine'), legacy)
    # 缺省小推运(30 岁)推运时刻 ≈ 出生后 885 天,而历史值仅 2.4 天(比二次推运 30 天还慢约 12 倍)
    assert 880 < (progression_date(BASE, TARGET, 'minor') - BASE.jd) < 890
    assert (progression_date(BASE, TARGET, 'minor', 'engine') - BASE.jd) < 3


def test_minor_synodic_standard():
    expect = BASE.jd + AGE * 29.530589 / 365.2425
    assert _approx(progression_date(BASE, TARGET, 'minor', 'synodic'), expect)
    # 标准朔望月/年应远大于 engine(后者漏乘约365倍)
    assert (progression_date(BASE, TARGET, 'minor', 'synodic') - BASE.jd) > \
           (progression_date(BASE, TARGET, 'minor', 'engine') - BASE.jd) * 100


def test_minor_sidereal():
    expect = BASE.jd + AGE * 27.321661 / 365.2425
    assert _approx(progression_date(BASE, TARGET, 'minor', 'sidereal'), expect)


def test_unknown_variant_falls_back_to_synodic():
    synodic = BASE.jd + AGE * 29.530589 / 365.2425
    assert _approx(progression_date(BASE, TARGET, 'minor', 'nonsense'), synodic)
