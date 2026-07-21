# -*- coding: utf-8 -*-
"""
Huangji Jingshi (皇極經世) core calculation module.

This module implements Shao Yong's (邵雍, 1011–1077) cosmological time-cycle
system and hexagram (卦) positioning algorithm.

Mathematical basis of the time cycles
--------------------------------------
The system divides cosmic time into nested cycles:

* **1 元 (yuán)** = 129,600 years — the "Grand Epoch"
* **1 元 = 12 會 (huì)** → each 會 = 10,800 years
* **1 會 = 30 運 (yùn)** → each 運 = 360 years
* **1 運 = 12 世 (shì)** → each 世 = 30 years

These cycles mirror the structure of the sexagenary calendar and the
Yijing (I Ching) hexagram system.  Accumulated years since the epoch
(積年 = 67,017 + year) are decomposed into 會/運/世 to determine the
"main hexagram" (正卦) and its transformed forms (運卦, 世卦, 旬卦, etc.).

The constant **67,017** is the traditional offset that places the current
era within the 7th 會 of the cosmic cycle.

Dependencies
------------
- ``ephem``   – Julian Date formatting
- ``sxtwl``   – Chinese lunar calendar conversion
- ``bidict``  – bidirectional dictionary for hexagram code ↔ name mapping
- ``cn2an``   – Arabic ↔ Chinese numeral conversion

Note on ``ephem``: Skyfield or Astropy could serve as modern replacements,
but ``ephem`` is retained for backward compatibility with the existing
calendrical pipeline.

@author: kentang
"""

from __future__ import annotations

import datetime
import os
import pickle
from datetime import timedelta
from difflib import get_close_matches
from functools import lru_cache
from itertools import cycle, repeat
import threading as _threading

# 子初/子正換日 thread-local 開關（webwangjisrv 每請求設定，預設 1=子初換日 23點後次日）
_AFTER23_LOCAL = _threading.local()
def set_after23_new_day(value):
    _AFTER23_LOCAL.after23 = 1 if value else 0
def _is_after23_active():
    return getattr(_AFTER23_LOCAL, 'after23', 1)

# v2.2.1: 晚子时·时柱起干 thread-local (默认 1=用次日日干)
_LATE_ZI_LOCAL = _threading.local()
def set_hour_gan_use_next_day(value):
    _LATE_ZI_LOCAL.late_zi = 1 if value else 0
def _is_hour_gan_next_day():
    return getattr(_LATE_ZI_LOCAL, 'late_zi', 1)
from typing import Any, Dict, List, Optional, Tuple

import cn2an
import sxtwl
from bidict import bidict
from cn2an import an2cn
from ephem import Date
from sxtwl import fromLunar, fromSolar

from .jieqi import (
    di_zhi,
    find_lunar_hour,
    find_lunar_month,
    gong_wangzhuai,
    jiazi,
    jq,
    lunar_date_d,
    multi_key_dict_get,
    new_list,
    tian_gan,
)

# ---------------------------------------------------------------------------
# Module-level data loading
# ---------------------------------------------------------------------------

_BASE: str = os.path.abspath(os.path.dirname(__file__))
_DATA_PATH: str = os.path.join(_BASE, 'data', 'data.pkl')

with open(_DATA_PATH, "rb") as _f:
    _data: Dict[str, Any] = pickle.load(_f)

#: Bidirectional mapping between 6-digit hexagram codes and hexagram names.
sixtyfourgua: bidict = bidict(_data.get("數字排六十四卦"))

#: Hexagram line-by-line interpretations.
gua_dist: Dict[str, Dict[int, str]] = _data.get("易經卦爻詳解")

#: The 60 hexagrams mapped to positions 1–60 in the Huangji cycle (excluding 乾/坤).
wangji_gua: Dict[int, str] = dict(
    zip(
        range(1, 61),
        "復,頤,屯,益,震,噬嗑,隨,無妄,明夷,賁,既濟,家人,豐,革,同人,臨,損,節,"
        "中孚,歸妹,睽,兌,履,泰,大畜,需,小畜,大壯,大有,夬,姤,大過,鼎,恆,巽,"
        "井,蠱,升,訟,困,未濟,解,渙,蒙,師,遯,咸,旅,小過,漸,蹇,艮,謙,否,萃,"
        "晉,豫,觀,比,剝".split(","),
    )
)

#: The 64 hexagrams (including 乾/坤 at positions 32 and 64).
wangji_gua2: Dict[int, str] = dict(
    zip(
        range(1, 65),
        "復,頤,屯,益,震,噬嗑,隨,無妄,明夷,賁,既濟,家人,豐,離,革,同人,臨,損,"
        "節,中孚,歸妹,睽,兌,履,泰,大畜,需,小畜,大壯,大有,夬,乾,姤,大過,鼎,"
        "恆,巽,井,蠱,升,訟,困,未濟,解,渙,坎,蒙,師,遯,咸,旅,小過,漸,蹇,艮,"
        "謙,否,萃,晉,豫,觀,比,剝,坤".split(","),
    )
)

# Mapping the 4 special hexagrams (excluded from the 60-gua cycle) to their
# next neighbor in the cycle.  Used when ``new_list`` would fail because the
# target hexagram is not in ``wangji_gua``.
_SPECIAL_GUA_NEIGHBOR: Dict[str, str] = {"乾": "姤", "坤": "復", "離": "革", "坎": "蒙"}

# Supported year range.
_MIN_YEAR: int = -12999   # 全年份域:与星阙历法承诺域一致(元会运世为 129600 年周期模运算,全域可推)
_MAX_YEAR: int = 16799


def _rotate_gua_cycle(target: str) -> List[str]:
    """Rotate the 60-gua cycle so that *target* is (or is near) position 0.

    If *target* is one of the four special hexagrams (乾/坤/離/坎) that are
    absent from :data:`wangji_gua`, the nearest successor in the 64-gua
    ordering is used as the rotation pivot instead.

    Returns:
        A rotated copy of ``wangji_gua.values()`` with 60 elements.
    """
    gua_list = list(wangji_gua.values())
    actual = _SPECIAL_GUA_NEIGHBOR.get(target, target)
    return new_list(gua_list, actual)


# ---------------------------------------------------------------------------
# Input validation
# ---------------------------------------------------------------------------


def _validate_datetime_args(
    year: int, month: int, day: int, hour: int, minute: int
) -> None:
    """Validate basic date/time arguments.

    Args:
        year: Calendar year (``_MIN_YEAR`` to ``_MAX_YEAR``).
        month: Month (1–12).
        day: Day (1–31).
        hour: Hour (0–23).
        minute: Minute (0–59).

    Raises:
        ValueError: If any argument is out of range.
    """
    if not (_MIN_YEAR <= year <= _MAX_YEAR):
        raise ValueError(f"Year {year} out of supported range [{_MIN_YEAR}, {_MAX_YEAR}]")
    if not (1 <= month <= 12):
        raise ValueError(f"Month {month} out of range [1, 12]")
    if not (1 <= day <= 31):
        raise ValueError(f"Day {day} out of range [1, 31]")
    if not (0 <= hour <= 23):
        raise ValueError(f"Hour {hour} out of range [0, 23]")
    if not (0 <= minute <= 59):
        raise ValueError(f"Minute {minute} out of range [0, 59]")


# ---------------------------------------------------------------------------
# Utility helpers
# ---------------------------------------------------------------------------


def generate_time_list(
    start_time: datetime.datetime, hours: int
) -> List[datetime.datetime]:
    """Generate a list of datetimes at hourly intervals.

    Args:
        start_time: Starting datetime.
        hours: Total number of hours to cover (list length = hours // 2).

    Returns:
        List of datetimes spaced 1 hour apart.
    """
    time_list: List[datetime.datetime] = []
    current_time = start_time
    for _ in range(hours // 2):
        time_list.append(current_time)
        current_time += timedelta(hours=1)
    return time_list


def find_closest_value(
    date_list: Dict[str, Any], current: str
) -> Optional[Any]:
    """Find the closest matching key in *date_list* to *current*.

    Uses ``difflib.get_close_matches`` for fuzzy string matching.

    Args:
        date_list: Dict with string keys.
        current: Target string to match.

    Returns:
        The value associated with the closest key, or ``None`` if no match.
    """
    matches = get_close_matches(current, date_list.keys(), n=1)
    if not matches:
        return None
    return date_list.get(matches[0])


def repeat_list(n: int, thelist: List[str]) -> List[str]:
    """Repeat each element in *thelist* *n* consecutive times.

    Args:
        n: Number of repetitions per element.
        thelist: Source list.

    Returns:
        Expanded list.
    """
    return [repetition for i in thelist for repetition in repeat(i, n)]


def closest(lst: List[int], K: int) -> int:
    """Return the element in *lst* immediately before the closest match to *K*.

    Args:
        lst: Sorted list of integers.
        K: Target value.

    Returns:
        ``lst[idx - 1]`` where *idx* is the index of the closest element.
    """
    return lst[min(range(len(lst)), key=lambda i: abs(lst[i] - K)) - 1]


def closest1(lst: List[int], K: int) -> int:
    """Return the element in *lst* immediately after the closest match to *K*.

    Args:
        lst: Sorted list of integers.
        K: Target value.

    Returns:
        ``lst[idx + 1]`` where *idx* is the index of the closest element.
    """
    return lst[min(range(len(lst)), key=lambda i: abs(lst[i] - K)) + 1]


def closest2(lst: List[int], K: int) -> int:
    """Return the element in *lst* that is closest to *K*.

    Args:
        lst: Sorted list of integers.
        K: Target value.

    Returns:
        The closest element itself.
    """
    return lst[min(range(len(lst)), key=lambda i: abs(lst[i] - K))]


# ---------------------------------------------------------------------------
# Sexagenary cycle helpers (reused from jieqi but with local wrappers)
# ---------------------------------------------------------------------------


@lru_cache(maxsize=1)
def liujiashun_dict() -> Dict[Tuple[str, ...], str]:
    """Build the six-jiazi 10-day cycle (六甲旬) mapping.

    Each 10-day "xun" (旬) maps its 10 members to the leading 甲-day.

    Returns:
        Dict mapping a tuple of 10 stems-branches to the leading 甲-day.
    """
    _jiazi = jiazi()
    return dict(
        zip(
            [tuple(new_list(_jiazi, x)[0:10]) for x in _jiazi[0::10]],
            _jiazi[0::10],
        )
    )


# ---------------------------------------------------------------------------
# Hexagram mutation helpers
# ---------------------------------------------------------------------------


def change(g: str, yao: int) -> str:
    """Toggle a single line (爻) in a hexagram code between yin and yang.

    Hexagram lines are encoded as ``'7'`` (yang) or ``'8'`` (yin).  This
    function flips the line at position *yao* (1 = bottom, 6 = top).

    Args:
        g: Six-character hexagram code string, e.g. ``'778877'``.
        yao: Line position to change (1–6).

    Returns:
        New hexagram code with the specified line toggled.

    Raises:
        ValueError: If *yao* is not in 1–6 or the line value is unexpected.
    """
    y = {6: 5, 5: 4, 4: 3, 3: 2, 2: 1, 1: 0}.get(yao)
    if y is None:
        raise ValueError(f"yao must be 1–6, got {yao}")
    if g[y] == "7":
        a = "8"
    elif g[y] == "8":
        a = "7"
    else:
        raise ValueError(f"Unexpected line value '{g[y]}' at position {yao}")
    return "".join([a if i == y else g[i] for i in range(len(g))])


def one2two(gua: str) -> str:
    """Pad a single-character hexagram name to two characters for display alignment.

    Args:
        gua: Hexagram name (1 or 2 characters).

    Returns:
        Two-character string (padded with ideographic space if needed).
    """
    if len(gua) == 1:
        return gua + "　"
    return gua


# ---------------------------------------------------------------------------
# Date range generation
# ---------------------------------------------------------------------------


def generate_month_lists(year: int) -> List[List[datetime.datetime]]:
    """Generate date lists covering pairs of lunar months for the given year.

    Args:
        year: Lunar calendar year.

    Returns:
        List of 6 sub-lists, each covering two consecutive lunar months.
    """
    month_lists: List[List[datetime.datetime]] = []
    for i in range(1, 13, 2):
        start = sxtwl.fromLunar(year, i, 1, True)
        end = sxtwl.fromLunar(year, min(i + 1, 12), 31, True)
        start_date = datetime.datetime(
            start.getSolarYear(), start.getSolarMonth(), start.getSolarDay()
        )
        end_date = datetime.datetime(
            end.getSolarYear(), end.getSolarMonth(), end.getSolarDay()
        )
        date_list: List[datetime.datetime] = []
        current_date = start_date
        while current_date <= end_date:
            date_list.append(current_date)
            current_date += datetime.timedelta(days=1)
        month_lists.append(date_list)
    return month_lists


def get_datelist(datelist: List[str]) -> List[List[datetime.datetime]]:
    """Generate date ranges between consecutive timestamp strings.

    Args:
        datelist: List of date strings in ``'%Y/%m/%d %H:%M:%S'`` format.

    Returns:
        List of sub-lists, each containing datetimes between consecutive entries.
    """
    result: List[List[datetime.datetime]] = []
    for i in range(len(datelist) - 1):
        start_date = datetime.datetime.strptime(datelist[i], '%Y/%m/%d %H:%M:%S')
        end_date = datetime.datetime.strptime(datelist[i + 1], '%Y/%m/%d %H:%M:%S')
        dates_between: List[datetime.datetime] = []
        current_date = start_date
        while current_date < end_date:
            dates_between.append(current_date)
            current_date += timedelta(days=1)
        result.append(dates_between)
    return result


# ---------------------------------------------------------------------------
# Stems-branches (干支) calculation — Huangji variant
# ---------------------------------------------------------------------------


@lru_cache(maxsize=256)
def _minutes_jiazi_mapping() -> Dict[str, str]:
    """Build the minute-level stems-branches lookup (cached).

    Each minute ``0–59`` within each hour ``0–23`` maps to a stems-branches
    pair, cycling through the 60 甲子 with each element repeated twice
    (covering 2 minutes).

    Returns:
        Dict mapping ``'H:M'`` strings to stems-branches.
    """
    t = [f"{h}:{m}" for h in range(24) for m in range(60)]
    return dict(zip(t, cycle(repeat_list(2, jiazi()))))


def minutes_jiazi_d() -> Dict[str, str]:
    """Generate a minute-by-minute stems-branches mapping for the full day.

    Returns:
        Dict mapping ``'H:M'`` to stems-branches, e.g. ``{'0:0': '甲子', …}``.
    """
    return _minutes_jiazi_mapping()


def gangzhi(
    year: int, month: int, day: int, hour: int, minute: int
) -> List[str]:
    """Calculate the complete stems-branches (干支) for a date-time.

    Handles year 0 (invalid in Chinese calendar) and negative years (BCE).

    Args:
        year: Calendar year.  Year 0 returns ``['無效']``.  Negative years
              are adjusted for the proleptic calendar.
        month: Month (1–12).
        day: Day of month.
        hour: Hour (0–23).
        minute: Minute (0–59).

    Returns:
        List ``[year_gz, month_gz, day_gz, hour_gz, minute_gz]``, or
        ``['無效']`` when *year* is 0.
    """
    if year == 0:
        return ["無效"]

    if year < 1 or year > 9999:
        # 全年份域回退(共享件,口径与主链一致;域内 ephem+sxtwl 原路径零变)
        from kin_year_domain import extreme_pillars
        _y, _m, _d, _h, _zi = extreme_pillars(
            year, month, day, hour, minute,
            after23=(1 if _is_after23_active() else 0),
            hour_gan_next=(1 if _is_hour_gan_next_day() else 0))
        try:
            _gm = minutes_jiazi_d().get(f"{hour}:{minute}")
        except Exception:
            _gm = None
        return [_y, _m, _d, _h, _gm]

    if year < 0:
        year = year + 1

    # 用戶語義（拍板,字面直覺版）: after23=1「23点算第二天」=23時起日柱進位次日(壬寅); =0「24点算第二天」=23時仍守今、24時才換日柱(辛丑)。
    if hour == 23 and _is_after23_active():
        d = Date(round(Date(f"{year:04d}/{month:02d}/{day + 1:02d} 00:00:00.00"), 3))
    else:
        d = Date(f"{year:04d}/{month:02d}/{day:02d} {hour:02d}:00:00.00")

    dd = list(d.tuple())
    cdate = fromSolar(dd[0], dd[1], dd[2])

    # Year / month / day stems-branches from sxtwl
    yTG = f"{tian_gan[cdate.getYearGZ().tg]}{di_zhi[cdate.getYearGZ().dz]}"
    mTG = f"{tian_gan[cdate.getMonthGZ().tg]}{di_zhi[cdate.getMonthGZ().dz]}"
    dTG = f"{tian_gan[cdate.getDayGZ().tg]}{di_zhi[cdate.getDayGZ().dz]}"
    # 時柱跨日: v2.2.1 双开关。lateZi=1(默认):用次日日干;lateZi=0:跟日柱一致。
    _h_late_override = False
    if hour == 23:
        _h_late_override = True
        if _is_hour_gan_next_day():
            if _is_after23_active():
                hTG = f"{tian_gan[cdate.getHourGZ(0).tg]}{di_zhi[cdate.getHourGZ(0).dz]}"
            else:
                _td = Date(round(Date(f"{year:04d}/{month:02d}/{day + 1:02d} 00:00:00.00"), 3))
                _tdd = list(_td.tuple())
                cdate_for_hour = fromSolar(_tdd[0], _tdd[1], _tdd[2])
                hTG = f"{tian_gan[cdate_for_hour.getHourGZ(0).tg]}{di_zhi[cdate_for_hour.getHourGZ(0).dz]}"
        else:
            _day_tg = cdate.getDayGZ().tg
            hTG = tian_gan[(_day_tg % 5 * 2 + 0) % 10] + di_zhi[0]
    else:
        hTG = f"{tian_gan[cdate.getHourGZ(dd[3]).tg]}{di_zhi[cdate.getHourGZ(dd[3]).dz]}"

    # For years before 1900, use Five Tigers derivation (五虎遁) for month
    if year < 1900:
        mTG1 = find_lunar_month(yTG).get(lunar_date_d(year, month, day).get("月"))
    else:
        mTG1 = mTG

    # Minute stems-branches
    gangzhi_minute = minutes_jiazi_d().get(f"{hour}:{minute}")

    return [yTG, mTG1, dTG, hTG, gangzhi_minute]


# ---------------------------------------------------------------------------
# Accumulated-year / cycle decomposition (積年分解)
# ---------------------------------------------------------------------------


def _compute_cycles(year: int) -> Tuple[int, int, int, int]:
    """Decompose *year* into 會/運/世 cycle indices and accumulated years.

    The epoch offset **67,017** places the current era within the Huangji
    cosmological framework.

    * 會 (huì):  ``accumulated_years // 10,800 + 1``   (10,800 = 1 會)
    * 運 (yùn):  ``accumulated_years // 360 + 1``      (360 = 1 運)
    * 世 (shì):  ``accumulated_years // 30 + 1``       (30 = 1 世)

    Args:
        year: Calendar year (already adjusted for year-0 and negative years).

    Returns:
        Tuple ``(acum_year, hui, yun, shi)``.
    """
    if year < 0:
        acum_year = 67017 + year + 1
    else:
        acum_year = 67017 + year

    hui = acum_year // 10800 + 1
    yun = acum_year // 360 + 1
    shi = acum_year // 30 + (2 if year < 0 else 1)
    return acum_year, hui, yun, shi


# ---------------------------------------------------------------------------
# Month-hexagram derivation (月卦推算)
# ---------------------------------------------------------------------------


_TOGGLE: Dict[str, str] = {"7": "8", "8": "7"}
_NORMALIZE: Dict[str, str] = {"9": "7", "6": "8", "7": "7", "8": "8"}


def _derive_month_hexagrams(yeargua_code: str) -> Dict[int, Optional[str]]:
    """Derive the 12 monthly hexagrams from a year hexagram code.

    The derivation progressively toggles pairs of lines from top to bottom,
    producing 6 unique hexagrams that each cover two consecutive months.

    Args:
        yeargua_code: Six-character raw hexagram code for the year.

    Returns:
        Dict mapping month numbers (1–12) to hexagram names.
    """
    nygua = "".join([_NORMALIZE.get(i, i) for i in yeargua_code])

    # Progressive line-pair toggling (months cycle through 6 transformed gua)
    first = _TOGGLE[nygua[0]] + nygua[1:]
    second = _TOGGLE[first[0]] + _TOGGLE[first[1]] + first[2:]
    third = second[0] + _TOGGLE[second[1]] + _TOGGLE[second[2]] + second[3:]
    forth = third[0] + third[1] + _TOGGLE[third[2]] + _TOGGLE[third[3]] + third[4:]
    fifth = forth[0] + forth[1] + forth[2] + _TOGGLE[forth[3]] + _TOGGLE[forth[4]] + forth[5]
    sixth = fifth[0] + fifth[1] + fifth[2] + fifth[3] + _TOGGLE[fifth[4]] + _TOGGLE[fifth[5]]

    mlist = [first, first, second, second, third, third,
             forth, forth, fifth, fifth, sixth, sixth]
    return dict(
        zip(range(1, 13), [multi_key_dict_get(sixtyfourgua, i) for i in mlist])
    )


# ---------------------------------------------------------------------------
# Main Huangji four-gua computation (皇極四卦排算)
# ---------------------------------------------------------------------------


def wanji_four_gua(
    year: int, month: int, day: int, hour: int, minute: int
) -> Dict[str, Any]:
    """Calculate the full Huangji Jingshi hexagram configuration.

    Produces 9 hexagrams (正卦, 運卦, 世卦, 旬卦, 年卦, 月卦, 日卦, 時卦, 分卦)
    together with cycle indices (會/運/世) and changing-line positions.

    Args:
        year: Calendar year.
        month: Month (1–12).
        day: Day of month.
        hour: Hour (0–23).
        minute: Minute (0–59).

    Returns:
        Dict with keys:
            - ``日期``: formatted date string
            - ``干支``: list of 5 stems-branches
            - ``會``, ``運``, ``世``: cycle indices
            - ``運卦動爻``, ``世卦動爻``, ``旬卦動爻``: changing-line positions
            - ``正卦`` through ``分卦``: hexagram names

    Raises:
        ValueError: If *year* or other arguments are invalid.
    """
    _validate_datetime_args(year, month, day, hour, minute)

    lmonth = lunar_date_d(year, month, day).get("月")

    # Adjust for lunar new-year crossover (農曆跨年)
    if lmonth == 12 and month == 1:
        year = year - 1

    j_q = jq(year, month, day, hour, minute)

    # Full stems-branches including minute-level (分干支)
    gz = gangzhi(year, month, day, hour, minute)
    ygz, _, dgz, hgz, fgz = gz

    # -- Cycle decomposition (積年數計算) --
    effective_year = year
    if effective_year == 0:
        effective_year = 1
    acum_year, hui, yun, shi = _compute_cycles(effective_year)

    # -- Main hexagram (正卦) --
    # Dividing accumulated years by 2160 (= 6 運) maps to the 60-gua cycle
    main_gua = wangji_gua.get(int(round(acum_year / 2160, 0)))

    # -- Yun hexagram (運卦): change one line in the main hexagram --
    mys = list(
        sixtyfourgua.inverse[main_gua][0].replace("6", "8").replace("9", "7")
    )
    yun_gua_yao = 6 if yun % 6 == 0 else yun % 6
    mys1 = change(mys, yun_gua_yao)
    yungua = multi_key_dict_get(sixtyfourgua, mys1)

    # -- Shi hexagram (世卦): change one line in the yun hexagram --
    shi_yao = shi // 2 % 6 or 6
    shis1 = change(mys1, shi_yao)
    shigua = multi_key_dict_get(sixtyfourgua, change(mys1, shi_yao))

    # -- Xun hexagram (旬卦): change one line in the shi hexagram --
    shi_shun = dict(
        zip("甲子,甲戌,甲申,甲午,甲辰,甲寅".split(","), range(1, 7))
    )
    shun_yao = shi_shun.get(multi_key_dict_get(liujiashun_dict(), ygz))
    shungua1 = change(shis1, shun_yao)
    shun_gua = multi_key_dict_get(sixtyfourgua, shungua1)

    # -- Year hexagram (年卦) --
    jiazi_years = sorted(
        [-56 - 60 * i for i in range(100)] + [4 + 60 * i for i in range(100)]
    )
    close_jiazi_year = (
        closest(jiazi_years, year) if year not in jiazi_years else year
    )
    cyear = lunar_date_d(year, month, day).get("年")
    try:
        yeargua = dict(
            zip(jiazi(), _rotate_gua_cycle(shigua))
        ).get(ygz)
    except ValueError:
        yeargua = dict(
            zip(range(close_jiazi_year, close_jiazi_year + 60), wangji_gua.values())
        ).get(cyear)

    # -- Month hexagram (月卦) --
    ygua = sixtyfourgua.inverse[yeargua][0]
    mgua_list = _derive_month_hexagrams(ygua)
    mgua = mgua_list.get(lmonth)

    # -- Day hexagram (日卦) --
    day_gua = dict(
        zip(jiazi(), _rotate_gua_cycle(mgua))
    ).get(dgz)

    # -- Hour hexagram (時卦) --
    hourgua = dict(
        zip(jiazi(), _rotate_gua_cycle(day_gua))
    ).get(hgz)

    # -- Minute hexagram (分卦): offset by minute stems-branches position --
    gua_cycle = list(wangji_gua.values())

    try:
        base_idx = gua_cycle.index(hourgua)
    except ValueError:
        base_idx = 0

    try:
        fen_offset = jiazi().index(fgz)
    except ValueError:
        fen_offset = 0

    adjusted_base = (base_idx + fen_offset) % 60
    new_idx = (adjusted_base + minute) % 60
    fen_gua = gua_cycle[new_idx]

    return {
        "日期": f"{year}-{month:02d}-{day:02d} {hour:02d}:{minute:02d}",
        "干支": gz,
        "會": hui,
        "運": yun,
        "世": shi,
        "運卦動爻": yun_gua_yao,
        "世卦動爻": shi_yao,
        "旬卦動爻": shun_yao,
        "正卦": main_gua,
        "運卦": yungua,
        "世卦": shigua,
        "旬卦": shun_gua,
        "年卦": yeargua,
        "月卦": mgua,
        "日卦": day_gua,
        "時卦": hourgua,
        "分卦": fen_gua,
    }


# ---------------------------------------------------------------------------
# Display helper (排盤顯示)
# ---------------------------------------------------------------------------


def display_pan(
    year: int, month: int, day: int, hour: int, minute: int
) -> str:
    """Format the full Huangji divination board for display.

    Produces a multi-line string containing:
    - Date/time in solar and lunar calendars
    - Stems-branches for the four pillars
    - Current solar term and prosperity states
    - Nine hexagrams rendered as line diagrams
    - Year-hexagram line-by-line interpretation

    Args:
        year: Calendar year.
        month: Month (1–12).
        day: Day of month.
        hour: Hour (0–23).
        minute: Minute (0–59).

    Returns:
        Formatted multi-line string for console or text-based display.
    """
    lmonth = lunar_date_d(year, month, day).get("月")
    gz = gangzhi(year, month, day, hour, minute)
    a = f"起卦時間︰{year}年{month}月{day}日{hour}時{minute}分\n"
    b = "農曆︰{}{}月{}日\n".format(
        cn2an.transform(str(lunar_date_d(year, month, day).get("年")) + "年", "an2cn"),
        an2cn(lunar_date_d(year, month, day).get("月")),
        an2cn(lunar_date_d(year, month, day).get("日")),
    )
    c = f"干支︰{gz[0]}年  {gz[1]}月  {gz[2]}日  {gz[3]}時\n"
    if lmonth == 12 and month == 1:
        year = year - 1
    j_q = jq(year, month, day, hour, minute)
    c0 = "節氣︰{} | 旺︰{} | 相︰{}\n".format(
        j_q,
        gong_wangzhuai(j_q)[1].get("旺"),
        gong_wangzhuai(j_q)[1].get("相"),
    )
    guayaodict: Dict[str, str] = {
        "6": "▅▅ ▅▅ X",
        "7": "▅▅▅▅▅  ",
        "8": "▅▅ ▅▅  ",
        "9": "▅▅▅▅▅ O",
    }
    wj = wanji_four_gua(year, month, day, hour, minute)
    g = "{}會    {}運   {}世\n\n".format(
        an2cn(wj.get("會")), an2cn(wj.get("運")), an2cn(wj.get("世"))
    )

    # Build line codes for each of the 9 hexagrams
    gua_keys = ["正卦", "運卦", "世卦", "旬卦", "年卦", "月卦", "日卦", "時卦", "分卦"]
    gua_names = [wj.get(k) for k in gua_keys]
    gua_display_names = [one2two(n) for n in gua_names]
    gua_codes = [
        [guayaodict.get(i) for i in sixtyfourgua.inverse[n][0].replace("6", "8").replace("9", "7")]
        for n in gua_names
    ]

    g1 = "   正卦            運卦            世卦             旬卦             年卦             月卦             日卦             時卦             分卦\n"
    gg = " 【{}】         【{}】         【{}】          【{}】          【{}】         【{}】         【{}】          【{}】          【{}】\n".format(
        *gua_display_names
    )
    lines = []
    for row in [5, 4, 3, 2, 1, 0]:
        line = "  {}         {}         {}         {}         {}         {}         {}         {}         {}\n".format(
            *(codes[row] for codes in gua_codes)
        )
        lines.append(line)
    # Last line gets extra newline
    lines[-1] = lines[-1].rstrip("\n") + "\n\n"

    yrg = wj.get("年卦")
    yrgd = "【" + yrg + "】卦\n" + "".join(
        [gua_dist.get(yrg).get(i) + "\n" for i in range(0, 7)]
    )
    return a + b + c + c0 + g + g1 + gg + "".join(lines) + yrgd


if __name__ == '__main__':
    print(wanji_four_gua(2026, 3, 14, 1, 2))
    print(wanji_four_gua(2026, 3, 14, 2, 2))
    print(wanji_four_gua(2026, 3, 14, 1, 0))
    print(wanji_four_gua(2026, 3, 14, 1, 10))
    print(wanji_four_gua(2026, 3, 14, 1, 30))
    print(wanji_four_gua(2026, 3, 14, 1, 59))