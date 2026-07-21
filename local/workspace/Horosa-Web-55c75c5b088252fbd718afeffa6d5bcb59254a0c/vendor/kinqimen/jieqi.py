# -*- coding: utf-8 -*-
"""
Created on Wed Aug 27 08:25:17 2025

@author: hooki
"""

import datetime
import threading as _threading
from itertools import cycle, repeat
import  sxtwl
from sxtwl import fromSolar
import ephem

# v2.2.1: 全局日界 + 晚子时·时柱起干 thread-local 开关。
# 由 webqimensrv 每请求设定,默认 1=1=现行行为(hour==23 进位 + 时干用次日干起子时)。
# 仅 hour==23 时影响日柱/时柱;其它 23 小时完全 NO-OP。
_TLS = _threading.local()

def set_after23_new_day(value):
    _TLS.after23 = 1 if value else 0

def set_hour_gan_use_next_day(value):
    _TLS.hour_gan_next = 1 if value else 0

def _get_after23(explicit=None):
    if explicit is not None:
        return 1 if explicit else 0
    return getattr(_TLS, 'after23', 1)

def _get_hour_gan_next(explicit=None):
    if explicit is not None:
        return 1 if explicit else 0
    return getattr(_TLS, 'hour_gan_next', 1)


jqmc = ['小寒', '大寒', '立春', '雨水', '驚蟄', '春分', '清明', '穀雨', '立夏', '小滿', '芒種', '夏至', '小暑', '大暑', '立秋', '處暑', '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至']
# 12「節」(每月之首,逢之換月柱;立春兼換年柱)。其餘12「氣」不換月柱。
JIE_TERMS = {'立春', '驚蟄', '清明', '立夏', '芒種', '小暑', '立秋', '白露', '寒露', '立冬', '大雪', '小寒'}
tian_gan = '甲乙丙丁戊己庚辛壬癸'
di_zhi = '子丑寅卯辰巳午未申酉戌亥'

#%% 甲子平支
# horosa_qimen_jiazi_const_v1(PERF-R9):六十甲子是编译期常量,原实现却在**每次调用**重建整张表。
# cProfile 实测:单个 /qimen/pan 请求调用 4,712 次 → 282,720 次 lambda + 286,319 次 str.format,
# 占整个请求 profile 时间的 46%。
# 安全性:20 个调用点已逐一审计(config.py 14 处 / jieqi.py 3 处 / kinqimen.py 5 处),
# 全部只读 —— 切片、new_list 的 `olist[a:]+olist[:a]`、dict(zip(...))、split_list、repeat_list,
# 无一处就地变异,故共享同一份常量与每次重建逐字节等价。
# 回滚:把 return 改成 `list(_JIAZI_CONST)`(保留「每次新列表」的契约,仍省掉 format/lambda)。
_JIAZI_CONST = ["{}{}".format(tian_gan[x % len(tian_gan)], di_zhi[x % len(di_zhi)]) for x in range(60)]

def jiazi():
    return _JIAZI_CONST


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
    """
    Get the start date and time of the current solar term (jieqi) for the given date and time.
    Returns a dictionary with year, month, day, hour, minute, and the name of the solar term.
    """
    # Initialize the day object with the given date
    day = sxtwl.fromSolar(year, month, day)
    
    # Check if the given date has a solar term
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
        # If no solar term on this day, find the previous solar term
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
            
def _jieqi_instant(day_obj):
    """某交節日的交節時刻(分鐘精度,安全進位)。

    sxtwl JD2DD 的分鐘為浮點,round 後可為 60——直接塞 datetime(minute=60) 會
    ValueError;改用 timedelta 承接進位,無進位時值與舊寫法逐分鐘一致。
    """
    t = sxtwl.JD2DD(day_obj.getJieQiJD())
    return datetime.datetime(t.Y, t.M, t.D) + datetime.timedelta(hours=int(t.h), minutes=round(t.m))

def get_current_jieqi_start_date(year, month, day, hour, minute):
    """時刻感知:返回「當前時刻所處節氣」的交節時刻與名稱。

    修 get_jieqi_start_date 只按「當天有無節氣」判定、忽略時分的邊界誤差:
    節氣當天但尚未到交節時刻時,真正所處的仍是上一個節氣(其交節時刻 <= now)。
    逐日向前回掃,取第一個交節時刻 <= now 的節氣(節氣間距~15天,40天足夠)。
    """
    now = datetime.datetime(year, month, day, hour, minute)
    cur = sxtwl.fromSolar(year, month, day)
    for _ in range(40):
        if cur.hasJieQi():
            cand = _jieqi_instant(cur)
            if cand <= now:
                return {"節氣": jqmc[cur.getJieQi() - 1], "時間": cand}
        cur = cur.before(1)
    # 兜底:回退原實現(極端情況不致拋錯)
    return get_jieqi_start_date(year, month, day, hour, minute)

def get_before_jieqi_start_date(year, month, day, hour, minute):
    """上一節氣(相對當前時刻所處節氣)的交節資訊,dict 形狀與 get_jieqi_start_date 同構。

    修(2026-07-04 事故复盘: Bug①):舊版自 day.before(15) 起跳向回掃——當上一交節日與當日
    日曆差=14 天(冬半年傍晚交節,約 1.7 天/年)時起跳點恰好跳過上一交節日,返回
    兩檔前的節氣。改為:取當前節氣起點,往前 1 分鐘再求「當時所處節氣」=嚴格上一節氣,
    與 get_current_jieqi_start_date 同一時刻感知原語,無跳步面。
    """
    cur = get_current_jieqi_start_date(year, month, day, hour, minute)
    probe = cur["時間"] - datetime.timedelta(minutes=1)
    prev = get_current_jieqi_start_date(probe.year, probe.month, probe.day, probe.hour, probe.minute)
    t = prev["時間"]
    return {
        "年": t.year,
        "月": t.month,
        "日": t.day,
        "時": t.hour,
        "分": t.minute,
        "節氣": prev["節氣"],
        "時間": t,
    }

def get_next_jieqi_start_date(year, month, day, hour, minute):
    """
    Get the start date and time of the next solar term (jieqi) after the given date and time.
    Returns a dictionary with year, month, day, hour, minute, and the name of the solar term.
    """
    # Initialize the day object with the given date
    day = sxtwl.fromSolar(year, month, day)
    
    # Start searching from the next day
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
    """當前時刻所處節氣名(時刻感知)。

    修(2026-07-04 事故复盘: Bug①):舊實現以 get_jieqi_start_date(按日粒度,交節日尚未到刻
    即提前指向當日將交節氣)+ get_before_jieqi_start_date(舊版 before(15) 起跳)組合分支;
    當上一交節日曆差=14 天時,交節日 0 點~交節時刻整段錯報「兩檔前」節氣(拆補/茅山當日
    錯局,9 年實測 15 天)。改為直接委託時刻感知的 get_current_jieqi_start_date——
    茅山定局(config.qimen_ju_name_maoshan)久經金標考驗的同一原語。
    """
    try:
        return get_current_jieqi_start_date(year, month, day, hour, minute)["節氣"]
    except Exception as e:
        raise ValueError(f"Error in jq for {year}-{month}-{day} {hour}:{minute}: {str(e)}")

# ===== 置閏轉盤：超神接氣置閏 定局所用節氣 =====
# 奇門換局以「符頭日」(甲/己日)為基準,五日一元,上中下三元配節氣局數。符頭較節氣每月約早到
# 10.5 小時(超神);於芒種/大雪累積≥9天時置閏(重複該節氣上中下三元一次)使符頭轉為落後(接氣)。
# 故定局實際所用之節氣,超神時會提前換到下一節氣,與當日曆法節氣 jq() 未必相同(見上游 issue #62)。
_SHANGYUAN_FUTOU = {'甲子', '甲午', '己卯', '己酉'}        # 上元符頭(甲己日且地支子午卯酉)
_JIE_SEQ_ZHIRUN = {
    '冬至': ['冬至', '小寒', '大寒', '立春', '雨水', '驚蟄', '春分', '清明', '穀雨', '立夏', '小滿', '芒種'],
    '夏至': ['夏至', '小暑', '大暑', '立秋', '處暑', '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪'],
}
_RUN_REPEAT = {'冬至': '大雪', '夏至': '芒種'}             # 置閏時重複之節氣(冬至前大雪/夏至前芒種)

def _day_gz(day):
    return tian_gan[day.getDayGZ().tg] + di_zhi[day.getDayGZ().dz]

def _solar_date(day):
    return datetime.date(day.getSolarYear(), day.getSolarMonth(), day.getSolarDay())

def _last_shangyuan_before(day_obj):
    """day_obj 之前(不含當日)最近的上元符頭日。"""
    cur = day_obj.before(1)
    for _ in range(20):
        if _day_gz(cur) in _SHANGYUAN_FUTOU:
            return cur
        cur = cur.before(1)
    return None

def _anchor_solstice(year, month, day):
    """管轄當日之『至』(其上元符頭 F* ≤ 當日)。先檢未來(下一至的超神前窗),再回溯。"""
    target = datetime.date(year, month, day)
    d = fromSolar(year, month, day)
    for _ in range(30):                       # 下一至若其 F* 已 ≤ 當日(當日落在其超神前窗)
        d = d.after(1)
        if d.hasJieQi() and jqmc[d.getJieQi() - 1] in ('冬至', '夏至'):
            f = _last_shangyuan_before(d)
            if f is not None and _solar_date(f) <= target:
                return jqmc[d.getJieQi() - 1], d
            break
    d = fromSolar(year, month, day)
    for _ in range(230):                      # 否則回溯最近一個其 F* ≤ 當日 的至
        if d.hasJieQi() and jqmc[d.getJieQi() - 1] in ('冬至', '夏至'):
            f = _last_shangyuan_before(d)
            if f is not None and _solar_date(f) <= target:
                return jqmc[d.getJieQi() - 1], d
        d = d.before(1)
    return None, None

def _zhirun_effective_date(year, month, day, hour):
    """置閏/无闰「距符頭天數」所用之有效日:晚子時(23:00–24:00)按現行日界口徑歸次日。

    修(2026-07-04 事故复盘: Bug②):日柱(gangzhi/findyuen 之元)在 after23=1 下於 23 時進位,
    而本模組距符頭天數原用日曆日——節氣塊邊界(上元符頭日)前夜 23:00–24:00 輸出
    「新元+舊節氣局」嵌合體(9 年實測 217 個時點,每 15 天一小時窗)。統一按進位日計距,
    與元的日界口徑一致;after23=0(傳統日界)時保持日曆日,兩口徑各自自洽。
    """
    if hour == 23 and _get_after23():
        nd = datetime.date(year, month, day) + datetime.timedelta(days=1)
        return nd.year, nd.month, nd.day
    return year, month, day

def zhirun_jieqi(year, month, day, hour, minute):
    """置閏轉盤定局所用節氣(超神接氣置閏後);可能與當日曆法節氣 jq() 不同。"""
    if year < 2 or year > 9998:
        # 全年份域:置閏鏈依賴 sxtwl 逐日游標(域外不可用)→ 按曆法節氣定局(既有保底口徑)
        return jq(year, month, day, hour, minute)
    ey, em, ed = _zhirun_effective_date(year, month, day, hour)
    znm, zday = _anchor_solstice(ey, em, ed)
    if znm is None:
        return jq(year, month, day, hour, minute)             # 保底:回退曆法節氣
    fstar = _last_shangyuan_before(zday)
    dgap = (_solar_date(zday) - _solar_date(fstar)).days        # 至 − 上元符頭(超神距)
    seq = _JIE_SEQ_ZHIRUN[znm]
    if dgap >= 9:                                              # 置閏:F* 組重複大雪/芒種,至之上元順延
        seq = [_RUN_REPEAT[znm]] + seq
    n = (_solar_date(fromSolar(ey, em, ed)) - _solar_date(fstar)).days // 5   # 自 F* 起第 n 元
    g = max(0, min(n // 3, len(seq) - 1))                      # 第 g 組節氣(每組三元)
    return seq[g]

def zhirun_jieqi_noleap(year, month, day, hour, minute):
    """无闰定局所用節氣(超神接氣,不置閏):同 zhirun_jieqi 但跳過大雪/芒種≥9天的置閏重複。"""
    if year < 2 or year > 9998:
        return jq(year, month, day, hour, minute)
    ey, em, ed = _zhirun_effective_date(year, month, day, hour)
    znm, zday = _anchor_solstice(ey, em, ed)
    if znm is None:
        return jq(year, month, day, hour, minute)
    fstar = _last_shangyuan_before(zday)
    seq = _JIE_SEQ_ZHIRUN[znm]                                 # 无闰:不做 dgap>=9 置閏
    n = (_solar_date(fromSolar(ey, em, ed)) - _solar_date(fstar)).days // 5
    g = max(0, min(n // 3, len(seq) - 1))
    return seq[g]

def ke_jiazi_d(hour):
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

def _cdate_for_day(year, month, day, hour, after23_new_day):
    """日柱 cdate:仅当 hour==23 且 after23_new_day=1 时进位次日。其它情形守今。"""
    if hour == 23 and after23_new_day:
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

def _hour_stem_for_late_zi(year, month, day, hour, after23_new_day, hour_gan_use_next_day, cdate_day):
    """v2.2.1 第二全局开关。
    仅 hour==23 时分四种:
      after23=1+lateZi=1 (默认): 时干用次日日干 → 庚子(若 27 日 → 戊→壬→庚子)
      after23=1+lateZi=0: 时干用次日日干 (等价默认,因日柱已进位)
      after23=0+lateZi=1: 时干用次日日干起子时 (但日柱守今)
      after23=0+lateZi=0: 时干用今日日干起子时 (新行为)
    其它 22 小时:沿用原 sxtwl getHourGZ,完全 NO-OP。
    返回 (hour_tg_idx, hour_dz_idx)。
    """
    if hour != 23:
        # NO-OP for non-23 hours
        return None  # caller falls back to original getHourGZ
    # 五鼠遁起子时:hour_stem_idx = (day_stem_idx % 5 * 2 + 0) % 10,子 dz=0
    # 语义(用户拍板):
    #   lateZi=1(默认): 时干**始终用次日日干**起子时(lunar.js Exact 现行行为)
    #   lateZi=0: 时干用**与日柱同 cdate** 的日干起子时(即跟日柱一致)
    if hour_gan_use_next_day:
        # lateZi=1: 始终用次日日干
        if after23_new_day:
            # cdate_day 已经是次日,直接用
            day_tg_idx = cdate_day.getDayGZ().tg
        else:
            # cdate_day 是今日,需要单独计算次日
            d_next = ephem.Date(round((ephem.Date("{}/{}/{} 00:00:00.00".format(
                str(year).zfill(4),
                str(month).zfill(2),
                str(day+1).zfill(2)))),3))
            dd_next = list(d_next.tuple())
            day_tg_idx = fromSolar(dd_next[0], dd_next[1], dd_next[2]).getDayGZ().tg
    else:
        # lateZi=0: 时干跟随日柱所在 cdate 的日干
        day_tg_idx = cdate_day.getDayGZ().tg
    hour_tg_idx = (day_tg_idx % 5 * 2 + 0) % 10  # 子时 zhi=0
    return (hour_tg_idx, 0)

#換算干支
def gangzhi1(year, month, day, hour, minute, after23_new_day=None, hour_gan_use_next_day=None):
    if year < 1 or year > 9999:
        # 全年份域回退(共享件,口径与主链一致;域内原路径零变)
        from kin_year_domain import extreme_pillars
        _y, _m, _d, _h, _zi = extreme_pillars(year, month, day, hour, minute, after23=(1 if after23_new_day is None else after23_new_day), hour_gan_next=(1 if hour_gan_use_next_day is None else hour_gan_use_next_day))
        try:
            _gm = ke_jiazi_d(_zi).get(str(hour) + ":" + str(minute // 10) + "0")
        except Exception:
            _gm = None
        return [_y, _m, _d, _h, _gm]

    after23_new_day = _get_after23(after23_new_day)
    hour_gan_use_next_day = _get_hour_gan_next(hour_gan_use_next_day)
    d = _cdate_for_day(year, month, day, hour, after23_new_day)
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
    # v2.2.1: hour==23 时按 lateZi 重写 hTG
    late_override = _hour_stem_for_late_zi(year, month, day, hour, after23_new_day, hour_gan_use_next_day, cdate)
    if late_override is not None:
        hTG = tian_gan[late_override[0]] + di_zhi[late_override[1]]
    if year < 1900:
        mTG1 = find_lunar_month(yTG).get(lunar_date_d(year, month, day).get("月"))
    else:
        mTG1 = mTG
    if late_override is not None:
        # v2.2.1: lateZi override 直接生效到 hTG1(否则 find_lunar_hour(dTG) 会按 dTG 重新算回 today's stem)
        hTG1 = hTG
    else:
        hTG1 = find_lunar_hour(dTG).get(hTG[1])
    return [yTG, mTG1, dTG, hTG1]

def gangzhi(year, month, day, hour, minute, after23_new_day=None, hour_gan_use_next_day=None):
    if year < 1 or year > 9999:
        # 全年份域回退(共享件,口径与主链一致;域内原路径零变)
        from kin_year_domain import extreme_pillars
        _y, _m, _d, _h, _zi = extreme_pillars(year, month, day, hour, minute, after23=(1 if after23_new_day is None else after23_new_day), hour_gan_next=(1 if hour_gan_use_next_day is None else hour_gan_use_next_day))
        try:
            _gm = ke_jiazi_d(_zi).get(str(hour) + ":" + str(minute // 10) + "0")
        except Exception:
            _gm = None
        return [_y, _m, _d, _h, _gm]

    after23_new_day = _get_after23(after23_new_day)
    hour_gan_use_next_day = _get_hour_gan_next(hour_gan_use_next_day)
    d = _cdate_for_day(year, month, day, hour, after23_new_day)
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
    # v2.2.1: hour==23 时按 lateZi 重写 hTG (其它 22 小时 NO-OP)
    late_override = _hour_stem_for_late_zi(year, month, day, hour, after23_new_day, hour_gan_use_next_day, cdate)
    if late_override is not None:
        hTG = tian_gan[late_override[0]] + di_zhi[late_override[1]]
    if year < 1900:
        mTG1 = find_lunar_month(yTG).get(lunar_date_d(year, month, day).get("月"))
    else:
        mTG1 = mTG
    # 月柱按精確交節時刻校正：sxtwl 的 getMonthGZ 為日級，交節當日整日已跳入新月。
    # 若該日交的是 12「節」之一，且給定時刻早於精確交節時刻，仍屬前一節 → 沿用前一日之月柱
    # （立春兼換年柱）。其餘日不變。
    if year >= 1900:
        _sd = fromSolar(year, month, day)
        if _sd.hasJieQi() and jqmc[_sd.getJieQi() - 1] in JIE_TERMS:
            _t = sxtwl.JD2DD(_sd.getJieQiJD())
            _crossing = datetime.datetime(_t.Y, _t.M, _t.D, int(_t.h), round(_t.m))
            if datetime.datetime(year, month, day, hour, minute) < _crossing:
                _prev = _sd.before(1)
                mTG1 = tian_gan[_prev.getMonthGZ().tg] + di_zhi[_prev.getMonthGZ().dz]
                if jqmc[_sd.getJieQi() - 1] == '立春':
                    yTG = tian_gan[_prev.getYearGZ().tg] + di_zhi[_prev.getYearGZ().dz]
    if late_override is not None:
        # v2.2.1: lateZi override 直接生效到 hTG1
        hTG1 = hTG
    else:
        hTG1 = find_lunar_hour(dTG).get(hTG[1])
    zi = gangzhi1(year, month, day, 0, 0, after23_new_day, hour_gan_use_next_day)[3]
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

if __name__ == '__main__':
    year = 2005
    month = 5
    day = 5
    hour = 16
    minute = 30
    #print(liujiashun_dict())
    #print(qimen_ju_name_zhirun_raw(year, month, day, hour, minute))
    print(f"{year}-{month}-{day} {hour}:{minute}")
    #print( get_jieqi_start_date(year, month, day, hour, minute))
    #print( get_next_jieqi_start_date(year, month, day, hour, minute))
    #print( get_before_jieqi_start_date(year, month, day, hour, minute))
    print(gangzhi(year, month, day, hour, minute))
    #print(find_lunar_month(gangzhi(year, month, day, hour, minute)[0]))

        
