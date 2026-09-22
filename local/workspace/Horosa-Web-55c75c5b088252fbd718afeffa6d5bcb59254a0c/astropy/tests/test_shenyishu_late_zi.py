# -*- coding: utf-8 -*-
"""[Q-310/T-291] 神易数 23 点时柱:晚子时按次日日柱(缺省)时旧路径进位两次(1990-05-18 23:30 得丙子,应甲子)。
时柱改走全域权威 extreme_pillars;四种 (after23, lateZi) 组合与权威逐字相同;非 23 时字节不变。"""
import os
import sys

_ASTRO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if _ASTRO not in sys.path:
    sys.path.insert(0, _ASTRO)

import pytest  # noqa: E402

pytest.importorskip('sxtwl')
from kin_year_domain import extreme_pillars  # noqa: E402
from shenyishu.shenyishu import Shenyishu  # noqa: E402


def test_default_late_zi_hour_pillar_is_jiazi_not_bingzi():
    gz = Shenyishu(1990, 5, 18, 23, after23_new_day=1, late_zi_next_day=1).gangzhi()
    assert gz['時'] == '甲子'


@pytest.mark.parametrize('after23', [0, 1])
@pytest.mark.parametrize('late_zi', [0, 1])
def test_23h_four_pillars_match_authority(after23, late_zi):
    gz = Shenyishu(1990, 5, 18, 23, after23_new_day=after23, late_zi_next_day=late_zi).gangzhi()
    y, m, d, h, _ = extreme_pillars(1990, 5, 18, 23, 0, after23=after23, hour_gan_next=late_zi)
    assert (gz['年'], gz['月'], gz['日'], gz['時']) == (y, m, d, h)


@pytest.mark.parametrize('hour', [0, 1, 10, 22])
def test_non_23h_unchanged_and_matches_authority(hour):
    gz = Shenyishu(1990, 5, 18, hour).gangzhi()
    y, m, d, h, _ = extreme_pillars(1990, 5, 18, hour, 0, after23=1, hour_gan_next=1)
    assert (gz['年'], gz['月'], gz['日'], gz['時']) == (y, m, d, h)
