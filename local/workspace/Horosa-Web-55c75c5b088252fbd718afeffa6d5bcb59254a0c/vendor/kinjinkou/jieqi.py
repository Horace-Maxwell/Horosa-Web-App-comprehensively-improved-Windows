# -*- coding: utf-8 -*-
"""
節氣與干支計算模組
用於計算年月日時干支、節氣、農曆等資訊

參考自 kinliuren 項目 (https://github.com/kentang2017/kinliuren)
"""

import datetime
from itertools import cycle, repeat
import sxtwl
from sxtwl import fromSolar
import ephem

jqmc = ['小寒', '大寒', '立春', '雨水', '驚蟄', '春分', '清明', '穀雨', '立夏', '小滿', '芒種', '夏至', '小暑', '大暑', '立秋', '處暑', '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至']
tian_gan = '甲乙丙丁戊己庚辛壬癸'
di_zhi = '子丑寅卯辰巳午未申酉戌亥'


def jiazi():
    return [tian_gan[x % len(tian_gan)] + di_zhi[x % len(di_zhi)] for x in range(60)]


def multi_key_dict_get(d, k):
    for keys, v in d.items():
        if k in keys:
            return v
    return None


def new_list(olist, o):
    a = olist.index(o)
    return olist[a:] + olist[:a]


def repeat_list(n, thelist):
    return [repetition for i in thelist for repetition in repeat(i, n)]


# 節氣計算
def get_jieqi_start_date(year, month, day, hour, minute):
    d = sxtwl.fromSolar(year, month, day)
    if d.hasJieQi():
        jq_index = d.getJieQi()
        jd = d.getJieQiJD()
        t = sxtwl.JD2DD(jd)
        return {
            "年": t.Y, "月": t.M, "日": t.D,
            "時": int(t.h), "分": min(round(t.m), 59),
            "節氣": jqmc[jq_index - 1],
            "時間": datetime.datetime(t.Y, t.M, t.D, int(t.h), min(round(t.m), 59))
        }
    else:
        current_day = d
        while True:
            current_day = current_day.before(1)
            if current_day.hasJieQi():
                jq_index = current_day.getJieQi()
                jd = current_day.getJieQiJD()
                t = sxtwl.JD2DD(jd)
                return {
                    "年": t.Y, "月": t.M, "日": t.D,
                    "時": int(t.h), "分": min(round(t.m), 59),
                    "節氣": jqmc[jq_index - 1],
                    "時間": datetime.datetime(t.Y, t.M, t.D, int(t.h), min(round(t.m), 59))
                }


def get_before_jieqi_start_date(year, month, day, hour, minute):
    d = sxtwl.fromSolar(year, month, day)
    current_day = d.before(15)
    while True:
        if current_day.hasJieQi():
            jq_index = current_day.getJieQi()
            jd = current_day.getJieQiJD()
            t = sxtwl.JD2DD(jd)
            return {
                "年": t.Y, "月": t.M, "日": t.D,
                "時": int(t.h), "分": min(round(t.m), 59),
                "節氣": jqmc[jq_index - 1],
                "時間": datetime.datetime(t.Y, t.M, t.D, int(t.h), min(round(t.m), 59))
            }
        current_day = current_day.before(1)


def get_next_jieqi_start_date(year, month, day, hour, minute):
    d = sxtwl.fromSolar(year, month, day)
    current_day = d.after(1)
    while True:
        if current_day.hasJieQi():
            jq_index = current_day.getJieQi()
            jd = current_day.getJieQiJD()
            t = sxtwl.JD2DD(jd)
            return {
                "年": t.Y, "月": t.M, "日": t.D,
                "時": int(t.h), "分": min(round(t.m), 59),
                "節氣": jqmc[jq_index - 1],
                "時間": datetime.datetime(t.Y, t.M, t.D, int(t.h), min(round(t.m), 59))
            }
        current_day = current_day.after(1)


def jq(year, month, day, hour, minute):
    if year < 1 or year > 9999:
        # 全年份域回退:swe 太阳视黄经直映射节气名(与主链定气口径一致;域内原路径零变)
        from kin_year_domain import solar_term_name
        return solar_term_name(year, month, day, hour, minute)
    current_datetime = datetime.datetime(year, month, day, hour, minute)
    jq_start_dict = get_jieqi_start_date(year, month, day, hour, minute)
    next_jq_start_dict = get_next_jieqi_start_date(year, month, day, hour, minute)
    jq_start_datetime = jq_start_dict["時間"]
    next_jq_start_datetime = next_jq_start_dict["時間"]
    jq_name = jq_start_dict["節氣"]
    if jq_start_datetime <= current_datetime < next_jq_start_datetime:
        return jq_name
    elif current_datetime < jq_start_datetime:
        prev_jq_start_dict = get_before_jieqi_start_date(year, month, day, hour, minute)
        return prev_jq_start_dict["節氣"]
    else:
        return jq_name


# 農曆
def lunar_year_to_chinese(year):
    """將農曆年份數字轉換為中文數字表示，例如 2024 → 二〇二四"""
    digit_map = {'0': '〇', '1': '一', '2': '二', '3': '三', '4': '四',
                 '5': '五', '6': '六', '7': '七', '8': '八', '9': '九'}
    return ''.join(digit_map[d] for d in str(year))


def lunar_day_to_chinese(day):
    """將農曆日期數字轉換為傳統中文表示，例如 1→初一, 15→十五, 21→廿一, 30→三十"""
    units = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十']
    if 1 <= day <= 10:
        return '初' + units[day]
    elif 11 <= day <= 19:
        return '十' + units[day - 10]
    elif day == 20:
        return '二十'
    elif 21 <= day <= 29:
        return '廿' + units[day - 20]
    elif day == 30:
        return '三十'
    else:
        return str(day)


def lunar_date_d(year, month, day):
    lunar_m = ['占位', '正月', '二月', '三月', '四月', '五月', '六月',
               '七月', '八月', '九月', '十月', '冬月', '腊月']
    d = fromSolar(year, month, day)
    return {
        "年": d.getLunarYear(),
        "農曆月": lunar_m[int(d.getLunarMonth())],
        "月": d.getLunarMonth(),
        "日": d.getLunarDay()
    }


# 五虎遁，起寅月
def find_lunar_month(year_gz):
    fivetigers = {
        tuple(list('甲己')): '丙寅',
        tuple(list('乙庚')): '戊寅',
        tuple(list('丙辛')): '庚寅',
        tuple(list('丁壬')): '壬寅',
        tuple(list('戊癸')): '甲寅'
    }
    if multi_key_dict_get(fivetigers, year_gz[0]) is None:
        result = multi_key_dict_get(fivetigers, year_gz[1])
    else:
        result = multi_key_dict_get(fivetigers, year_gz[0])
    return dict(zip(list(range(1, 13)), new_list(jiazi(), result)[:12]))


# 五鼠遁，起子時
def find_lunar_hour(day_gz):
    fiverats = {
        tuple(list('甲己')): '甲子',
        tuple(list('乙庚')): '丙子',
        tuple(list('丙辛')): '戊子',
        tuple(list('丁壬')): '庚子',
        tuple(list('戊癸')): '壬子'
    }
    if multi_key_dict_get(fiverats, day_gz[0]) is None:
        result = multi_key_dict_get(fiverats, day_gz[1])
    else:
        result = multi_key_dict_get(fiverats, day_gz[0])
    return dict(zip(list(di_zhi), new_list(jiazi(), result)[:12]))


# 五狗遁，起子時
def find_lunar_minute(hour_gz):
    fivedogs = {
        tuple(list('甲己')): '甲戌',
        tuple(list('乙庚')): '丙戌',
        tuple(list('丙辛')): '戊戌',
        tuple(list('丁壬')): '庚戌',
        tuple(list('戊癸')): '壬戌'
    }
    if multi_key_dict_get(fivedogs, hour_gz[0]) is None:
        result = multi_key_dict_get(fivedogs, hour_gz[1])
    else:
        result = multi_key_dict_get(fivedogs, hour_gz[0])
    return new_list(jiazi(), result)


# 分干支
def minutes_jiazi_d(hour_gz):
    t = [f"{h}:{m}" for h in range(24) for m in range(60)]
    minutelist = dict(zip(t, cycle(repeat_list(1, find_lunar_minute(hour_gz)))))
    return minutelist


# v2.2.1: 全局日界 + 晚子时·时柱起干 thread-local (由 webjinkousrv 每请求设定)。
import threading as _threading
_TLS = _threading.local()

def set_after23_new_day(value):
    _TLS.after23 = 1 if value else 0

def set_hour_gan_use_next_day(value):
    _TLS.hour_gan_next = 1 if value else 0

def _get_after23():
    return getattr(_TLS, 'after23', 1)

def _get_hour_gan_next():
    return getattr(_TLS, 'hour_gan_next', 1)

def _cdate_for_day_jk(year, month, day, hour):
    if hour == 23 and _get_after23():
        d = ephem.Date(round((ephem.Date("{}/{}/{} {}:00:00.00".format(
            str(year).zfill(4), str(month).zfill(2),
            str(day + 1).zfill(2), str(0).zfill(2)))), 3))
    else:
        d = ephem.Date("{}/{}/{} {}:00:00.00".format(
            str(year).zfill(4), str(month).zfill(2),
            str(day).zfill(2), str(hour).zfill(2)))
    return d

def _hour_stem_override_jk(year, month, day, hour, cdate_day):
    """lateZi=1(默认): 时干始终用次日日干。lateZi=0: 跟随日柱的 cdate。"""
    if hour != 23:
        return None
    after23 = _get_after23()
    hour_gan_next = _get_hour_gan_next()
    if hour_gan_next:
        if after23:
            day_tg_idx = cdate_day.getDayGZ().tg
        else:
            d_next = ephem.Date(round((ephem.Date("{}/{}/{} 00:00:00.00".format(
                str(year).zfill(4), str(month).zfill(2), str(day+1).zfill(2)))), 3))
            dd_next = list(d_next.tuple())
            day_tg_idx = fromSolar(dd_next[0], dd_next[1], dd_next[2]).getDayGZ().tg
    else:
        # lateZi=0: 跟日柱一致
        day_tg_idx = cdate_day.getDayGZ().tg
    return tian_gan[(day_tg_idx % 5 * 2 + 0) % 10] + di_zhi[0]

# 換算干支（不含分）
def gangzhi1(year, month, day, hour, minute):
    if year < 1 or year > 9999:
        # 全年份域回退(共享件,口径与主链一致;域内原路径零变)
        from kin_year_domain import extreme_pillars
        _y, _m, _d, _h, _zi = extreme_pillars(year, month, day, hour, minute, after23=1, hour_gan_next=1)
        try:
            _gm = minutes_jiazi_d(_zi).get(str(hour) + ":" + str(minute))
        except Exception:
            _gm = None
        return [_y, _m, _d, _h, _gm]

    d = _cdate_for_day_jk(year, month, day, hour)
    dd = list(d.tuple())
    cdate = fromSolar(dd[0], dd[1], dd[2])
    yTG = "{}{}".format(tian_gan[cdate.getYearGZ().tg], di_zhi[cdate.getYearGZ().dz])
    mTG = "{}{}".format(tian_gan[cdate.getMonthGZ().tg], di_zhi[cdate.getMonthGZ().dz])
    dTG = "{}{}".format(tian_gan[cdate.getDayGZ().tg], di_zhi[cdate.getDayGZ().dz])
    hTG = "{}{}".format(tian_gan[cdate.getHourGZ(dd[3]).tg], di_zhi[cdate.getHourGZ(dd[3]).dz])
    _h_override = _hour_stem_override_jk(year, month, day, hour, cdate)
    if _h_override is not None:
        hTG = _h_override
    # sxtwl 的 getMonthGZ() 在 1900 年以前不準確，改用五虎遁從年干推算月干支
    if year < 1900:
        mTG1 = find_lunar_month(yTG).get(lunar_date_d(year, month, day).get("月"))
    else:
        mTG1 = mTG
    if _h_override is not None:
        hTG1 = hTG  # v2.2.1: lateZi 直接生效
    else:
        hTG1 = find_lunar_hour(dTG).get(hTG[1])
    return [yTG, mTG1, dTG, hTG1]


# 換算干支（含分）
def gangzhi(year, month, day, hour, minute):
    if year < 1 or year > 9999:
        # 全年份域回退(共享件,口径与主链一致;域内原路径零变)
        from kin_year_domain import extreme_pillars
        _y, _m, _d, _h, _zi = extreme_pillars(year, month, day, hour, minute, after23=1, hour_gan_next=1)
        try:
            _gm = minutes_jiazi_d(_zi).get(str(hour) + ":" + str(minute))
        except Exception:
            _gm = None
        return [_y, _m, _d, _h, _gm]

    d = _cdate_for_day_jk(year, month, day, hour)
    dd = list(d.tuple())
    cdate = fromSolar(dd[0], dd[1], dd[2])
    yTG = "{}{}".format(tian_gan[cdate.getYearGZ().tg], di_zhi[cdate.getYearGZ().dz])
    mTG = "{}{}".format(tian_gan[cdate.getMonthGZ().tg], di_zhi[cdate.getMonthGZ().dz])
    dTG = "{}{}".format(tian_gan[cdate.getDayGZ().tg], di_zhi[cdate.getDayGZ().dz])
    hTG = "{}{}".format(tian_gan[cdate.getHourGZ(dd[3]).tg], di_zhi[cdate.getHourGZ(dd[3]).dz])
    _h_override = _hour_stem_override_jk(year, month, day, hour, cdate)
    if _h_override is not None:
        hTG = _h_override
    # sxtwl 的 getMonthGZ() 在 1900 年以前不準確，改用五虎遁從年干推算月干支
    if year < 1900:
        mTG1 = find_lunar_month(yTG).get(lunar_date_d(year, month, day).get("月"))
    else:
        mTG1 = mTG
    if _h_override is not None:
        hTG1 = hTG  # v2.2.1: lateZi 直接生效
    else:
        hTG1 = find_lunar_hour(dTG).get(hTG[1])
    zi = gangzhi1(year, month, day, 0, 0)[3]
    gangzhi_minute = minutes_jiazi_d(zi)["{}:{}".format(hour, minute)]
    return [yTG, mTG1, dTG, hTG1, gangzhi_minute]
