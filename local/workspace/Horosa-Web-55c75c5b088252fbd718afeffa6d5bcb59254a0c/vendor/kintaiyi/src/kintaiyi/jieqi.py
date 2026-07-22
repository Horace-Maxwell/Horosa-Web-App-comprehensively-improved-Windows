# -*- coding: utf-8 -*-
"""
Created on Tue May  9 20:32:01 2023

@author: kentang
"""

import re
import math
import datetime
from itertools import cycle, repeat
import  sxtwl
from sxtwl import fromSolar
import ephem
from ephem import Sun, Date, Ecliptic, Equatorial
from . import config


jqmc = ['小寒', '大寒', '立春', '雨水', '驚蟄', '春分', '清明', '穀雨', '立夏', '小滿', '芒種', '夏至', '小暑', '大暑', '立秋', '處暑', '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至']
tian_gan = '甲乙丙丁戊己庚辛壬癸'
di_zhi = '子丑寅卯辰巳午未申酉戌亥'

#%% 甲子平支
# horosa_kin_jiazi_const_v1(PERF-R10 B2):六十甲子/刻表是编译期常量,原实现每次调用重建
# (60 次 lambda+format / 每刻表 144 键 dict)。copy-return(list(_C)/dict(cached))与逐次
# 重建逐字节等价 —— 「每次新容器」契约保持,调用点变异审计降级为纵深防御。
# kill:HOROSA_KIN_JIAZI_CONST=0 ⇒ 原实现原文路径。
# 勿重复劳动:kinwangji 两树与 kinastro/astro/wangji、kinastro/astro/bazi 上游已做
# (@lru_cache/_JIAZI_SEQ);kinjinkou 平铺 jieqi.py 与 kinastro/astro/sanshi/kinliuren*.py
# 是服务死代码(import 图核实,只被 streamlit app 引用)。
import os as _os
_KIN_CONST_ON = _os.environ.get('HOROSA_KIN_JIAZI_CONST', '1').lower() not in ('0', 'false', 'no', 'off')
_JIAZI_CONST = ["{}{}".format(tian_gan[x % len(tian_gan)], di_zhi[x % len(di_zhi)]) for x in range(60)]
_KE_JIAZI_CACHE = {}

def jiazi():
    if not _KIN_CONST_ON:
        return list(map(lambda x: "{}{}".format(tian_gan[x % len(tian_gan)],di_zhi[x % len(di_zhi)]),list(range(60))))
    return list(_JIAZI_CONST)


def multi_key_dict_get(d, k):
    for keys, v in d.items():
        if k in keys:
            return v
    return None

def new_list(olist, o):
    a = olist.index(o)
    res1 = olist[a:] + olist[:a]
    return res1
#%% 節氣計算
def get_jieqi_start_date(year, month, day, hour, minute):
    day = sxtwl.fromSolar(year, month, day)
    if day.hasJieQi():
        jq_index = day.getJieQi()
        jd = day.getJieQiJD()
        t = sxtwl.JD2DD(jd)
        return {
            "年": t.Y,
            "月": t.M,
            "日": t.D,
            "時": int(t.h),
            "分": round(t.m),
            "節氣": jqmc[jq_index-1],
            "時間":datetime.datetime(t.Y, t.M, t.D, int(t.h), round(t.m))
        }
    else:
        current_day = day
        while True:
            current_day = current_day.before(1)
            if current_day.hasJieQi():
                jq_index = current_day.getJieQi()
                jd = current_day.getJieQiJD()
                t = sxtwl.JD2DD(jd)
                return {
                    "年": t.Y,
                    "月": t.M,
                    "日": t.D,
                    "時": int(t.h),
                    "分": round(t.m),
                    "節氣": jqmc[jq_index-1],
                    "時間":datetime.datetime(t.Y, t.M, t.D, int(t.h), round(t.m))
                }
            
def get_before_jieqi_start_date(year, month, day, hour, minute):
    day = sxtwl.fromSolar(year, month, day)
    current_day = day.before(15)
    while True:
        if current_day.hasJieQi():
            jq_index = current_day.getJieQi()
            jd = current_day.getJieQiJD()
            t = sxtwl.JD2DD(jd)
            return {
                "年": t.Y,
                "月": t.M,
                "日": t.D,
                "時": int(t.h),
                "分": round(t.m),
                "節氣": jqmc[jq_index-1],
                "時間":datetime.datetime(t.Y, t.M, t.D, int(t.h), round(t.m))
            }
        current_day = current_day.before(1)

def get_next_jieqi_start_date(year, month, day, hour, minute):
    day = sxtwl.fromSolar(year, month, day)
    current_day = day.after(1)
    while True:
        if current_day.hasJieQi():
            jq_index = current_day.getJieQi()
            jd = current_day.getJieQiJD()
            t = sxtwl.JD2DD(jd)
            return {
                "年": t.Y,
                "月": t.M,
                "日": t.D,
                "時": int(t.h),
                "分": round(t.m),
                "節氣": jqmc[jq_index-1],
                "時間":datetime.datetime(t.Y, t.M, t.D, int(t.h), round(t.m))
            }
        current_day = current_day.after(1)


def jq(year, month, day, hour, minute):
    if year < 1 or year > 9999:
        # 全年份域回退:swe 太阳视黄经直映射节气名(与主链定气口径一致;域内原路径零变)
        from kin_year_domain import solar_term_name
        return solar_term_name(year, month, day, hour, minute)
    try:
        current_datetime = datetime.datetime(year, month, day, hour, minute)
        jq_start_dict = get_jieqi_start_date(year, month, day, hour, minute)
        next_jq_start_dict = get_next_jieqi_start_date(year, month, day, hour, minute)
        if not (isinstance(jq_start_dict, dict) and isinstance(next_jq_start_dict, dict) and 
                "時間" in jq_start_dict and "時間" in next_jq_start_dict and
                "節氣" in jq_start_dict and "節氣" in next_jq_start_dict):
            raise ValueError(f"Invalid jieqi dictionary format for {year}-{month}-{day} {hour}:{minute}")
        
        jq_start_datetime = jq_start_dict["時間"]
        next_jq_start_datetime = next_jq_start_dict["時間"]
        jq_name = jq_start_dict["節氣"]
        
        if not (isinstance(jq_start_datetime, datetime.datetime) and isinstance(next_jq_start_datetime, datetime.datetime)):
            raise ValueError(f"Jieqi times are not datetime objects: {jq_start_datetime}, {next_jq_start_datetime}")
        
        # Check if current_datetime is within the current jieqi period
        if jq_start_datetime <= current_datetime < next_jq_start_datetime:
            return jq_name
        # If before the current jieqi start, get the previous jieqi
        elif current_datetime < jq_start_datetime:
            prev_jq_start_dict = get_before_jieqi_start_date(year, month, day, hour, minute)
            if not (isinstance(prev_jq_start_dict, dict) and "節氣" in prev_jq_start_dict):
                raise ValueError(f"Invalid previous jieqi dictionary format for {year}-{month}-{day}")
            return prev_jq_start_dict["節氣"]
        else:
            raise ValueError(f"Current datetime {current_datetime} not within any valid jieqi period")
    except Exception as e:
        raise ValueError(f"Error in jq for {year}-{month}-{day} {hour}:{minute}: {str(e)}")

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

def repeat_list(n, thelist):
    return [repetition for i in thelist for repetition in repeat(i,n)]


#五虎遁，起正月
def find_lunar_month(year):
    fivetigers = {
    tuple(list('甲己')):'丙寅',
    tuple(list('乙庚')):'戊寅',
    tuple(list('丙辛')):'庚寅',
    tuple(list('丁壬')):'壬寅',
    tuple(list('戊癸')):'甲寅'
    }
    if multi_key_dict_get(fivetigers, year[0]) == None:
        result = multi_key_dict_get(fivetigers, year[1])
    else:
        result = multi_key_dict_get(fivetigers, year[0])
    return dict(zip(range(1,13),new_list(jiazi(), result)[:12]))

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
    return dict(zip(list(di_zhi), new_list(jiazi(), result)[:12]))

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

#農曆
def lunar_date_d(year, month, day):
    lunar_m = ['占位', '正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月']
    day = fromSolar(year, month, day)
    return {"年":day.getLunarYear(),
            "農曆月": lunar_m[int(day.getLunarMonth())],
            "月":day.getLunarMonth(),
            "日":day.getLunarDay()}

# v2.2.1: 全局日界 + 晚子时·时柱起干 thread-local 开关 (由 webtaiyisrv 每请求设定)。
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

def _cdate_for_day_taiyi(year, month, day, hour):
    """日柱 cdate:仅 hour==23 且 after23=1 时进位次日。"""
    after23 = _get_after23()
    if hour == 23 and after23:
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
    return d

def _hour_stem_override_taiyi(year, month, day, hour, cdate_day):
    """仅 hour==23 时按 lateZi 重写时柱;其它时刻返回 None NO-OP。
    lateZi=1(默认):时干始终用次日日干起子时。
    lateZi=0:时干跟随日柱所在 cdate 的日干(== 跟日柱一致)。"""
    if hour != 23:
        return None
    after23 = _get_after23()
    hour_gan_next = _get_hour_gan_next()
    if hour_gan_next:
        if after23:
            day_tg_idx = cdate_day.getDayGZ().tg
        else:
            d_next = ephem.Date(round((ephem.Date("{}/{}/{} 00:00:00.00".format(
                str(year).zfill(4),
                str(month).zfill(2),
                str(day+1).zfill(2)))),3))
            dd_next = list(d_next.tuple())
            day_tg_idx = fromSolar(dd_next[0], dd_next[1], dd_next[2]).getDayGZ().tg
    else:
        # lateZi=0: 跟日柱一致
        day_tg_idx = cdate_day.getDayGZ().tg
    hour_tg_idx = (day_tg_idx % 5 * 2 + 0) % 10
    return tian_gan[hour_tg_idx] + di_zhi[0]

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

    d = _cdate_for_day_taiyi(year, month, day, hour)
    dd = list(d.tuple())
    cdate = fromSolar(dd[0], dd[1], dd[2])
    yTG,mTG,dTG,hTG = "{}{}".format(
        tian_gan[cdate.getYearGZ().tg],
        di_zhi[cdate.getYearGZ().dz]), "{}{}".format(
            tian_gan[cdate.getMonthGZ().tg],
            di_zhi[cdate.getMonthGZ().dz]), "{}{}".format(
                tian_gan[cdate.getDayGZ().tg],
                di_zhi[cdate.getDayGZ().dz]), "{}{}".format(
                    tian_gan[cdate.getHourGZ(dd[3]).tg],
                    di_zhi[cdate.getHourGZ(dd[3]).dz])
    _h_override = _hour_stem_override_taiyi(year, month, day, hour, cdate)
    if _h_override is not None:
        hTG = _h_override
    if year < 1900:
        mTG1 = find_lunar_month(yTG).get(lunar_date_d(year, month, day).get("月"))
    else:
        mTG1 = mTG
    if _h_override is not None:
        hTG1 = hTG  # v2.2.1: lateZi 直接生效到 hTG1
    else:
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

    d = _cdate_for_day_taiyi(year, month, day, hour)
    dd = list(d.tuple())
    cdate = fromSolar(dd[0], dd[1], dd[2])
    yTG,mTG,dTG,hTG = "{}{}".format(
        tian_gan[cdate.getYearGZ().tg],
        di_zhi[cdate.getYearGZ().dz]), "{}{}".format(
            tian_gan[cdate.getMonthGZ().tg],
            di_zhi[cdate.getMonthGZ().dz]), "{}{}".format(
                tian_gan[cdate.getDayGZ().tg],
                di_zhi[cdate.getDayGZ().dz]), "{}{}".format(
                    tian_gan[cdate.getHourGZ(dd[3]).tg],
                    di_zhi[cdate.getHourGZ(dd[3]).dz])
    _h_override = _hour_stem_override_taiyi(year, month, day, hour, cdate)
    if _h_override is not None:
        hTG = _h_override
    if year < 1900:
        mTG1 = find_lunar_month(yTG).get(lunar_date_d(year, month, day).get("月"))
    else:
        mTG1 = mTG
    if _h_override is not None:
        hTG1 = hTG  # v2.2.1: lateZi 直接生效到 hTG1
    else:
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


jieqi_name = re.findall('..', '春分清明穀雨立夏小滿芒種夏至小暑大暑立秋處暑白露秋分寒露霜降立冬小雪大雪冬至小寒大寒立春雨水驚蟄')

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

def gong_wangzhuai(j_q):
    wangzhuai = list("旺相胎沒死囚休廢")
    wangzhuai_num = [3,4,9,2,7,6,1,8]
    wangzhuai_jieqi = {('春分','清明','穀雨'):'春分',
                        ('立夏','小滿','芒種'):'立夏',
                        ('夏至','小暑','大暑'):'夏至',
                        ('立秋','處暑','白露'):'立秋',
                        ('秋分','寒露','霜降'):'秋分',
                        ('立冬','小雪','大雪'):'立冬',
                        ('冬至','小寒','大寒'):'冬至',
                        ('立春','雨水','驚蟄'):'立春'}
    return dict(zip(config.new_list(wangzhuai_num, dict(zip(jieqi_name[0::3],wangzhuai_num )).get(config.multi_key_dict_get(wangzhuai_jieqi, j_q))), wangzhuai))

def xzdistance(year, month, day, hour):
    return int(find_jq_date(year, month, day, hour, "夏至") -  Date("{}/{}/{} {}:00:00.00".format(str(year).zfill(4), str(month).zfill(2), str(day).zfill(2), str(hour).zfill(2))))

def distancejq(year, month, day, hour, minute, jq):
    return int( Date("{}/{}/{} {}:{}:00.00".format(str(year).zfill(4), str(month).zfill(2), str(day).zfill(2), str(hour).zfill(2), str(minute).zfill(2))) - find_jq_date(year-1, month, day, hour, minute, jq) )

def jq_count_days(year, month, day, hour, minute):#从当前时间开始连续输出未来n个节气的时间
    #current =  datetime.strptime("{}/{}/{} {}:{}:00".format(str(year).zfill(4), str(month).zfill(2), str(day).zfill(2),str(hour).zfill(2), str(minute).zfill(2)), '%Y/%m/%d %H:%M:%S')
    current = Date("{}/{}/{} {}:{}:00".format(str(year).zfill(4), str(month).zfill(2), str(day).zfill(2),str(hour).zfill(2), str(minute).zfill(2)))
    jd = change(year, month, day, hour, minute)
    #jd = Date("{}/{}/{} {}:{}:00.00".format(str(b.year).zfill(4), str(b.month).zfill(2), str(b.day).zfill(2), str(b.hour).zfill(2), str(b.minute).zfill(2)  ))
    result = []
    e=ecliptic_lon(jd)
    n=int(e*180.0/math.pi/15)+1
    for i in range(3):
        if n>=24:
            n-=24
        jd=iteration(jd,sta)
        d=Date(jd+1/3).tuple()
        dt = Date("{}/{}/{} {}:{}:00.00".format(d[0],d[1],d[2],d[3],d[4]).split(".")[0])
        time_info = {  dt:jieqi_name[n]}
        n+=1    
        result.append(time_info)
    j = [list(i.keys())[0] for i in result]
    if current > j[0] and current > j[1] and current > j[2]:
        return list(result[2].values())[0],  int(current - list(result[2].keys())[0] )
    if current > j[0] and current > j[1] and current <= j[2]:
        return int(current - list(result[1].keys())[0] )+1
    if current >= j[1] and current < j[2]:
        return list(result[1].values())[0], int(current - list(result[1].keys())[0] )
    if current < j[1] and current < j[2]:
        return list(result[0].values())[0], int(current - list(result[0].keys())[0] )



