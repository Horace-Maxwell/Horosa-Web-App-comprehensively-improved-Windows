# -*- coding: utf-8 -*-
"""kin 系引擎共享·全年份域四柱回退。

sxtwl 在公元前/万年后越界(IndexError)或口径漂移;各 kin 引擎(太乙/奇门/金口/
皇极/五兆/…)的 gangzhi 家族在域外统一走本件——口径与主链(Java/前端/astrostudy)
完全一致:连续干支(公元 4 年甲子)、节气月柱(swe 太阳视黄经 15° 界,立春 315°)、
JDN 日柱(<1582-10-15 儒略)、五虎遁月干、五鼠遁时柱。域内(AD1~9999)各引擎
原路径零变(太乙 72 局等 golden 守恒)。
"""

_TG = "甲乙丙丁戊己庚辛壬癸"
_DZ = "子丑寅卯辰巳午未申酉戌亥"


def in_sxtwl_domain(year):
    return 1 <= year <= 9999


def _jdn(ay, m, d):
    a = (14 - m) // 12
    y4 = ay + 4800 - a
    m4 = m + 12 * a - 3
    if (ay, m, d) >= (1582, 10, 15):
        return d + (153 * m4 + 2) // 5 + 365 * y4 + y4 // 4 - y4 // 100 + y4 // 400 - 32045
    return d + (153 * m4 + 2) // 5 + 365 * y4 + y4 // 4 - 32083


def extreme_pillars(year, month, day, hour, minute, after23=1, hour_gan_next=1, zone_hours=8.0):
    """显示年(BC 为负,无 0 年)→ (年柱, 月柱, 日柱, 时柱, 子时干支)。"""
    from flatlib.ephem import swe as _swe
    from flatlib import const as _const
    ay = year + 1 if year < 0 else year
    jdn = _jdn(ay, month, day)
    jd_ut = jdn - 0.5 + (hour + minute / 60.0) / 24.0 - zone_hours / 24.0
    slon = _swe.sweObject(_const.SUN, jd_ut, _swe.SEDEFAULT_FLAG)['lon']
    mz = (int(((slon - 315.0) % 360.0) // 30.0) + 2) % 12
    y_pillar = ay - 1 if (month <= 2 and mz in (0, 1)) else ay
    yi = ((y_pillar - 4) % 60 + 60) % 60
    yTG = _TG[yi % 10] + _DZ[yi % 12]
    mg = ((yi % 10) % 5) * 2 + 2
    mTG = _TG[(mg + ((mz - 2) % 12)) % 10] + _DZ[mz]
    d_jdn = jdn + 1 if (hour == 23 and after23) else jdn
    di = ((d_jdn + 49) % 60 + 60) % 60
    dTG = _TG[di % 10] + _DZ[di % 12]
    hz = ((hour + 1) // 2) % 12
    if hour == 23:
        h_day_tg = (((jdn + 1 + 49) % 60 + 60) % 60) % 10 if hour_gan_next else di % 10
        hTG = _TG[(h_day_tg % 5 * 2) % 10] + _DZ[0]
    else:
        hTG = _TG[((di % 10) % 5 * 2 + hz) % 10] + _DZ[hz]
    ziTG = _TG[((di % 10) % 5 * 2) % 10] + _DZ[0]
    return yTG, mTG, dTG, hTG, ziTG


_JQMC = ['小寒', '大寒', '立春', '雨水', '驚蟄', '春分', '清明', '穀雨', '立夏', '小滿', '芒種', '夏至',
         '小暑', '大暑', '立秋', '處暑', '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至']


def solar_term_name(year, month, day, hour=0, minute=0, zone_hours=8.0):
    """域外「当前节气名」:swe 太阳视黄经直映射(小寒 285° 起每 15° 一名,繁体名与
    kin 系引擎 jqmc 逐字一致;口径=定气,与主链节气界相同)。"""
    from flatlib.ephem import swe as _swe
    from flatlib import const as _const
    ay = year + 1 if year < 0 else year
    jd_ut = _jdn(ay, month, day) - 0.5 + (hour + minute / 60.0) / 24.0 - zone_hours / 24.0
    slon = _swe.sweObject(_const.SUN, jd_ut, _swe.SEDEFAULT_FLAG)['lon']
    idx = int(((slon - 285.0) % 360.0) // 15.0)
    return _JQMC[idx]
