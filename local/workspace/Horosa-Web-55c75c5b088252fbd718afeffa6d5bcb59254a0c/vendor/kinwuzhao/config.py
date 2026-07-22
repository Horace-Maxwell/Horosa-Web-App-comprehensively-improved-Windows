# -*- coding: utf-8 -*-
"""
Created on Fri Jun 27 11:18:45 2025

@author: kentang
"""


import re
import pickle
import itertools
from itertools import cycle, repeat, starmap
from datetime import date
import datetime
from ephem import Date
from sxtwl import fromSolar
from bidict import bidict


cmonth = list("一二三四五六七八九十") + ["十一","十二"]
cnum = list("一二三四五六七八九十")
#干支
tian_gan = '甲乙丙丁戊己庚辛壬癸'
di_zhi = '子丑寅卯辰巳午未申酉戌亥'

cheungsun = dict(zip(list("木火金水土"),list("亥寅巳申申")))
wuxing = "火水金火木金水土土木,水火火金金木土水木土,火火金金木木土土水水,火木水金木水土火金土,木火金水水木火土土金"
wuxing_relation_2 = dict(zip(list(map(lambda x: tuple(re.findall("..",x)), wuxing.split(","))), "尅我,我尅,比和,生我,我生".split(",")))
nayin = "甲子乙丑壬申癸酉庚辰辛巳甲午乙未壬寅癸卯庚戌辛亥,丙寅丁卯甲戌乙亥戊子己丑丙申丁酉甲辰乙巳戊午己未,戊辰己巳壬午癸未庚寅辛卯戊戌己亥壬子癸丑庚申辛酉,庚午辛未戊寅己卯丙戌丁亥庚子辛丑戊申己酉丙辰丁巳,甲申乙酉丙子丁丑甲寅乙卯丙午丁未壬戌癸亥壬辰癸巳".split(",")
nayin_wuxing = dict(zip([tuple(re.findall("..", i)) for i in nayin], list("金火木土水")))
zm = {tuple(list("卯辰巳午未申")):"朝", tuple(list("酉戌亥子丑寅")):"暮"}

epochdict = dict(zip([
            ('甲子', '甲午', '乙丑', '乙未', '丙寅', '丙申', '丁卯', '丁酉', '戊辰', '戊戌'),
            ('己巳', '己亥', '庚午', '庚子', '辛未', '辛丑', '壬申', '壬寅', '癸酉', '癸卯'),
            ('甲戌', '甲辰', '乙亥', '乙巳', '丙子', '丙午', '丁丑', '丁未', '戊寅', '戊申'),
            ('己卯', '己酉', '庚辰', '庚戌', '辛巳', '辛亥', '壬午', '壬子', '癸未', '癸丑'),
            ('甲申', '甲寅', '乙酉', '乙卯', '丙戌', '丙辰', '丁亥', '丁巳', '戊子', '戊午'),
            ('己丑', '己未', '庚寅', '庚申', '辛卯', '辛酉', '壬辰', '壬戌', '癸巳', '癸亥')],  list("一二三四五六")))

jiyuan_dict = dict(zip([('甲子', '甲午', '乙丑', '乙未', '丙寅', '丙申', '丁卯', '丁酉', '戊辰', '戊戌', '己巳', '己亥'),
                ('庚午', '庚子', '辛未', '辛丑', '壬申', '壬寅', '癸酉', '癸卯', '甲戌', '甲辰', '乙亥', '乙巳'),
                ('丙子', '丙午', '丁丑', '丁未', '戊寅', '戊申', '己卯', '己酉', '庚辰', '庚戌', '辛巳', '辛亥'),
                ('壬午', '壬子', '癸未', '癸丑', '甲申', '甲寅', '乙酉', '乙卯', '丙戌', '丙辰', '丁亥', '丁巳'),
                ('戊子', '戊午', '己丑', '己未', '庚寅', '庚申', '辛卯', '辛酉', '壬辰', '壬戌', '癸巳', '癸亥')], "甲子,丙子,戊子,庚子,壬子".split(",")))


#%% 基本功能函數
def sumlist(list1):
    list2 = []
    total_sum = 0
    for item in list1:
        total_sum += item
        list2.append(total_sum)
    return list2

#農曆
def lunar_date_d(year, month, day):
    lunar_m = ['占位', '正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月']
    day = fromSolar(year, month, day)
    return {"年":day.getLunarYear(),
            "農曆月": lunar_m[int(day.getLunarMonth())],
            "月":day.getLunarMonth(),
            "日":day.getLunarDay()}
#旬
def liujiashun_dict():
    return dict(zip(list(map(lambda x: tuple(x), list(map(lambda x:new_list(jiazi(), x)[0:10] ,jiazi()[0::10])))), jiazi()[0::10]))


def closest(lst, K):
    return lst[min(range(len(lst)), key = lambda i: abs(lst[i]-K))]

def closest1(lst, K):
    return lst[min(range(len(lst)), key = lambda i: abs(lst[i]-K))-1]

def closest2(lst, K):
    return lst[min(range(len(lst)), key = lambda i: abs(lst[i]-K))+1]

def multi_key_dict_get(d, k):
    for keys, v in d.items():
        if k in keys:
            return v
    return None

def new_list(olist, o):
    a = olist.index(o)
    res1 = olist[a:] + olist[:a]
    return res1

def gendatetime(year, month, day, hour, minute):
    return "{}年{}月{}日{}時{}分".format(year, month, day, hour, minute)

def repeat_list(n, thelist):
    return [repetition for i in thelist for repetition in repeat(i,n)]

#%% 甲子平支
# horosa_kin_jiazi_const_v1(PERF-R10 B2):编译期常量提升,copy-return 等价。
import os as _os
_KIN_CONST_ON = _os.environ.get('HOROSA_KIN_JIAZI_CONST', '1').lower() not in ('0', 'false', 'no', 'off')
_JIAZI_CONST = ["{}{}".format('甲乙丙丁戊己庚辛壬癸'[x % 10], '子丑寅卯辰巳午未申酉戌亥'[x % 12]) for x in range(60)]
_MINUTES_JIAZI_CACHE = {}

def jiazi():
    if not _KIN_CONST_ON:
        Gan, Zhi = '甲乙丙丁戊己庚辛壬癸', '子丑寅卯辰巳午未申酉戌亥'
        return list(map(lambda x: "{}{}".format(Gan[x % len(Gan)], Zhi[x % len(Zhi)]), list(range(60))))
    return list(_JIAZI_CONST)


def generate_ranges(start, n, num_ranges):
    ranges = []
    a = start
    for i in range(num_ranges):
        end = start + n - 1
        ranges.append(f"{start+1}-{end+1}")
        start = end + 1  # The next range starts right after the current end
    return ["1-{}".format(a)]+ranges

def Ganzhiwuxing(gangorzhi):
    ganzhiwuxing = dict(zip(list(map(lambda x: tuple(x),"甲寅乙卯震巽,丙巳丁午離,壬亥癸子坎,庚申辛酉乾兌,未丑戊己未辰戌艮坤".split(","))), list("木火水金土")))
    return multi_key_dict_get(ganzhiwuxing, gangorzhi)

def find_wx_relation(zhi1, zhi2):
    return multi_key_dict_get(wuxing_relation_2, Ganzhiwuxing(zhi1) + Ganzhiwuxing(zhi2))

#換算干支
# v2.2.1 双开关:
#   after23_new_day=1「23点算第二天」=23時起日柱進位次日(壬寅);=0「24点算第二天」=23時守今(辛丑)。
#   hour_gan_use_next_day=1「晚子时按次日日柱起子时」(默认,lunar.js Exact);=0「按当日柱起子时」(新行为)。
#   两个开关都只在 hour==23 起作用,其他 23 小时一律 NO-OP。
def _hour_stem_wuzhao(year, month, day, hour, after23_new_day, hour_gan_use_next_day, cdate_day):
    """hour==23 时按 lateZi 决定 hour stem;其它时刻返回 None 让原 getHourGZ 用。
    lateZi=1(默认): 时干始终用次日日干。
    lateZi=0: 跟随日柱所在 cdate 的日干(== 跟日柱一致)。"""
    if hour != 23:
        return None
    if hour_gan_use_next_day:
        if after23_new_day:
            day_tg_idx = cdate_day.getDayGZ().tg
        else:
            _d = Date(round((Date("{}/{}/{} 00:00:00.00".format(str(year).zfill(4), str(month).zfill(2), str(day+1).zfill(2)))), 3))
            _dd = list(_d.tuple())
            day_tg_idx = fromSolar(_dd[0], _dd[1], _dd[2]).getDayGZ().tg
    else:
        # lateZi=0: 跟日柱一致
        day_tg_idx = cdate_day.getDayGZ().tg
    return tian_gan[(day_tg_idx % 5 * 2 + 0) % 10] + di_zhi[0]

def gangzhi1(year, month, day, hour, minute, after23_new_day=1, hour_gan_use_next_day=1):
    if year < 1 or year > 9999:
        # 全年份域回退(共享件,口径与主链一致;域内原路径零变)
        from kin_year_domain import extreme_pillars
        _y, _m, _d, _h, _zi = extreme_pillars(year, month, day, hour, minute, after23=after23_new_day, hour_gan_next=hour_gan_use_next_day)
        try:
            _gm = minutes_jiazi_d(_zi).get(str(hour) + ":" + str(minute))
        except Exception:
            _gm = None
        return [_y, _m, _d, _h, _gm]

    # 日柱: after23_new_day=1 + hour==23 進位到次日; 否則守今。
    if hour == 23 and after23_new_day:
        d = Date(round((Date("{}/{}/{} {}:00:00.00".format(str(year).zfill(4), str(month).zfill(2), str(day+1).zfill(2), str(0).zfill(2)))), 3))
    else:
        d = Date("{}/{}/{} {}:00:00.00".format(str(year).zfill(4), str(month).zfill(2), str(day).zfill(2), str(hour).zfill(2) ))
    dd = list(d.tuple())
    cdate = fromSolar(dd[0], dd[1], dd[2])
    yTG,mTG,dTG = "{}{}".format(tian_gan[cdate.getYearGZ().tg], di_zhi[cdate.getYearGZ().dz]), "{}{}".format(tian_gan[cdate.getMonthGZ().tg],di_zhi[cdate.getMonthGZ().dz]), "{}{}".format(tian_gan[cdate.getDayGZ().tg], di_zhi[cdate.getDayGZ().dz])
    # 時柱: v2.2.1 双开关
    _h = _hour_stem_wuzhao(year, month, day, hour, after23_new_day, hour_gan_use_next_day, cdate)
    if _h is not None:
        hTG = _h
    else:
        hTG = "{}{}".format(tian_gan[cdate.getHourGZ(dd[3]).tg], di_zhi[cdate.getHourGZ(dd[3]).dz])
    if year < 1900:
        mTG1 = find_lunar_month(yTG).get(lunar_date_d(year, month, day).get("月"))
    else:
        mTG1 = mTG
    if _h is not None:
        hTG1 = hTG  # v2.2.1: lateZi 直接生效到 hTG1
    else:
        hTG1 = find_lunar_hour(dTG).get(hTG[1])
    return [yTG, mTG1, dTG, hTG1]

#換算干支
def gangzhi(year, month, day, hour, minute, after23_new_day=1, hour_gan_use_next_day=1):
    if year < 1 or year > 9999:
        # 全年份域回退(共享件,口径与主链一致;域内原路径零变)
        from kin_year_domain import extreme_pillars
        _y, _m, _d, _h, _zi = extreme_pillars(year, month, day, hour, minute, after23=after23_new_day, hour_gan_next=hour_gan_use_next_day)
        try:
            _gm = minutes_jiazi_d(_zi).get(str(hour) + ":" + str(minute))
        except Exception:
            _gm = None
        return [_y, _m, _d, _h, _gm]

    if year == 0:
        return ["無效"]
    if year < 0:
        year = year + 1
    if hour == 23 and after23_new_day:
        d = Date(round((Date("{}/{}/{} {}:00:00.00".format(str(year).zfill(4), str(month).zfill(2), str(day+1).zfill(2), str(0).zfill(2)))), 3))
    else:
        d = Date("{}/{}/{} {}:00:00.00".format(str(year).zfill(4), str(month).zfill(2), str(day).zfill(2), str(hour).zfill(2) ))
    dd = list(d.tuple())
    cdate = fromSolar(dd[0], dd[1], dd[2])
    yTG,mTG,dTG = "{}{}".format(tian_gan[cdate.getYearGZ().tg], di_zhi[cdate.getYearGZ().dz]), "{}{}".format(tian_gan[cdate.getMonthGZ().tg],di_zhi[cdate.getMonthGZ().dz]), "{}{}".format(tian_gan[cdate.getDayGZ().tg], di_zhi[cdate.getDayGZ().dz])
    _h = _hour_stem_wuzhao(year, month, day, hour, after23_new_day, hour_gan_use_next_day, cdate)
    if _h is not None:
        hTG = _h
    else:
        hTG = "{}{}".format(tian_gan[cdate.getHourGZ(dd[3]).tg], di_zhi[cdate.getHourGZ(dd[3]).dz])
    if year < 1900:
        mTG1 = find_lunar_month(yTG).get(lunar_date_d(year, month, day).get("月"))
    else:
        mTG1 = mTG
    if _h is not None:
        hTG1 = hTG  # v2.2.1: lateZi 直接生效到 hTG1
    else:
        hTG1 = find_lunar_hour(dTG).get(hTG[1])
    zi = gangzhi1(year, month, day, 0, 0, after23_new_day, hour_gan_use_next_day)[3]
    hourminute = str(hour)+":"+str(minute)
    gangzhi_minute = minutes_jiazi_d(zi).get(hourminute)
    return [yTG, mTG1, dTG, hTG1, gangzhi_minute]

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
#五狗遁，起子時
def find_lunar_minute(hour):
    fivedogs = {
    tuple(list('甲己')):'甲戌',
    tuple(list('乙庚')):'丙戌',
    tuple(list('丙辛')):'戊戌',
    tuple(list('丁壬')):'庚戌',
    tuple(list('戊癸')):'壬戌'
    }
    if multi_key_dict_get(fivedogs, hour[0]) == None:
        result = multi_key_dict_get(fivedogs, hour[1])
    else:
        result = multi_key_dict_get(fivedogs, hour[0])
    return new_list(jiazi(), result)
#分干支
def minutes_jiazi_d(hour):
    if _KIN_CONST_ON:
        cached = _MINUTES_JIAZI_CACHE.get(hour)
        if cached is None:
            t = [f"{h}:{m}" for h in range(24) for m in range(60)]
            cached = dict(zip(t, cycle(repeat_list(1, find_lunar_minute(hour)))))
            _MINUTES_JIAZI_CACHE[hour] = cached
        return dict(cached)
    t = [f"{h}:{m}" for h in range(24) for m in range(60)]
    minutelist = dict(zip(t, cycle(repeat_list(1, find_lunar_minute(hour)))))
    return minutelist


if __name__ == '__main__':
    print(gangzhi(2024,8,23,10,7))
