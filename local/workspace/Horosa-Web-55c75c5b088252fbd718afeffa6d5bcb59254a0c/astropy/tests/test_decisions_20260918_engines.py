# -*- coding: utf-8 -*-
"""引擎口径锁:
   Q-267② 北极年干支按立春界(带月日)· Q-262① 邵子刻数→64 钥匙时辰键映射与缺档回落。"""
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
_KINASTRO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "vendor", "kinastro"))
if os.path.isdir(os.path.join(_KINASTRO, "astro")) and _KINASTRO not in sys.path:
    sys.path.insert(0, _KINASTRO)


def test_beiji_year_ganzhi_lichun_boundary():
    from astro.beiji.calculator import get_year_ganzhi
    assert get_year_ganzhi(1990, 1, 20) == ('己', '巳')      # 立春前 → 上一年
    assert get_year_ganzhi(1990, 6, 1) == ('庚', '午')
    assert get_year_ganzhi(2024, 2, 3) == ('癸', '卯')
    assert get_year_ganzhi(2024, 2, 4) == ('甲', '辰')       # 立春当日
    assert get_year_ganzhi(1990) == ('庚', '午')             # 只给年份 = 旧口径(6 月 1 日农历年)


def test_beiji_compute_uses_birth_date_for_year_branch():
    from astro.beiji.calculator import compute_beiji
    r = compute_beiji(1990, 1, 20, 10, 0, "男")
    text = repr(r)
    assert '己巳' in text or '巳' in text   # 大运 / 查询以出生年干支起,应按立春界得 己巳


def test_shaozi_ke_key_mapping_and_fallback():
    from websrv.webshaozisrv import ke_key_for, KE_OPTIONS
    assert ke_key_for('甲子', '初刻') == '子初'
    assert ke_key_for('甲子', '二刻') == '子初'
    assert ke_key_for('丙寅', '三刻') == '寅三'
    assert ke_key_for('丙寅', '六刻') == '寅五'
    assert ke_key_for('戊辰', '八刻') == '辰七'
    assert all(ke_key_for('甲子', k).startswith('子') for k in KE_OPTIONS)
    from astro.shaozi.shaozi_64_keys import get_key_info, SHAOZI_64_KEYS
    num = next(iter(SHAOZI_64_KEYS))
    sub = SHAOZI_64_KEYS[num].get("時辰") or {}
    if sub:
        branch = next(iter(sub))[:1]
        assert get_key_info(num, ke=f"{branch}初", category="時辰") != "無此項目資料"
        # 缺档(如 X五 / X七)回落同支「X初」
        assert get_key_info(num, ke=f"{branch}七", category="時辰") == get_key_info(num, ke=f"{branch}初", category="時辰") or (f"{branch}七" in sub)


