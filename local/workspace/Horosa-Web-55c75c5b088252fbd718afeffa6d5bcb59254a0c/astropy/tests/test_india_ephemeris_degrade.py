# -*- coding: utf-8 -*-
"""印度盘星历缺失 / 越界 → 优雅降级回归守卫。

针对 v2.6.9 Beta 印度占星「技法挂载失败 — Chiron 星历文件缺失」类问题:
当 Chiron(seas_*.se1)等星历在某些日期越界、或星历文件运行时不可达时,
swisseph 抛 swisseph.Error。IndiaChartKernel.__init__ 须捕获并退到 Jyotish
必需子集(_INDIA_SAFE_OBJECTS,无 Chiron/外行星),整盘不得崩 —— 这样后端
不会向前端返 {'err': 'param error'},印度技法挂载/快照才能成立。

本守卫两层:
  1) 现代日期 + 物理移走 seas_18.se1(Chiron 现代块)→ 模拟「文件缺失」原报场景,
     断言不崩、Chiron 被丢、九曜在位。文件用 try/finally 保证恢复。
  2) 公元前 / 远未来日期(Chiron 星历区间外)→ 断言不崩,九曜仍齐。
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'flatlib-ctrad2'))

from flatlib import const  # noqa: E402
from flatlib.ephem import swe  # noqa: E402
from astrostudy.india.india_chart_kernel import (  # noqa: E402
    IndiaChartKernel,
    INDIA_OBJECTS,
    _INDIA_SAFE_OBJECTS,
)

# Jyotish 命门:无论降级与否,这九曜 + 升交点必须永远在位(整盘判读依赖)。
_REQUIRED_GRAHA = [
    const.SUN, const.MOON, const.MERCURY, const.VENUS, const.MARS,
    const.JUPITER, const.SATURN, const.NORTH_NODE,
]


def _kernel(date='2000/01/01', time='12:00', zone='+08:00',
            lat='31:14', lon='121:28', ad=1):
    data = {
        'date': date, 'time': time, 'zone': zone, 'lat': lat, 'lon': lon,
        'ad': ad, 'indiaAyanamsa': 'lahiri', 'indiaHsys': 0,
    }
    return IndiaChartKernel(data)


def _chart_object_ids(kernel):
    return [obj.id for obj in kernel.chart.objects]


def test_safe_subset_is_proper_subset_with_required_graha():
    """降级子集是全集的真子集,且九曜+升交点齐 —— 降级后判读不残废。"""
    assert set(_INDIA_SAFE_OBJECTS).issubset(set(INDIA_OBJECTS))
    assert const.CHIRON in INDIA_OBJECTS
    assert const.CHIRON not in _INDIA_SAFE_OBJECTS      # 降级正是为丢 Chiron 这类越界天体
    for graha in _REQUIRED_GRAHA:
        assert graha in _INDIA_SAFE_OBJECTS


def test_chiron_ephemeris_file_missing_degrades_gracefully():
    """原报场景:现代日期 + Chiron 星历文件运行时缺失 → 不崩、优雅降级。

    swisseph 缺文件抛 swisseph.Error(Exception 子类),__init__ 的
    `except Exception` 须兜住并退到安全子集。文件 try/finally 保证恢复。
    """
    ephe_dir = swe._candidateEphePath()
    seas = os.path.join(ephe_dir, 'seas_18.se1')
    if not os.path.isfile(seas):
        pytest.skip('seas_18.se1 不在星历目录,跳过文件缺失模拟')

    backup = seas + '.pytest_degrade_bak'
    original_size = os.path.getsize(seas)
    # PERF-R9(horosa_ephe_path_fastpath_v1):ensureEphePath 现在会短路,不再每次 swe 调用
    # 都重设星历路径 —— 而重设路径在 C 库里**顺带关闭已打开的星历文件**。短路后句柄常驻,
    # Windows 不允许改名被打开的文件,这里的 os.rename 会 WinError 32。
    # 这是**测试前置条件**的修正,不是断言的放宽:下面「文件缺失 → 优雅降级」的断言一字未动。
    swe.closeEphemerisFiles()
    os.rename(seas, backup)
    try:
        kernel = _kernel(date='2000/01/01')           # 现代日期(Chiron 本应可算)
        ids = _chart_object_ids(kernel)
        # 文件缺失 → Chiron 算不出 → 必须已被降级丢弃,而非整盘崩
        assert const.CHIRON not in ids
        for graha in _REQUIRED_GRAHA:
            assert graha in ids, '降级后仍须保留 {0}'.format(graha)
    finally:
        # 铁律:无论断言成败都恢复星历文件,且校验恢复成功
        if os.path.isfile(backup):
            os.rename(backup, seas)
        assert os.path.isfile(seas), 'seas_18.se1 必须恢复在位'
        assert os.path.getsize(seas) == original_size


def test_chiron_present_under_normal_modern_date():
    """正常态(文件在位、现代日期)Chiron 必须正常算出 —— 降级不误伤正常路径。"""
    ids = _chart_object_ids(_kernel(date='2000/01/01'))
    assert const.CHIRON in ids


@pytest.mark.parametrize('date,ad', [
    ('500/6/1', -1),       # 公元前(Chiron 星历区间外 ≈ <675AD)
    ('3000/1/1', 1),       # 远未来(Chiron 星历区间外 ≈ >4650AD 之前但留余量)
])
def test_out_of_range_dates_keep_required_graha(date, ad):
    """越界日期:Chiron 可被丢,但九曜+升交点必须仍在 —— 不崩、可判读。"""
    ids = _chart_object_ids(_kernel(date=date, ad=ad))
    for graha in _REQUIRED_GRAHA:
        assert graha in ids
