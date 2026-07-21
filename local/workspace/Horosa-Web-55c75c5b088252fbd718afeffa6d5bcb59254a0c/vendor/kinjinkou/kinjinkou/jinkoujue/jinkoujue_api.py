#!/usr/bin/python3
# -*- coding: utf-8 -*-
from ..wannianli import WannianliApi
from ._paipan import Paipan
from ._fenxi import Chuantongfenxi, Lianghuafenxi
from sxtwl import fromSolar
import ephem
import threading as _threading


tian_gan = '甲乙丙丁戊己庚辛壬癸'
di_zhi = '子丑寅卯辰巳午未申酉戌亥'

# v2.2.1: 全局日界 + 晚子时·时柱起干 thread-local 开关。
# 由 webjinkousrv 每请求设定。默认均为 1(现行行为)。仅 hour==23 时影响,其它 NO-OP。
_TLS_JK_API = _threading.local()

def set_after23_new_day(value):
    _TLS_JK_API.after23 = 1 if value else 0

def set_hour_gan_use_next_day(value):
    _TLS_JK_API.late_zi = 1 if value else 0

def _get_after23_jk():
    return getattr(_TLS_JK_API, 'after23', 1)

def _get_late_zi_jk():
    return getattr(_TLS_JK_API, 'late_zi', 1)

def multi_key_dict_get(d, k):
    for keys, v in d.items():
        if k in keys:
            return v
    return None


#農曆
def lunar_date_d(year, month, day):
    lunar_m = ['占位', '正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月']
    day = fromSolar(year, month, day)
    return {"年":day.getLunarYear(),
            "農曆月": lunar_m[int(day.getLunarMonth())],
            "月":day.getLunarMonth(),
            "日":day.getLunarDay()}

def new_list(olist, o):
    a = olist.index(o)
    res1 = olist[a:] + olist[:a]
    return res1

#%% 甲子平支
def jiazi():
    return list(map(lambda x: "{}{}".format(tian_gan[x % len(tian_gan)],
                                            di_zhi[x % len(di_zhi)]),
                                            list(range(60))))


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
#換算干支
def gangzhi1(year, month, day, hour, minute):
    if year < 1 or year > 9999:
        # 全年份域回退(共享件,口径与主链一致;域内原路径零变)——本函数返回 dict 形
        from kin_year_domain import extreme_pillars
        _y, _m, _d, _h, _zi = extreme_pillars(
            year, month, day, hour, minute,
            after23=_get_after23_jk(), hour_gan_next=_get_late_zi_jk())
        return {'类别': '干支', '年柱': _y, '月柱': _m, '日柱': _d, '时柱': _h,
                '五柱类型': '', '五柱内容': '', '文本': f"干支：{_y} {_m} {_d} {_h} 空亡："}

    # v2.2.1: 用 thread-local 决定 hour==23 时是否进位日柱(after23)和起子时用哪日干(lateZi)。
    _after23 = _get_after23_jk()
    _late_zi = _get_late_zi_jk()
    if hour == 23 and _after23:
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
        tian_gan[cdate.getYearGZ().tg],
        di_zhi[cdate.getYearGZ().dz]), "{}{}".format(
            tian_gan[cdate.getMonthGZ().tg],
            di_zhi[cdate.getMonthGZ().dz]), "{}{}".format(
                tian_gan[cdate.getDayGZ().tg],
                di_zhi[cdate.getDayGZ().dz]), "{}{}".format(
                    tian_gan[cdate.getHourGZ(dd[3]).tg],
                    di_zhi[cdate.getHourGZ(dd[3]).dz])
    # v2.2.1: hour==23 时按 lateZi 重写时柱
    _h_late_override = False
    if hour == 23:
        _h_late_override = True
        if _late_zi:
            if _after23:
                day_tg_idx = cdate.getDayGZ().tg
            else:
                _td = ephem.Date(round((ephem.Date("{}/{}/{} 00:00:00.00".format(str(year).zfill(4), str(month).zfill(2), str(day+1).zfill(2)))),3))
                _tdd = list(_td.tuple())
                day_tg_idx = fromSolar(_tdd[0], _tdd[1], _tdd[2]).getDayGZ().tg
        else:
            day_tg_idx = cdate.getDayGZ().tg
        hTG = tian_gan[(day_tg_idx % 5 * 2 + 0) % 10] + di_zhi[0]
    if year < 1900:
        mTG1 = find_lunar_month(yTG).get(lunar_date_d(year, month, day).get("月"))
    else:
        mTG1 = mTG
    if _h_late_override:
        hTG1 = hTG  # v2.2.1: lateZi 直接生效
    else:
        hTG1 = find_lunar_hour(dTG).get(hTG[1])
    return {'类别': '干支', '年柱': yTG, '月柱': mTG1, '日柱': dTG, '时柱': hTG1, '五柱类型': '', '五柱内容': '', '文本': f"干支：{yTG} {mTG} {dTG} {hTG} 空亡："}




class JinkoujueApi:
    def __init__(self):
        self.P = None
        self.pan = None
        self.chuantongfenxi = None
        self.lianghuafenxi = None

    def paipan(self, datetime_obj, difen='子', yuejiang=None, zhanshi=None):
        self.P = Paipan()
        calendar = gangzhi1(datetime_obj.year, datetime_obj.month, datetime_obj.day, datetime_obj.hour, datetime_obj.minute)
        self.pan, self.ganzhi = self.P.paipan(calendar, difen=difen, yuejiang=yuejiang, zhanshi=zhanshi)
        return self.pan

    def print_pan(self):
        if self.P is None:
            print('请先调用paipan()排盘后再使用本函数！')
            return None
        else:
            if self.pan.get('标签', None):
                if self.pan['标签'] == '传统分析':
                    output = self.P.output()
                    output += self.chuantongfenxi.output_addition()
                    return output
                elif self.pan['标签'] == '量化分析':
                    output = self.P.output()
                    output += self.lianghuafenxi.output_addition()
                    return output
            else:
                return self.P.output()

    def get_chuantongfenxi(self):
        if self.P is None:
            print('请先调用paipan()排盘后再使用本函数！')
            return None
        self.chuantongfenxi = Chuantongfenxi()
        self.pan = self.chuantongfenxi.fenxi(self.pan)
        return self.pan

    def get_lianghuafenxi(self):
        if self.P is None:
            print('请先调用paipan()排盘后再使用本函数！')
            return None
        self.lianghuafenxi = Lianghuafenxi()
        self.pan = self.lianghuafenxi.fenxi(self.pan)
        return self.pan

