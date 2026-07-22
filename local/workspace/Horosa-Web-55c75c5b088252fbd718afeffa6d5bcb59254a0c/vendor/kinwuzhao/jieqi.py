# -*- coding: utf-8 -*-
"""節氣計算模組 — 基於天文曆法精確推算二十四節氣。

@author: kentang
"""

from __future__ import annotations

import re
import math
import ephem
from ephem import Sun, Date, Ecliptic, Equatorial
from sxtwl import fromSolar, JD2DD
from datetime import datetime
from itertools import cycle, repeat
import config

tiangan = list('甲乙丙丁戊己庚辛壬癸')
dizhi = list('子丑寅卯辰巳午未申酉戌亥')

jqmc = ["冬至", "小寒", "大寒", "立春", "雨水", "驚蟄", "春分", "清明", "谷雨", "立夏",
     "小滿", "芒種", "夏至", "小暑", "大暑", "立秋", "處暑","白露", "秋分", "寒露", "霜降", 
     "立冬", "小雪", "大雪"]
# 12「節」(每月之首,逢之換月柱;立春兼換年柱)。其餘12「氣」不換月柱。
JIE_TERMS = {"立春", "驚蟄", "清明", "立夏", "芒種", "小暑", "立秋", "白露", "寒露", "立冬", "大雪", "小寒"}
jieqi_name = re.findall('..', '春分清明穀雨立夏小滿芒種夏至小暑大暑立秋處暑白露秋分寒露霜降立冬小雪大雪冬至小寒大寒立春雨水驚蟄')

def multi_key_dict_get(d, k):
    for keys, v in d.items():
        if k in keys:
            return v
    return None

def new_list(olist, o):
    a = olist.index(o)
    res1 = olist[a:] + olist[:a]
    return res1

def ecliptic_lon(jd_utc):
    s=Sun(jd_utc)
    equ=Equatorial(s.ra,s.dec,epoch=jd_utc)
    e=Ecliptic(equ)
    return e.lon

def sta(jd):
    e=ecliptic_lon(jd)
    n=int(e*180.0/math.pi/15)
    return n

def iteration(jd,sta):
    s1=sta(jd)
    s0=s1
    dt=1.0
    while True:
        jd+=dt
        s=sta(jd)
        if s0!=s:
            s0=s
            dt=-dt/2
        if abs(dt)<0.0000001 and s!=s1:
            break
    return jd

 
def find_season(jq):    
    s = { 
     ('立春','春分','雨水', '驚蟄','穀雨','清明'):"春",
     ('立夏','小滿','芒種', '夏至','小暑','大暑'):"夏",
     ('立秋','處暑','白露', '秋分','寒露','霜降'):"秋",
     ('立冬','小雪','大雪', '冬至','小寒','大寒'):"冬"
    }
    return config.multi_key_dict_get(s, jq)

def change(year, month, day, hour, minute):
    changets = Date("{}/{}/{} {}:{}:00".format(str(year).zfill(4), str(month).zfill(2), str(day).zfill(2),str(hour).zfill(2), str(minute).zfill(2)))
    return Date(changets - 24 * ephem.hour *30)

def find_jq_date(year, month, day, hour, minute,jieqi):#从当前时间开始连续输出未来n个节气的时间
    current = Date("{}/{}/{} {}:{}:00".format(str(year).zfill(4), str(month).zfill(2), str(day).zfill(2),str(hour).zfill(2), str(minute).zfill(2)))
    jd = change(year, month, day, hour, minute)
    #jd = Date("{}/{}/{} {}:{}:00.00".format(str(b.year).zfill(4), str(b.month).zfill(2), str(b.day).zfill(2), str(b.hour).zfill(2), str(b.minute).zfill(2)  ))
    result = {}
    e=ecliptic_lon(jd)
    n=int(e*180.0/math.pi/15)+1
    for i in range(24):
        if n>=24:
            n-=24
        jd=iteration(jd,sta)
        d=Date(jd+1/3).tuple()
        dt = Date("{}/{}/{} {}:{}:00.00".format(d[0],d[1],d[2],d[3],d[4]).split(".")[0])
        time_info = {  jieqi_name[n]:dt}
        n+=1    
        result.update(time_info)
    return Date(result.get(jieqi))

def distancejq(year, month, day, hour, minute, jq):
    return int( Date("{}/{}/{} {}:{}:00.00".format(str(year).zfill(4), str(month).zfill(2), str(day).zfill(2), str(hour).zfill(2), str(minute).zfill(2))) - find_jq_date(year-1, month, day, hour, minute, jq) )


def jq(year, month, day, hour, minute):
    if year < 1 or year > 9999:
        # 全年份域回退:swe 太阳视黄经直映射节气名(与主链定气口径一致;域内原路径零变)
        from kin_year_domain import solar_term_name
        return solar_term_name(year, month, day, hour, minute)
    """計算指定日期時間所在的節氣。

    從指定時間向前推算，找到最近的三個節氣交界點，
    依據時間落在哪個區間判斷當前節氣。

    Args:
        year: 年份。
        month: 月份 (1-12)。
        day: 日 (1-31)。
        hour: 小時 (0-23)。
        minute: 分鐘 (0-59)。

    Returns:
        當前節氣名稱。
    """
    current = Date("{}/{}/{} {}:{}:00".format(
        str(year).zfill(4), str(month).zfill(2), str(day).zfill(2),
        str(hour).zfill(2), str(minute).zfill(2)))
    jd = change(year, month, day, hour, minute)
    result = []
    e = ecliptic_lon(jd)
    n = int(e * 180.0 / math.pi / 15) + 1
    for i in range(3):
        if n >= 24:
            n -= 24
        jd = iteration(jd, sta)
        d = Date(jd + 1 / 3).tuple()
        dt = Date("{}/{}/{} {}:{}:00.00".format(d[0], d[1], d[2], d[3], d[4]).split(".")[0])
        time_info = {dt: jieqi_name[n]}
        n += 1
        result.append(time_info)

    j = [list(i.keys())[0] for i in result]

    # 強化邊界處理：確保所有條件分支都有返回值
    if current > j[0] and current > j[1] and current > j[2]:
        # 當前時間在所有三個節氣之後
        return list(result[2].values())[0]
    elif current > j[0] and current > j[1]:
        # 當前時間在第二、三節氣之間
        return list(result[1].values())[0]
    elif current > j[0]:
        # 當前時間在第一、二節氣之間
        return list(result[0].values())[0]
    else:
        # 當前時間在第一個節氣之前——回退取前一個節氣
        # 使用 jieqi_name 向前回繞
        first_jq = list(result[0].values())[0]
        first_idx = jieqi_name.index(first_jq)
        prev_idx = (first_idx - 1) % len(jieqi_name)
        return jieqi_name[prev_idx]

def gong_wangzhuai(j_q):
    wangzhuai = list("旺相胎沒死囚休廢")
    #wangzhuai_num = [3,4,9,2,7,6,1,8]
    wangzhuai_num = list("震巽離坤兌乾坎艮")
    wangzhuai_jieqi = {('春分','清明','穀雨'):'春分',
                        ('立夏','小滿','芒種'):'立夏',
                        ('夏至','小暑','大暑'):'夏至',
                        ('立秋','處暑','白露'):'立秋',
                        ('秋分','寒露','霜降'):'秋分',
                        ('立冬','小雪','大雪'):'立冬',
                        ('冬至','小寒','大寒'):'冬至',
                        ('立春','雨水','驚蟄'):'立春'}
    r1 = dict(zip(new_list(wangzhuai_num, dict(zip(jieqi_name[0::3],wangzhuai_num )).get(multi_key_dict_get(wangzhuai_jieqi, j_q))), wangzhuai))
    r2 = {v: k for k, v in r1.items()}
    return r1, r2

def gong_wangzhuai1(j_q):
    wangzhuai = list("旺相胎沒死囚休廢")
    wangzhuai_num = [3,4,9,2,7,6,1,8]
    #wangzhuai_num = list("震巽離坤兌乾坎艮")
    wangzhuai_jieqi = {('春分','清明','穀雨'):'春分',
                        ('立夏','小滿','芒種'):'立夏',
                        ('夏至','小暑','大暑'):'夏至',
                        ('立秋','處暑','白露'):'立秋',
                        ('秋分','寒露','霜降'):'秋分',
                        ('立冬','小雪','大雪'):'立冬',
                        ('冬至','小寒','大寒'):'冬至',
                        ('立春','雨水','驚蟄'):'立春'}
    r1 = dict(zip(new_list(wangzhuai_num, dict(zip(jieqi_name[0::3],wangzhuai_num )).get(multi_key_dict_get(wangzhuai_jieqi, j_q))), wangzhuai))
    r2 = {v: k for k, v in r1.items()}
    return r1, r2


#五鼠遁，起子時
def find_lunar_hour(day):
    fiverats = {
    tuple(list('甲己')):'甲子',
    tuple(list('乙庚')):'丙子',
    tuple(list('丙辛')):'戊子',
    tuple(list('丁壬')):'庚子',
    tuple(list('戊癸')):'壬子'
    }
    if multi_key_dict_get(fiverats, day[0]) == None:
        result = multi_key_dict_get(fiverats, day[1])
    else:
        result = multi_key_dict_get(fiverats, day[0])
    return dict(zip(list(dizhi), new_list(jiazi(), result)[:12]))
#五馬遁，起子刻
def find_lunar_ke(hour):
    fivehourses = {
    tuple(list('丙辛')):'甲午',
    tuple(list('丁壬')):'丙午',
    tuple(list('戊癸')):'戊午',
    tuple(list('甲己')):'庚午',
    tuple(list('乙庚')):'壬午'
    }
    if multi_key_dict_get(fivehourses, hour[0]) == None:
        result = multi_key_dict_get(fivehourses, hour[1])
    else:
        result = multi_key_dict_get(fivehourses, hour[0])
    return new_list(jiazi(), result)
     
# horosa_kin_jiazi_const_v1(PERF-R10 B2):编译期常量提升,copy-return 等价;
# 表缓存按参数键,dict() 浅拷贝保「每次新容器」契约。kill:HOROSA_KIN_JIAZI_CONST=0。
import os as _os
_KIN_CONST_ON = _os.environ.get('HOROSA_KIN_JIAZI_CONST', '1').lower() not in ('0', 'false', 'no', 'off')
_JIAZI_CONST = [tiangan[x % len(tiangan)] + dizhi[x % len(dizhi)] for x in range(60)]
_KE_JIAZI_CACHE = {}
_MINUTES_JIAZI_CONST = None

def ke_jiazi_d(hour):
    if _KIN_CONST_ON:
        cached = _KE_JIAZI_CACHE.get(hour)
        if cached is None:
            t = [f"{h}:{m}0" for h in range(24) for m in range(6)]
            cached = dict(zip(t, cycle(repeat_list(1, find_lunar_ke(hour)))))
            _KE_JIAZI_CACHE[hour] = cached
        return dict(cached)
    t = [f"{h}:{m}0" for h in range(24) for m in range(6)]
    minutelist = dict(zip(t, cycle(repeat_list(1, find_lunar_ke(hour)))))
    return minutelist

def jiazi():
    if _KIN_CONST_ON:
        return list(_JIAZI_CONST)
    jiazi = [tiangan[x % len(tiangan)] + dizhi[x % len(dizhi)] for x in range(60)]
    return jiazi
     
def repeat_list(n, thelist):
    return [repetition for i in thelist for repetition in repeat(i,n) ]
#分干支
def minutes_jiazi_d():
    global _MINUTES_JIAZI_CONST
    if _KIN_CONST_ON:
        if _MINUTES_JIAZI_CONST is None:
            t = []
            for h in range(0,24):
                for m in range(0,60):
                    t.append(str(h)+":"+str(m))
            _MINUTES_JIAZI_CONST = dict(zip(t, cycle(repeat_list(2, jiazi()))))
        return dict(_MINUTES_JIAZI_CONST)
    t = []
    for h in range(0,24):
        for m in range(0,60):
            b = str(h)+":"+str(m)
            t.append(b)
    minutelist = dict(zip(t, cycle(repeat_list(2, jiazi()))))
    return minutelist
     
#換算干支
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

    if hour == 23:
        d = ephem.Date(round((ephem.Date("{}/{}/{} {}:00:00.00".format(
            str(year).zfill(4),
            str(month).zfill(2),
            str(day+1).zfill(2),
            str(0).zfill(2)))),3))
    else:
        d = ephem.Date("{}/{}/{} {}:00:00.00".format(
            str(year).zfill(4),
            str(month).zfill(2),
            str(day).zfill(2),
            str(hour).zfill(2)))
    dd = list(d.tuple())
    cdate = fromSolar(dd[0], dd[1], dd[2])
    yTG,mTG,dTG,hTG = "{}{}".format(
        tiangan[cdate.getYearGZ().tg],
        dizhi[cdate.getYearGZ().dz]), "{}{}".format(
            tiangan[cdate.getMonthGZ().tg],
            dizhi[cdate.getMonthGZ().dz]), "{}{}".format(
                tiangan[cdate.getDayGZ().tg],
                dizhi[cdate.getDayGZ().dz]), "{}{}".format(
                    tiangan[cdate.getHourGZ(dd[3]).tg],
                    dizhi[cdate.getHourGZ(dd[3]).dz])
    if year < 1900:
        mTG1 = find_lunar_month(yTG).get(lunar_date_d(year, month, day).get("月"))
    else:
        mTG1 = mTG
    hTG1 = find_lunar_hour(dTG).get(hTG[1])
    return [yTG, mTG1, dTG, hTG1]

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

    if hour == 23:
        d = ephem.Date(round((ephem.Date("{}/{}/{} {}:00:00.00".format(
            str(year).zfill(4),
            str(month).zfill(2),
            str(day+1).zfill(2),
            str(0).zfill(2)))),3))
    else:
        d = ephem.Date("{}/{}/{} {}:00:00.00".format(
            str(year).zfill(4),
            str(month).zfill(2),
            str(day).zfill(2),
            str(hour).zfill(2)))
    dd = list(d.tuple())
    cdate = fromSolar(dd[0], dd[1], dd[2])
    yTG,mTG,dTG,hTG = "{}{}".format(
        tiangan[cdate.getYearGZ().tg],
        dizhi[cdate.getYearGZ().dz]), "{}{}".format(
            tiangan[cdate.getMonthGZ().tg],
            dizhi[cdate.getMonthGZ().dz]), "{}{}".format(
                tiangan[cdate.getDayGZ().tg],
                dizhi[cdate.getDayGZ().dz]), "{}{}".format(
                    tiangan[cdate.getHourGZ(dd[3]).tg],
                    dizhi[cdate.getHourGZ(dd[3]).dz])
    if year < 1900:
        mTG1 = find_lunar_month(yTG).get(lunar_date_d(year, month, day).get("月"))
    else:
        mTG1 = mTG
    # 月柱按精確交節時刻校正(同 kinqimen,對應上游 #53/#9):當日交「節」且給定時刻早於精確交節 →
    # 沿用前一日月柱(立春兼校年柱)。sxtwl 的 getMonthGZ 為日級,交節當日整日已跳新月。
    if year >= 1900:
        _sd = fromSolar(year, month, day)
        if _sd.hasJieQi() and jqmc[_sd.getJieQi()] in JIE_TERMS:
            _t = JD2DD(_sd.getJieQiJD())
            _crossing = datetime(_t.Y, _t.M, _t.D, int(_t.h), round(_t.m))
            if datetime(year, month, day, hour, minute) < _crossing:
                _prev = _sd.before(1)
                mTG1 = tiangan[_prev.getMonthGZ().tg] + dizhi[_prev.getMonthGZ().dz]
                if jqmc[_sd.getJieQi()] == '立春':
                    yTG = tiangan[_prev.getYearGZ().tg] + dizhi[_prev.getYearGZ().dz]
    hTG1 = find_lunar_hour(dTG).get(hTG[1])
    zi = gangzhi1(year, month, day, 0, 0)[3]
    if minute < 10 and minute >=0:
        reminute = "00"
    if minute < 20 and minute >=10:
        reminute = "10"
    if minute < 30 and minute >=20:
        reminute = "20"
    if minute < 40 and minute >=30:
        reminute = "30"
    if minute < 50 and minute >=40:
        reminute = "40"
    if minute < 60 and minute >=50:
        reminute = "50"
    hourminute = str(hour)+":"+str(reminute)
    gangzhi_minute = ke_jiazi_d(zi).get(hourminute)
    return [yTG, mTG1, dTG, hTG1, gangzhi_minute]

