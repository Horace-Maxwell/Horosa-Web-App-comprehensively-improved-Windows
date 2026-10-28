"""太乙积日按民用日序之差(整天)算:同一天里积日不变,相邻两天差 1;时 / 分只经积数公式的时辰项计入。

病理:积日旧写法 int(带钟点的浮点日差) 向零取整。基准日(时计 / 分计 1900-12-21、日计 1900-06-19)以后
小数被舍掉恰好对;以前差值为负(如 −0.48),int 得 0、应得 −1,于是钟点 ≥ 01:00 的盘多算一天积日:
时计差 12 局号,局、太乙、文昌、主客算全变;同一天 00 点与 01 点落在两个积日上。择日扫描用的本地引擎
(TaiYiCore.dayDiffUTC)按 floor 算,所判与点开所见不是同一局。
判据:性质(同日不变、相邻差 1)× 基准日两侧 + 公元 1 世纪;后端积数与本地引擎实采值逐位相同
(前端 taiyiLocalParity.test.js 用同一组时刻反向锁本地);vendor 源码不许再出现 int(Date(…) - Date(…))。
"""
import os
import re
import sys
from pathlib import Path

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "vendor", "kintaiyi", "src"))

from kintaiyi.kintaiyi import Taiyi  # noqa: E402

DAYS = [(2026, 1, 1), (1900, 12, 20), (1900, 12, 21), (1900, 6, 18), (1850, 6, 1), (1500, 3, 1), (50, 3, 10)]
TIMES = [(0, 0), (0, 59), (1, 0), (12, 30), (23, 30)]


def _acc(y, m, d, h, mi, style):
    return Taiyi(y, m, d, h, mi).accnum(style, 0)


def _accday(y, m, d, h, mi, style):
    acc = _acc(y, m, d, h, mi, style)
    if style == 3:     # 时计:((accday − 1) × 12) + (hour + 1) // 2 + 1
        return (acc - (h + 1) // 2 - 1) // 12 + 1, (acc - (h + 1) // 2 - 1) % 12
    if style == 4:     # 分计:((accday − 1) × 23) + hour × 10500 + (minute + 1)
        return acc - h * 10500 - (mi + 1), 0
    return acc, 0      # 日计:积日本身


@pytest.mark.parametrize('style', [2, 3, 4])
@pytest.mark.parametrize('ymd', DAYS)
def test_accumulated_day_constant_within_a_civil_day(ymd, style):
    vals = {_accday(*ymd, h, mi, style) for h, mi in TIMES}
    assert len(vals) == 1, (ymd, style, vals)
    assert next(iter(vals))[1] == 0


@pytest.mark.parametrize('style,step', [(2, 1), (3, 1), (4, 23)])   # 时计比较的是还原出的积日
@pytest.mark.parametrize('ymd,next_ymd', [((1900, 12, 20), (1900, 12, 21)), ((1900, 6, 18), (1900, 6, 19)),
                                          ((1850, 5, 31), (1850, 6, 1)), ((1582, 10, 4), (1582, 10, 15)),
                                          ((1500, 2, 28), (1500, 3, 1)), ((2026, 1, 1), (2026, 1, 2))])
def test_adjacent_days_differ_by_one_accumulated_day(ymd, next_ymd, style, step):
    a = _accday(*ymd, 12, 30, style)[0]
    b = _accday(*next_ymd, 12, 30, style)[0]
    # 1500 年儒略历有 2 月 29 日:2-28 到 3-01 隔两天
    days = 2 if (ymd, next_ymd) == ((1500, 2, 28), (1500, 3, 1)) else 1
    assert b - a == days * step, (ymd, next_ymd, style, b - a)


# 本地引擎(TaiYiCore,择日扫描所用)同一时刻的时计积数实采值;前端 taiyiLocalParity 以同一组反向锁本地。
LOCAL_ENGINE_ACC = [
    ((2026, 1, 1, 12, 30), 8496681259),
    ((1950, 6, 1, 12, 30), 8496349963),
    ((1900, 12, 20, 12, 30), 8496133243),
    ((1900, 12, 22, 12, 30), 8496133267),
    ((1850, 6, 1, 0, 0), 8495911669),
    ((1850, 6, 1, 12, 30), 8495911675),
    ((1600, 3, 1, 9, 30), 8494814850),
    ((1500, 3, 1, 12, 30), 8494376671),
    ((50, 3, 10, 12, 30), 8488021423),
]


@pytest.mark.parametrize('when,acc', LOCAL_ENGINE_ACC)
def test_backend_accumulation_matches_local_scan_engine(when, acc):
    assert _acc(*when, 3) == acc


def test_vendor_has_no_truncated_ephem_day_difference():
    """int(Date(…) − Date(…)) 是向零取整:差为负(基准日以前)就多一天。日序差一律经整天相减。"""
    root = Path(__file__).resolve().parents[2] / 'vendor'
    pat = re.compile(r'int\(\s*Date\([^\n]*\)\s*-\s*Date\(')
    hits = []
    for p in root.rglob('*.py'):
        for i, line in enumerate(p.read_text(encoding='utf-8', errors='ignore').splitlines(), 1):
            if pat.search(line):
                hits.append('%s:%d' % (p.relative_to(root), i))
    assert not hits, hits
