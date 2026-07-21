# -*- coding: utf-8 -*-
"""
Solar term (節氣) and stems-branches (干支) calculation module.

This module provides astronomical and calendrical functions for:
- 24 solar terms (二十四節氣) date/time lookup via the sxtwl library
- Sexagenary cycle (六十甲子) generation
- Stems-branches (干支) calculation for year, month, day, hour, and minute
- Solar longitude computation using the PyEphem library

Note: PyEphem (``ephem``) is used for ecliptic longitude calculations.
Skyfield or Astropy could serve as modern replacements, but ``ephem`` remains
well-tested for historical Chinese calendrical work and is retained here for
backward compatibility.

@author: hooki
"""

from __future__ import annotations

import datetime
import re
from functools import lru_cache
from itertools import cycle, repeat
from math import pi
from typing import Any, Dict, List, Optional, Tuple

import ephem
import sxtwl
from ephem import Date, Ecliptic, Equatorial, Sun
from sxtwl import fromSolar

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

#: The 24 solar terms ordered from 小寒 (xiaohan) to 冬至 (dongzhi).
jqmc: List[str] = [
    '小寒', '大寒', '立春', '雨水', '驚蟄', '春分',
    '清明', '穀雨', '立夏', '小滿', '芒種', '夏至',
    '小暑', '大暑', '立秋', '處暑', '白露', '秋分',
    '寒露', '霜降', '立冬', '小雪', '大雪', '冬至',
]

#: Ten Heavenly Stems (天干).
tian_gan: str = '甲乙丙丁戊己庚辛壬癸'

#: Twelve Earthly Branches (地支).
di_zhi: str = '子丑寅卯辰巳午未申酉戌亥'

#: Solar term names starting from the Spring Equinox (春分), each 2 characters.
jieqi_name: List[str] = re.findall(
    '..', '春分清明穀雨立夏小滿芒種夏至小暑大暑立秋處暑白露秋分寒露霜降立冬小雪大雪冬至小寒大寒立春雨水驚蟄'
)

# Supported year range for sxtwl-based lookups.
_MIN_YEAR: int = -4712
_MAX_YEAR: int = 9999

# ---------------------------------------------------------------------------
# Input validation helpers
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
# Sexagenary cycle (六十甲子) — the 60-year Heavenly-Stems / Earthly-Branches cycle
# ---------------------------------------------------------------------------


@lru_cache(maxsize=1)
def jiazi() -> List[str]:
    """Generate the full 60-element sexagenary cycle (六十甲子).

    The cycle pairs each of the 10 Heavenly Stems (天干) with the 12 Earthly
    Branches (地支) to produce 60 unique combinations, starting with 甲子 and
    ending with 癸亥.

    Returns:
        A list of 60 two-character strings, e.g. ``['甲子', '乙丑', …, '癸亥']``.
    """
    return [
        f"{tian_gan[x % len(tian_gan)]}{di_zhi[x % len(di_zhi)]}"
        for x in range(60)
    ]


# ---------------------------------------------------------------------------
# Generic utility helpers
# ---------------------------------------------------------------------------


def multi_key_dict_get(d: Dict[Tuple[str, ...], Any], k: str) -> Optional[Any]:
    """Look up *k* in a dict whose keys are tuples of strings.

    Args:
        d: Dictionary with tuple keys.
        k: Value to search for among the tuple elements.

    Returns:
        The matching value, or ``None`` if not found.
    """
    for keys, v in d.items():
        if k in keys:
            return v
    return None


def new_list(olist: List[str], o: str) -> List[str]:
    """Rotate *olist* so that element *o* becomes the first item.

    Args:
        olist: The original list.
        o: The element to rotate to position 0.

    Returns:
        A new list starting at *o* and wrapping around.

    Raises:
        ValueError: If *o* is not in *olist*.
    """
    a = olist.index(o)
    return olist[a:] + olist[:a]


def repeat_list(n: int, thelist: List[str]) -> List[str]:
    """Repeat each element in *thelist* *n* consecutive times.

    Args:
        n: Number of repetitions per element.
        thelist: Source list.

    Returns:
        Expanded list with each original element repeated *n* times.
    """
    return [repetition for i in thelist for repetition in repeat(i, n)]


# ---------------------------------------------------------------------------
# Solar term (節氣) date lookup — uses sxtwl for calendar search
# ---------------------------------------------------------------------------


def _build_jieqi_dict(t: Any, jq_index: int) -> Dict[str, Any]:
    """Build a standard jieqi result dictionary from an sxtwl time struct.

    Args:
        t: Time struct returned by ``sxtwl.JD2DD()``.
        jq_index: Raw jieqi index from ``getJieQi()``.

    Returns:
        Dict with keys 年, 月, 日, 時, 分, 節氣, 時間.
    """
    return {
        "年": t.Y,
        "月": t.M,
        "日": t.D,
        "時": int(t.h),
        "分": round(t.m),
        "節氣": jqmc[jq_index - 1],
        "時間": datetime.datetime(t.Y, t.M, t.D, int(t.h), round(t.m)),
    }


def get_jieqi_start_date(
    year: int, month: int, day: int, hour: int, minute: int
) -> Dict[str, Any]:
    """Get the start date/time of the current or most recent solar term.

    Searches backward from the given date until a solar-term day is found.

    Args:
        year: Calendar year.
        month: Month (1–12).
        day: Day of month.
        hour: Hour (0–23).
        minute: Minute (0–59).

    Returns:
        A dict containing the solar term name (``節氣``) and its exact
        start ``datetime`` (``時間``), along with year/month/day/hour/minute
        fields.
    """
    _validate_datetime_args(year, month, day, hour, minute)
    sxtwl_day = sxtwl.fromSolar(year, month, day)

    if sxtwl_day.hasJieQi():
        jq_index = sxtwl_day.getJieQi()
        t = sxtwl.JD2DD(sxtwl_day.getJieQiJD())
        return _build_jieqi_dict(t, jq_index)

    # Walk backward until a solar-term day is found
    current_day = sxtwl_day
    while True:
        current_day = current_day.before(1)
        if current_day.hasJieQi():
            jq_index = current_day.getJieQi()
            t = sxtwl.JD2DD(current_day.getJieQiJD())
            return _build_jieqi_dict(t, jq_index)


def get_before_jieqi_start_date(
    year: int, month: int, day: int, hour: int, minute: int
) -> Dict[str, Any]:
    """Get the solar term that precedes the one closest to the given date.

    Starts 15 days before the given date and walks backward.

    Args:
        year: Calendar year.
        month: Month (1–12).
        day: Day of month.
        hour: Hour (0–23).
        minute: Minute (0–59).

    Returns:
        A dict with the same structure as :func:`get_jieqi_start_date`.
    """
    _validate_datetime_args(year, month, day, hour, minute)
    sxtwl_day = sxtwl.fromSolar(year, month, day)
    current_day = sxtwl_day.before(15)
    while True:
        if current_day.hasJieQi():
            jq_index = current_day.getJieQi()
            t = sxtwl.JD2DD(current_day.getJieQiJD())
            return _build_jieqi_dict(t, jq_index)
        current_day = current_day.before(1)


def get_next_jieqi_start_date(
    year: int, month: int, day: int, hour: int, minute: int
) -> Dict[str, Any]:
    """Get the next solar term after the given date.

    Args:
        year: Calendar year.
        month: Month (1–12).
        day: Day of month.
        hour: Hour (0–23).
        minute: Minute (0–59).

    Returns:
        A dict with the same structure as :func:`get_jieqi_start_date`.
    """
    _validate_datetime_args(year, month, day, hour, minute)
    sxtwl_day = sxtwl.fromSolar(year, month, day)
    current_day = sxtwl_day.after(1)
    while True:
        if current_day.hasJieQi():
            jq_index = current_day.getJieQi()
            t = sxtwl.JD2DD(current_day.getJieQiJD())
            return _build_jieqi_dict(t, jq_index)
        current_day = current_day.after(1)


# ---------------------------------------------------------------------------
# Eight-trigram prosperity mapping (八宮旺衰)
# ---------------------------------------------------------------------------


def gong_wangzhuai(j_q: str) -> Tuple[Dict[str, str], Dict[str, str]]:
    """Map the current solar term to eight-trigram prosperity states.

    The eight trigrams (震巽離坤兌乾坎艮) each have a prosperity state
    (旺相胎沒死囚休廢) that rotates with the seasons.

    Args:
        j_q: A solar term name, e.g. ``'春分'``.

    Returns:
        A tuple ``(trigram_to_state, state_to_trigram)`` — two inverse dicts.
    """
    wangzhuai = list("旺相胎沒死囚休廢")
    wangzhuai_num = list("震巽離坤兌乾坎艮")
    wangzhuai_jieqi: Dict[Tuple[str, ...], str] = {
        ('春分', '清明', '穀雨'): '春分',
        ('立夏', '小滿', '芒種'): '立夏',
        ('夏至', '小暑', '大暑'): '夏至',
        ('立秋', '處暑', '白露'): '立秋',
        ('秋分', '寒露', '霜降'): '秋分',
        ('立冬', '小雪', '大雪'): '立冬',
        ('冬至', '小寒', '大寒'): '冬至',
        ('立春', '雨水', '驚蟄'): '立春',
    }
    season_key = multi_key_dict_get(wangzhuai_jieqi, j_q)
    lead_trigram = dict(zip(jieqi_name[0::3], wangzhuai_num)).get(season_key)
    r1 = dict(zip(new_list(wangzhuai_num, lead_trigram), wangzhuai))
    r2 = {v: k for k, v in r1.items()}
    return r1, r2


# ---------------------------------------------------------------------------
# Astronomical helpers — ecliptic longitude via PyEphem
# ---------------------------------------------------------------------------


def ecliptic_lon(jd_utc: float) -> float:
    """Compute the Sun's ecliptic longitude for a given Julian date.

    Uses PyEphem to convert the Sun's equatorial coordinates to ecliptic
    coordinates.

    Args:
        jd_utc: Julian date in UTC (PyEphem ``Date`` value).

    Returns:
        Ecliptic longitude in radians.
    """
    sun = Sun(jd_utc)
    return Ecliptic(Equatorial(sun.ra, sun.dec, epoch=jd_utc)).lon


def sta(jd_num: float) -> int:
    """Convert a Julian date to the solar term index (0–23).

    Each solar term spans 15° of ecliptic longitude.  The index is
    ``floor(longitude_in_degrees / 15)``.

    Args:
        jd_num: Julian date in UTC.

    Returns:
        Integer solar-term index (0–23).
    """
    return int(ecliptic_lon(jd_num) * 180.0 / pi / 15)


def iteration(jd: float, sta_fn: Any) -> float:
    """Binary-search refinement to find the exact Julian date of a solar term boundary.

    Starting from *jd*, steps forward/backward with progressively halved
    intervals until the solar-term index changes, yielding the transition
    moment to within ~0.01 seconds.

    Args:
        jd: Starting Julian date.
        sta_fn: Callable that maps a Julian date to a solar-term index.

    Returns:
        Julian date at which the solar-term transition occurs.
    """
    s1 = sta_fn(jd)
    s0 = s1
    dt = 1.0
    while True:
        jd += dt
        s = sta_fn(jd)
        if s0 != s:
            s0 = s
            dt = -dt / 2
        if abs(dt) < 0.0000001 and s != s1:
            break
    return jd


def find_jq_date(
    year: int, month: int, day: int, hour: int, jie_qi: str
) -> Any:
    """Find the exact ephem ``Date`` for a named solar term near the given date.

    Iterates through all 24 solar terms starting from the current ecliptic
    position, then returns the date matching *jie_qi*.

    Args:
        year: Calendar year.
        month: Month (1–12).
        day: Day of month.
        hour: Hour (0–23).
        jie_qi: Target solar term name, e.g. ``'春分'``.

    Returns:
        An ``ephem.Date`` for the requested solar term.
    """
    jd_format = Date(
        f"{year:04d}/{month:02d}/{day:02d} {hour:02d}:00:00.00"
    )
    e_1 = ecliptic_lon(jd_format)
    n_1 = int(e_1 * 180.0 / pi / 15) + 1
    dzlist: List[Dict[str, Any]] = []
    for _ in range(24):
        if n_1 >= 24:
            n_1 -= 24
        jd_d = iteration(jd_format, sta)
        d = Date(jd_d + 1 / 3).tuple()
        bb_1 = {
            jieqi_name[n_1]: Date(
                f"{d[0]:04d}/{d[1]:02d}/{d[2]:02d} {d[3]:02d}:{d[4]:02d}:00.00"
            )
        }
        n_1 += 1
        dzlist.append(bb_1)
    idx = [list(i.keys())[0] for i in dzlist].index(jie_qi)
    return list(dzlist[idx].values())[0]


def find_jq_date1(
    year: int, month: int, day: int, hour: int, minute: int
) -> Dict[str, str]:
    """Find all 24 solar term dates within a ~30-day window before the given date.

    Args:
        year: Calendar year.
        month: Month (1–12).
        day: Day of month.
        hour: Hour (0–23).
        minute: Minute (0–59).

    Returns:
        Dict mapping solar term names to date strings (``YYYY/MM/DD HH:MM:SS``).
    """
    changets = Date(
        f"{year:04d}/{month:02d}/{day:02d} {hour:02d}:{minute:02d}:00"
    )
    jd = Date(changets - 24 * ephem.hour * 30)
    e = ecliptic_lon(jd)
    n = int(e * 180.0 / pi / 15) + 1
    result: List[Dict[str, str]] = []
    for _ in range(24):
        if n >= 24:
            n -= 24
        jd = iteration(jd, sta)
        d = Date(jd + 1 / 3).tuple()
        dt_str = (
            f"{d[0]}/{d[1]}/{d[2]} {d[3]:02d}:{d[4]:02d}:00.00".split(".")[0]
        )
        result.append({jieqi_name[n]: dt_str})
        n += 1
    result1: Dict[str, str] = {}
    for i in result[1:]:
        result1.update(i)
    return result1


# ---------------------------------------------------------------------------
# Main solar term query
# ---------------------------------------------------------------------------


def jq(year: int, month: int, day: int, hour: int, minute: int) -> str:
    if year < 1 or year > 9999:
        # 全年份域回退:swe 太阳视黄经直映射节气名(与主链定气口径一致;域内原路径零变)
        from kin_year_domain import solar_term_name
        return solar_term_name(year, month, day, hour, minute)
    """Determine the current solar term (節氣) for the given date and time.

    Compares the input datetime against the start of the surrounding solar
    terms to decide which term is active.

    Args:
        year: Calendar year.
        month: Month (1–12).
        day: Day of month.
        hour: Hour (0–23).
        minute: Minute (0–59).

    Returns:
        The two-character Chinese name of the active solar term.

    Raises:
        ValueError: If the date is invalid or falls outside computable range.
    """
    _validate_datetime_args(year, month, day, hour, minute)
    try:
        current_datetime = datetime.datetime(year, month, day, hour, minute)
        jq_start_dict = get_jieqi_start_date(year, month, day, hour, minute)
        next_jq_start_dict = get_next_jieqi_start_date(year, month, day, hour, minute)

        if not (isinstance(jq_start_dict, dict) and isinstance(next_jq_start_dict, dict)
                and "時間" in jq_start_dict and "時間" in next_jq_start_dict
                and "節氣" in jq_start_dict and "節氣" in next_jq_start_dict):
            raise ValueError(
                f"Invalid jieqi dictionary format for {year}-{month}-{day} {hour}:{minute}"
            )

        jq_start_datetime: datetime.datetime = jq_start_dict["時間"]
        next_jq_start_datetime: datetime.datetime = next_jq_start_dict["時間"]
        jq_name: str = jq_start_dict["節氣"]

        if not (isinstance(jq_start_datetime, datetime.datetime)
                and isinstance(next_jq_start_datetime, datetime.datetime)):
            raise ValueError(
                f"Jieqi times are not datetime objects: {jq_start_datetime}, "
                f"{next_jq_start_datetime}"
            )

        # Check if current_datetime is within the current jieqi period
        if jq_start_datetime <= current_datetime < next_jq_start_datetime:
            return jq_name
        # If before the current jieqi start, get the previous jieqi
        elif current_datetime < jq_start_datetime:
            prev_jq_start_dict = get_before_jieqi_start_date(
                year, month, day, hour, minute
            )
            if not (isinstance(prev_jq_start_dict, dict) and "節氣" in prev_jq_start_dict):
                raise ValueError(
                    f"Invalid previous jieqi dictionary format for {year}-{month}-{day}"
                )
            return prev_jq_start_dict["節氣"]
        else:
            raise ValueError(
                f"Current datetime {current_datetime} not within any valid jieqi period"
            )
    except ValueError:
        raise
    except Exception as e:
        raise ValueError(
            f"Error in jq for {year}-{month}-{day} {hour}:{minute}: {e}"
        ) from e


# ---------------------------------------------------------------------------
# Stems-branches cycle derivation helpers (干支推算)
# ---------------------------------------------------------------------------


def ke_jiazi_d(hour: str) -> Dict[str, str]:
    """Generate a mapping from ``HH:M0`` time slots to minute-level stems-branches.

    Uses the Five Horses (五馬遁) method to derive the starting stems-branches
    for each 10-minute block, then cycles through the 60 甲子.

    Args:
        hour: The hour stems-branches string (e.g. ``'甲子'``).

    Returns:
        Dict mapping ``'H:M0'`` time strings to stems-branches.
    """
    t = [f"{h}:{m}0" for h in range(24) for m in range(6)]
    minutelist = dict(zip(t, cycle(repeat_list(1, find_lunar_ke(hour)))))
    return minutelist


def find_lunar_month(year: str) -> Dict[int, str]:
    """Derive month stems-branches using the Five Tigers (五虎遁) method.

    In Chinese calendrical science the month stem is derived from the year
    stem via the "Five Tigers Escape" rule, starting from the first lunar
    month (正月 = 寅).

    Args:
        year: Year stems-branches string (e.g. ``'甲子'``).

    Returns:
        Dict mapping month numbers (1–12) to their stems-branches.
    """
    fivetigers: Dict[Tuple[str, ...], str] = {
        tuple(list('甲己')): '丙寅',
        tuple(list('乙庚')): '戊寅',
        tuple(list('丙辛')): '庚寅',
        tuple(list('丁壬')): '壬寅',
        tuple(list('戊癸')): '甲寅',
    }
    result = multi_key_dict_get(fivetigers, year[0])
    if result is None:
        result = multi_key_dict_get(fivetigers, year[1])
    return dict(zip(range(1, 13), new_list(jiazi(), result)[:12]))


def find_lunar_hour(day: str) -> Dict[str, str]:
    """Derive hour stems-branches using the Five Rats (五鼠遁) method.

    The hour stem is derived from the day stem via the "Five Rats Escape"
    rule, starting from the 子 (zi) hour.

    Args:
        day: Day stems-branches string (e.g. ``'甲子'``).

    Returns:
        Dict mapping each Earthly Branch to its hour stems-branches.
    """
    fiverats: Dict[Tuple[str, ...], str] = {
        tuple(list('甲己')): '甲子',
        tuple(list('乙庚')): '丙子',
        tuple(list('丙辛')): '戊子',
        tuple(list('丁壬')): '庚子',
        tuple(list('戊癸')): '壬子',
    }
    result = multi_key_dict_get(fiverats, day[0])
    if result is None:
        result = multi_key_dict_get(fiverats, day[1])
    return dict(zip(list(di_zhi), new_list(jiazi(), result)[:12]))


def find_lunar_ke(hour: str) -> List[str]:
    """Derive ke (quarter-hour) stems-branches using the Five Horses (五馬遁) method.

    The ke stem is derived from the hour stem to assign stems-branches at
    sub-hour granularity.

    Args:
        hour: Hour stems-branches string (e.g. ``'甲子'``).

    Returns:
        Full 60-element cycle rotated to the correct starting position.
    """
    fivehorses: Dict[Tuple[str, ...], str] = {
        tuple(list('丙辛')): '甲午',
        tuple(list('丁壬')): '丙午',
        tuple(list('戊癸')): '戊午',
        tuple(list('甲己')): '庚午',
        tuple(list('乙庚')): '壬午',
    }
    result = multi_key_dict_get(fivehorses, hour[0])
    if result is None:
        result = multi_key_dict_get(fivehorses, hour[1])
    return new_list(jiazi(), result)


# ---------------------------------------------------------------------------
# Lunar calendar conversion
# ---------------------------------------------------------------------------


def lunar_date_d(year: int, month: int, day: int) -> Dict[str, Any]:
    """Convert a solar (Gregorian) date to a Chinese lunar calendar date.

    Args:
        year: Solar year.
        month: Solar month (1–12).
        day: Solar day.

    Returns:
        Dict with keys ``年`` (lunar year), ``農曆月`` (month name),
        ``月`` (month number), and ``日`` (lunar day).
    """
    lunar_m = [
        '占位', '正月', '二月', '三月', '四月', '五月', '六月',
        '七月', '八月', '九月', '十月', '冬月', '腊月',
    ]
    sxtwl_day = fromSolar(year, month, day)
    return {
        "年": sxtwl_day.getLunarYear(),
        "農曆月": lunar_m[int(sxtwl_day.getLunarMonth())],
        "月": sxtwl_day.getLunarMonth(),
        "日": sxtwl_day.getLunarDay(),
    }


# ---------------------------------------------------------------------------
# Stems-branches calculation (干支換算)
# ---------------------------------------------------------------------------


def gangzhi1(
    year: int, month: int, day: int, hour: int, minute: int
) -> List[str]:
    """Calculate year/month/day/hour stems-branches (simplified variant).

    This is a helper used internally by :func:`gangzhi` to resolve the
    midnight (子時) stems-branches when computing the minute-level cycle.

    Args:
        year: Calendar year.
        month: Month (1–12).
        day: Day of month.
        hour: Hour (0–23).
        minute: Minute (0–59).

    Returns:
        List ``[year_gz, month_gz, day_gz, hour_gz]``.
    """
    if hour == 23:
        d = ephem.Date(round(ephem.Date(
            f"{year:04d}/{month:02d}/{day + 1:02d} 00:00:00.00"
        ), 3))
    else:
        d = ephem.Date(
            f"{year:04d}/{month:02d}/{day:02d} {hour:02d}:00:00.00"
        )
    dd = list(d.tuple())
    cdate = fromSolar(dd[0], dd[1], dd[2])
    yTG = f"{tian_gan[cdate.getYearGZ().tg]}{di_zhi[cdate.getYearGZ().dz]}"
    mTG = f"{tian_gan[cdate.getMonthGZ().tg]}{di_zhi[cdate.getMonthGZ().dz]}"
    dTG = f"{tian_gan[cdate.getDayGZ().tg]}{di_zhi[cdate.getDayGZ().dz]}"
    hTG = f"{tian_gan[cdate.getHourGZ(dd[3]).tg]}{di_zhi[cdate.getHourGZ(dd[3]).dz]}"
    if year < 1900:
        mTG1 = find_lunar_month(yTG).get(lunar_date_d(year, month, day).get("月"))
    else:
        mTG1 = mTG
    hTG1 = find_lunar_hour(dTG).get(hTG[1])
    return [yTG, mTG1, dTG, hTG1]


def gangzhi(
    year: int, month: int, day: int, hour: int, minute: int
) -> List[str]:
    """Calculate complete stems-branches for year, month, day, hour, and minute.

    Combines sxtwl-based stems-branches with the Five Tigers / Five Rats /
    Five Horses derivation methods for full date-time resolution.

    Args:
        year: Calendar year.
        month: Month (1–12).
        day: Day of month.
        hour: Hour (0–23).
        minute: Minute (0–59).

    Returns:
        List ``[year_gz, month_gz, day_gz, hour_gz, minute_gz]``, each a
        two-character stems-branches string.
    """
    if hour == 23:
        d = ephem.Date(round(ephem.Date(
            f"{year:04d}/{month:02d}/{day + 1:02d} 00:00:00.00"
        ), 3))
    else:
        d = ephem.Date(
            f"{year:04d}/{month:02d}/{day:02d} {hour:02d}:00:00.00"
        )
    dd = list(d.tuple())
    cdate = fromSolar(dd[0], dd[1], dd[2])
    yTG = f"{tian_gan[cdate.getYearGZ().tg]}{di_zhi[cdate.getYearGZ().dz]}"
    mTG = f"{tian_gan[cdate.getMonthGZ().tg]}{di_zhi[cdate.getMonthGZ().dz]}"
    dTG = f"{tian_gan[cdate.getDayGZ().tg]}{di_zhi[cdate.getDayGZ().dz]}"
    hTG = f"{tian_gan[cdate.getHourGZ(dd[3]).tg]}{di_zhi[cdate.getHourGZ(dd[3]).dz]}"
    mTG1 = find_lunar_month(yTG).get(lunar_date_d(year, month, day).get("月"))
    hTG1 = find_lunar_hour(dTG).get(hTG[1])
    zi = gangzhi1(year, month, day, 0, 0)[3]
    # Round minute down to the nearest 10-minute block
    reminute = f"{(minute // 10) * 10:02d}"
    hourminute = f"{hour}:{reminute}"
    gangzhi_minute = ke_jiazi_d(zi).get(hourminute)
    return [yTG, mTG1, dTG, hTG1, gangzhi_minute]


if __name__ == '__main__':
    year = 2005
    month = 5
    day = 5
    hour = 16
    minute = 30
    print(f"{year}-{month}-{day} {hour}:{minute}")
    print(gangzhi(year, month, day, hour, minute))







