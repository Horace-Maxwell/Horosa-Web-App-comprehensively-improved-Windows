# -*- coding: utf-8 -*-
"""[Z8] 印度占星·择日(Muhurta)征象扫描引擎(纯 swisseph 直连,分钟粒度)。

架构与 qizheng_election_scan 同族(kernel 共用树校验/求值;区间代数 import 天星引擎):
  IndiaScanContext —— 单请求上下文(地点/ayanamsa/日出缓存+IndiaMoment per-jd 快照)
  IndiaMoment —— 单时刻惰性快照(恒星黄经/宿/座,swisseph 直连)

Muhurta 为纲(定案14):Panchanga 五肢(tithi/vara/nakshatra/yoga/karana)+Lagna+曜落座
+Rahu Kalam 类日凶段+本命组(Tara Bala/Chandra Bala,natal 月宿/月座输入);Dasha 归本命
分析面(生成型,不入候选时刻扫描——coverage exempt 明示)。

口径:ayanamsa 经 india_chart_kernel.normalize_ayanamsa(与主印度盘同源 47 制);
vara/日凶段按**当地日出界**(标准日出方程,与 webindiasrv rectify Tier0 同义);
恒星黄经=tropical-ayanamsa(整日缓存,日变 ~1e-4°)。
"""
import datetime as _dt
import math

import swisseph

from astrostudy.election_scan import (
    _jd_from, _norm360, norm_intervals, iv_and, iv_or, iv_not, iv_xor,
    true_intervals, date_time_from_jd, _sidereal_offset,
)
from astrostudy.election_scan_kernel import GROUP_TYPES, make_validate, make_tree_evaluator
# [W8 全谱轮] 择时判定面=主印度盘权威实现直调(muhurta_day 三十须臾表/jyotish_engine
# Choghadia 轮值表/shadbala hora 主曜——零平行实现)。
from astrostudy.india.muhurta_day import day_muhurtas, night_muhurtas
from astrostudy.india.jyotish_engine import CHOGHADIA_CYCLE, CHOGHADIA_DAY_FIRST
from astrostudy.india import shadbala_bphs as _sb

MAX_SPAN_DAYS = 93.0
MAX_INTERVALS = 1000


def _zone_days(zone):
    """固定偏移 zone('+08:00'/'-05:30')→天数(墙钟分钟栅格对齐用)。"""
    txt = str(zone or '+08:00')
    neg = txt.startswith('-')
    txt = txt.replace('+', '').replace('-', '')
    parts = txt.split(':')
    v = float(parts[0]) + (float(parts[1]) / 60.0 if len(parts) > 1 else 0.0)
    return (-v if neg else v) / 24.0

NAK_SIZE = 360.0 / 27.0

IN_BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Rahu', 'Ketu']
_SWE = {
    'Sun': swisseph.SUN, 'Moon': swisseph.MOON, 'Mercury': swisseph.MERCURY,
    'Venus': swisseph.VENUS, 'Mars': swisseph.MARS, 'Jupiter': swisseph.JUPITER,
    'Saturn': swisseph.SATURN,
}

# Rahu Kalam 段序(日出起八分日的第 N 段;周日=0):传统序表。
RAHU_KALAM_IDX = {0: 7, 1: 1, 2: 6, 3: 4, 4: 5, 5: 3, 6: 2}
YAMA_GANDA_IDX = {0: 4, 1: 3, 2: 2, 3: 1, 4: 0, 5: 6, 6: 5}
GULIKA_IDX = {0: 6, 1: 5, 2: 4, 3: 3, 4: 2, 5: 1, 6: 0}


def _vara_of_rise(rise_jd, zone):
    rec = date_time_from_jd(rise_jd + 1e-6, zone)['datetime'][:10]
    y, m, d = [int(x) for x in rec.split('-')]
    return (_dt.date(y, m, d).weekday() + 1) % 7   # Mon=0 → 周一=1;周日=0


class IndiaScanContext(object):
    def __init__(self, data):
        self.zone = data.get('zone', '+08:00')
        self.lat = float(data.get('gpsLat'))
        self.lon = float(data.get('gpsLon'))
        self.ayan_key = str(data.get('ayanamsa') or 'lahiri')
        node_type = str(data.get('nodeType') or 'mean').lower()
        self.node_swe = swisseph.TRUE_NODE if node_type == 'true' else swisseph.MEAN_NODE
        self._moments = {}
        self._ayan_cache = {}
        self._sunrise_cache = {}
        self.eval_points = 0
        # natal(本命组条件:Tara/Chandra Bala):{moonNak: 1..27, moonSign: 0..11}
        natal = data.get('natal') or {}
        self.natal_moon_nak = int(natal.get('moonNak') or 0)
        self.natal_moon_sign = int(natal.get('moonSign') if natal.get('moonSign') is not None else -1)

    def ayan(self, jd):
        key = int(jd)
        v = self._ayan_cache.get(key)
        if v is None:
            v = _sidereal_offset(self.ayan_key, jd)
            self._ayan_cache[key] = v
        return v

    def moment(self, jd):
        m = self._moments.get(jd)
        if m is None:
            m = IndiaMoment(jd, self)
            self._moments[jd] = m
            self.eval_points += 1
        return m

    def sunrise_bounds(self, jd):
        """jd 所在「吠陀日」的 (今日日出, 日落, 次日日出)(标准日出方程,当地钟表→jd)。
        vara/日凶段按日出界换日。"""
        rec = date_time_from_jd(jd, self.zone)
        dstr = rec['datetime'][:10]
        cached = self._sunrise_cache.get(dstr)
        if cached is None:
            cached = self._day_bounds(dstr)
            self._sunrise_cache[dstr] = cached
        rise, set_, next_rise = cached
        if jd < rise:
            # 属前一吠陀日
            prev = date_time_from_jd(jd - 1.0, self.zone)['datetime'][:10]
            pc = self._sunrise_cache.get(prev)
            if pc is None:
                pc = self._day_bounds(prev)
                self._sunrise_cache[prev] = pc
            return pc
        return cached

    def _day_bounds(self, dstr):
        y, m, d = [int(x) for x in dstr.split('-')]
        rise = self._sun_event(y, m, d, True)
        set_ = self._sun_event(y, m, d, False)
        # 次日日出
        jd_next = _jd_from(dstr, '12:00:00', self.zone, 1) + 1.0
        nrec = date_time_from_jd(jd_next, self.zone)['datetime'][:10]
        ny, nm, nd = [int(x) for x in nrec.split('-')]
        next_rise = self._sun_event(ny, nm, nd, True)
        return (rise, set_, next_rise)

    def _sun_event(self, y, m, d, is_rise):
        """标准日出/落方程(zenith 90.833°;返回该当地日事件的 jd)。极圈退化:钟表 06/18 时。"""
        n0 = int((swisseph.julday(y, m, d) - swisseph.julday(y, 1, 1))) + 1
        gamma = 2.0 * math.pi / 365.0 * (n0 - 1)
        decl = (0.006918 - 0.399912 * math.cos(gamma) + 0.070257 * math.sin(gamma)
                - 0.006758 * math.cos(2 * gamma) + 0.000907 * math.sin(2 * gamma)
                - 0.002697 * math.cos(3 * gamma) + 0.00148 * math.sin(3 * gamma))
        eot = 229.18 * (0.000075 + 0.001868 * math.cos(gamma) - 0.032077 * math.sin(gamma)
                        - 0.014615 * math.cos(2 * gamma) - 0.040849 * math.sin(2 * gamma))
        latr = math.radians(self.lat)
        zen = math.radians(90.833)
        cosh = (math.cos(zen) - math.sin(latr) * math.sin(decl)) / (math.cos(latr) * math.cos(decl))
        zone_h = self._zone_hours()
        if cosh <= -1 or cosh >= 1:
            hh = 6.0 if is_rise else 18.0
        else:
            ha = math.degrees(math.acos(cosh))
            noon_min = 720.0 - 4.0 * (self.lon - zone_h * 15.0) - eot
            hh = (noon_min + (-ha if is_rise else ha) * 4.0) / 60.0
        dstr = '{0:04d}-{1:02d}-{2:02d}'.format(y, m, d)
        base = _jd_from(dstr, '00:00:00', self.zone, 1)
        return base + hh / 24.0

    def _zone_hours(self):
        txt = str(self.zone or '+08:00')
        neg = txt.startswith('-')
        txt = txt.replace('+', '').replace('-', '')
        parts = txt.split(':')
        v = float(parts[0]) + (float(parts[1]) / 60.0 if len(parts) > 1 else 0.0)
        return -v if neg else v


class IndiaMoment(object):
    __slots__ = ('jd', 'ctx', '_sid', '_asc')

    def __init__(self, jd, ctx):
        self.jd = jd
        self.ctx = ctx
        self._sid = {}
        self._asc = None

    def sid_lon(self, body):
        v = self._sid.get(body)
        if v is None:
            if body == 'Ketu':
                v = _norm360(self.sid_lon('Rahu') + 180.0)
            elif body == 'Rahu':
                res, _f = swisseph.calc_ut(self.jd, self.ctx.node_swe, swisseph.FLG_SWIEPH)
                v = _norm360(res[0] - self.ctx.ayan(self.jd))
            else:
                res, _f = swisseph.calc_ut(self.jd, _SWE[body], swisseph.FLG_SWIEPH)
                v = _norm360(res[0] - self.ctx.ayan(self.jd))
            self._sid[body] = v
        return v

    def trop_lon(self, body):
        return _norm360(self.sid_lon(body) + self.ctx.ayan(self.jd))

    def nak(self, body):
        return int(self.sid_lon(body) // NAK_SIZE) % 27 + 1   # 1..27

    def sign(self, body):
        return int(self.sid_lon(body) // 30.0) % 12           # 0..11

    def tithi(self):
        diff = _norm360(self.trop_lon('Moon') - self.trop_lon('Sun'))
        return int(diff // 12.0) + 1                          # 1..30

    def karana(self):
        diff = _norm360(self.trop_lon('Moon') - self.trop_lon('Sun'))
        n = int(diff // 6.0)                                  # 0..59 半 tithi 序
        if n == 0:
            return 'Kimstughna'
        if n >= 57:
            return ['Shakuni', 'Chatushpada', 'Naga'][n - 57]
        return ['Bava', 'Balava', 'Kaulava', 'Taitila', 'Garaja', 'Vanija', 'Vishti'][(n - 1) % 7]

    def yoga(self):
        return int(_norm360(self.sid_lon('Sun') + self.sid_lon('Moon')) // NAK_SIZE) % 27 + 1

    def vara(self):
        """星期(0=周日;按当地日出界换日——吠陀日)。jd 整数取模法差一实抓(2026-01-01
        周四被判 vara3),改当地日出所在日期直算 weekday。"""
        rise, _s, _n = self.ctx.sunrise_bounds(self.jd)
        return _vara_of_rise(rise, self.ctx.zone)

    def asc_sign(self):
        if self._asc is None:
            cusps, ascmc = swisseph.houses_ex(self.jd, self.ctx.lat, self.ctx.lon, b'W')
            self._asc = int(_norm360(ascmc[0] - self.ctx.ayan(self.jd)) // 30.0) % 12
        return self._asc


# ── 叶求值器 ──
_STEP_MOON = 20.0 / 1440.0    # 月系(tithi/nak/yoga/karana):20 分
_STEP_ASC = 15.0 / 1440.0
_STEP_SLOW = 6.0 / 24.0


def _eval_tithi(params, ctx, domain):
    wants = set(int(x) for x in (params.get('values') or []))
    return true_intervals(lambda jd: ctx.moment(jd).tithi() in wants, domain[0], domain[1], _STEP_MOON)


def _eval_vara(params, ctx, domain):
    wants = set(int(x) for x in (params.get('values') or []))
    return true_intervals(lambda jd: ctx.moment(jd).vara() in wants, domain[0], domain[1], 2.0 / 24.0)


def _eval_nakshatra(params, ctx, domain):
    body = params.get('body') or 'Moon'
    wants = set(int(x) for x in (params.get('values') or []))
    step = _STEP_MOON if body == 'Moon' else _STEP_SLOW
    return true_intervals(lambda jd: ctx.moment(jd).nak(body) in wants, domain[0], domain[1], step)


def _eval_yoga(params, ctx, domain):
    wants = set(int(x) for x in (params.get('values') or []))
    return true_intervals(lambda jd: ctx.moment(jd).yoga() in wants, domain[0], domain[1], _STEP_MOON)


def _eval_karana(params, ctx, domain):
    wants = set(params.get('values') or [])
    return true_intervals(lambda jd: ctx.moment(jd).karana() in wants, domain[0], domain[1], _STEP_MOON)


def _asc_step(lat):
    """高纬 lagna 快升座真窗可短至分钟级(66°N 白羊窗 ~4 分钟,15 分步整窗漏检——
    审查实抓);50-60° 过渡带中档。"""
    a = abs(lat or 0.0)
    if a >= 60.0:
        return 2.0 / 1440.0
    if a >= 50.0:
        return 5.0 / 1440.0
    return _STEP_ASC


def _eval_lagna(params, ctx, domain):
    # 🔴 前端 values=1..12(numOpt 序号),sign()/asc_sign()=0..11——谓词侧 -1 换算
    # (explain actual 已 +1 显示 1 基,曾漏此换算致整体错一个星座,审查实抓)。
    wants = set(int(x) - 1 for x in (params.get('values') or []))
    return true_intervals(lambda jd: ctx.moment(jd).asc_sign() in wants,
                          domain[0], domain[1], _asc_step(ctx.lat))


def _eval_planet_sign(params, ctx, domain):
    body = params.get('body') or 'Jupiter'
    wants = set(int(x) - 1 for x in (params.get('values') or []))   # 1 基→0 基(同 lagna)
    step = _STEP_MOON if body == 'Moon' else _STEP_SLOW
    return true_intervals(lambda jd: ctx.moment(jd).sign(body) in wants, domain[0], domain[1], step)


def _eval_retro(params, ctx, domain):
    body = params.get('body') or 'Mercury'
    if body in ('Rahu', 'Ketu', 'Sun', 'Moon'):
        raise ValueError('retro not applicable to {0}'.format(body))

    def pred(jd):
        res, _f = swisseph.calc_ut(jd, _SWE[body], swisseph.FLG_SWIEPH | swisseph.FLG_SPEED)
        want = (params.get('state') or 'retro')
        return res[3] < 0 if want == 'retro' else res[3] > 0
    return true_intervals(pred, domain[0], domain[1], _STEP_SLOW)


def _day_segment_ivs(ctx, domain, idx_table):
    """日凶段(日出~日落八分,第 idx_table[vara] 段)逐日拼区间。"""
    out = []
    jd = domain[0]
    guard = 0
    while jd < domain[1] and guard < 200:
        guard += 1
        rise, set_, next_rise = ctx.sunrise_bounds(jd + 1e-6)
        if set_ > rise:
            vara = _vara_of_rise(rise, ctx.zone)
            seg = (set_ - rise) / 8.0
            i = idx_table.get(vara, 0)
            s = rise + seg * i
            e = s + seg
            if e > domain[0] and s < domain[1]:
                out.append((max(s, domain[0]), min(e, domain[1])))
        jd = next_rise + 1e-6 if next_rise > jd else jd + 1.0
    return norm_intervals(out)


def _eval_day_kalam(params, ctx, domain):
    kind = params.get('kind') or 'rahu'
    table = {'rahu': RAHU_KALAM_IDX, 'yama': YAMA_GANDA_IDX, 'gulika': GULIKA_IDX}[kind]
    ivs = _day_segment_ivs(ctx, domain, table)
    if (params.get('mode') or 'avoid') == 'avoid':
        return iv_not(ivs, domain)
    return ivs


def _weekday_of_rise(rise_jd, zone):
    return _vara_of_rise(rise_jd, zone)


def _iter_days(ctx, domain):
    """逐印度日(日出界)迭代:yield (rise, set_, next_rise, vara0)。"""
    jd = domain[0]
    guard = 0
    while jd < domain[1] and guard < 200:
        guard += 1
        rise, set_, next_rise = ctx.sunrise_bounds(jd + 1e-6)
        if set_ > rise and next_rise > set_:
            yield rise, set_, next_rise, _vara_of_rise(rise, ctx.zone)
        jd = next_rise + 1e-6 if next_rise > jd else jd + 1.0


def _eval_muhurta_seg(params, ctx, domain):
    """[W8] 三十须臾(昼15+夜15;muhurta_day 权威表):按吉凶档/Abhijit 取时段。"""
    pick = params.get('pick') or 'grade'
    grades = set(params.get('grades') or ['auspicious'])
    day_tab = day_muhurtas()
    night_tab = night_muhurtas()
    out = []
    for rise, set_, next_rise, _v in _iter_days(ctx, domain):
        dslot = (set_ - rise) / 15.0
        nslot = (next_rise - set_) / 15.0
        if pick == 'abhijit':
            s0 = rise + dslot * 7
            out.append((s0, s0 + dslot))
            continue
        for i, row in enumerate(day_tab):
            if str(row.get('nature', '')).lower() in grades:
                s0 = rise + dslot * i
                out.append((s0, s0 + dslot))
        for i, row in enumerate(night_tab):
            if str(row.get('nature', '')).lower() in grades:
                s0 = set_ + nslot * i
                out.append((s0, s0 + nslot))
    out = [(max(a, domain[0]), min(b, domain[1])) for a, b in out if b > domain[0] and a < domain[1]]
    return norm_intervals(out)


def _eval_choghadia(params, ctx, domain):
    """[W8] Choghadia 八段(jyotish_engine 同表同起排:昼首=CHOGHADIA_DAY_FIRST[vara],夜首=昼首+5)。"""
    wants = set(params.get('values') or [])
    natures = set(params.get('natures') or [])
    out = []
    for rise, set_, next_rise, vara in _iter_days(ctx, domain):
        day_first = CHOGHADIA_DAY_FIRST[vara % 7]
        night_first = (day_first + 5) % 7
        dslot = (set_ - rise) / 8.0
        nslot = (next_rise - set_) / 8.0
        for i in range(8):
            c = CHOGHADIA_CYCLE[(day_first + i) % 7]
            if (wants and c['key'] in wants) or (natures and c['nature'] in natures):
                s0 = rise + dslot * i
                out.append((s0, s0 + dslot))
        for i in range(8):
            c = CHOGHADIA_CYCLE[(night_first + i) % 7]
            if (wants and c['key'] in wants) or (natures and c['nature'] in natures):
                s0 = set_ + nslot * i
                out.append((s0, s0 + nslot))
    out = [(max(a, domain[0]), min(b, domain[1])) for a, b in out if b > domain[0] and a < domain[1]]
    return norm_intervals(out)


def _eval_hora_vedic(params, ctx, domain):
    """[W8] 吠陀行星时(昼12+夜12;shadbala hora_lord_at 同源主曜序)。"""
    wants = set(params.get('values') or [])
    CN2EN = {u'日': 'Sun', u'月': 'Moon', u'火': 'Mars', u'水': 'Mercury',
             u'木': 'Jupiter', u'金': 'Venus', u'土': 'Saturn'}
    want_en = set(CN2EN.get(w, w) for w in wants)
    out = []
    for rise, set_, next_rise, vara in _iter_days(ctx, domain):
        dslot = (set_ - rise) / 12.0
        nslot = (next_rise - set_) / 12.0
        for i in range(24):
            lord = _sb.hora_lord_at(vara, i)
            lord_key = str(lord)
            if any(k in lord_key for k in want_en):
                if i < 12:
                    s0 = rise + dslot * i
                    out.append((s0, s0 + dslot))
                else:
                    s0 = set_ + nslot * (i - 12)
                    out.append((s0, s0 + nslot))
    out = [(max(a, domain[0]), min(b, domain[1])) for a, b in out if b > domain[0] and a < domain[1]]
    return norm_intervals(out)


PANCHAKA_TYPES = {1: 'Mrityu', 2: 'Agni', 4: 'Raja', 6: 'Chora', 8: 'Roga'}


def _eval_panchaka(params, ctx, domain):
    """[W8] Panchaka 五忌(与 jyotish_engine 主盘同公式:((tithi+vara+1+nak+lagna)*2)%9)。
    mode=avoid(默认)=避开五忌段;mode=free=取无忌段同义;values 可细选忌种(留空=全部五忌)。"""
    wants = set(params.get('values') or list(PANCHAKA_TYPES.values()))

    def pred(jd):
        m = ctx.moment(jd)
        rem = ((m.tithi() + (m.vara() + 1) + m.nak('Moon') + (m.asc_sign() + 1)) * 2) % 9
        t = PANCHAKA_TYPES.get(rem)
        return t is not None and t in wants
    ivs = true_intervals(pred, domain[0], domain[1], _asc_step(ctx.lat))
    if (params.get('mode') or 'avoid') == 'avoid':
        return iv_not(ivs, domain)
    return ivs


def _eval_nak_pada(params, ctx, domain):
    """[W8] 月宿分足(1..4;NAK_SIZE/4)。"""
    body = params.get('body') or 'Moon'
    wants = set(int(x) for x in (params.get('values') or []))

    def pred(jd):
        lon = ctx.moment(jd).sid_lon(body)
        pada = int((lon % NAK_SIZE) // (NAK_SIZE / 4.0)) + 1
        return pada in wants
    return true_intervals(pred, domain[0], domain[1], _STEP_MOON if body == 'Moon' else _step_for(body))


def _eval_bhava_from_lagna(params, ctx, domain):
    """[W8] 曜落自 Lagna 第 N 宫(整宫;kendra=1/4/7/10,trikona=1/5/9,dusthana=6/8/12)。"""
    body = params.get('body') or 'Jupiter'
    group = params.get('group') or ''
    wants = set(int(x) for x in (params.get('values') or []))
    if group == 'kendra':
        wants = {1, 4, 7, 10}
    elif group == 'trikona':
        wants = {1, 5, 9}
    elif group == 'dusthana':
        wants = {6, 8, 12}

    def pred(jd):
        m = ctx.moment(jd)
        h = ((m.sign(body) - m.asc_sign()) % 12) + 1
        return h in wants
    return true_intervals(pred, domain[0], domain[1], _asc_step(ctx.lat))


def _eval_day_night_in(params, ctx, domain):
    """[W8] 昼/夜段(日出界;七政 day_night 同语义)。"""
    want = params.get('value') or 'day'
    out = []
    for rise, set_, next_rise, _v in _iter_days(ctx, domain):
        if want == 'day':
            out.append((rise, set_))
        else:
            out.append((set_, next_rise))
    out = [(max(a, domain[0]), min(b, domain[1])) for a, b in out if b > domain[0] and a < domain[1]]
    return norm_intervals(out)


def _eval_tara_bala(params, ctx, domain):
    """本命组:候选月宿相对本命月宿的 Tara(1..9 循环);吉 Tara 集可选。"""
    if not ctx.natal_moon_nak:
        raise ValueError('tara_bala requires natal.moonNak')
    # 默认吉集=经典主流五吉(2 Sampat/4 Kshema/6 Sadhaka/8 Mitra/9 Param Mitra);
    # Janma(1) 主流计凶避用,不入默认(可手选)。
    wants = set(int(x) for x in (params.get('values') or [2, 4, 6, 8, 9]))

    def pred(jd):
        t = ((ctx.moment(jd).nak('Moon') - ctx.natal_moon_nak) % 27) % 9 + 1
        return t in wants
    return true_intervals(pred, domain[0], domain[1], _STEP_MOON)


def _eval_chandra_bala(params, ctx, domain):
    """本命组:候选月座相对本命月座位次(1..12);吉位 1/3/6/7/10/11 默认。"""
    if ctx.natal_moon_sign < 0:
        raise ValueError('chandra_bala requires natal.moonSign')
    wants = set(int(x) for x in (params.get('values') or [1, 3, 6, 7, 10, 11]))

    def pred(jd):
        pos = (ctx.moment(jd).sign('Moon') - ctx.natal_moon_sign) % 12 + 1
        return pos in wants
    return true_intervals(pred, domain[0], domain[1], _STEP_MOON)


CONDITION_TYPES = {
    'tithi': {'required': ('values',)},
    'vara': {'required': ('values',)},
    'nakshatra': {'required': ('values',)},
    'yoga': {'required': ('values',)},
    'karana': {'required': ('values',)},
    'lagna': {'required': ('values',)},
    'planet_sign': {'required': ('body', 'values')},
    'retro': {'required': ('body',)},
    'day_kalam': {'required': ()},
    'muhurta_seg': {'required': ()},
    'choghadia': {'required': ()},
    'hora_vedic': {'required': ('values',)},
    'panchaka': {'required': ()},
    'nak_pada': {'required': ('values',)},
    'bhava_from_lagna': {'required': ('body',)},
    'day_night_in': {'required': ()},
    'tara_bala': {'required': ()},
    'chandra_bala': {'required': ()},
}

_EVALUATORS = {
    'tithi': _eval_tithi,
    'vara': _eval_vara,
    'nakshatra': _eval_nakshatra,
    'yoga': _eval_yoga,
    'karana': _eval_karana,
    'lagna': _eval_lagna,
    'planet_sign': _eval_planet_sign,
    'retro': _eval_retro,
    'day_kalam': _eval_day_kalam,
    'muhurta_seg': _eval_muhurta_seg,
    'choghadia': _eval_choghadia,
    'hora_vedic': _eval_hora_vedic,
    'panchaka': _eval_panchaka,
    'nak_pada': _eval_nak_pada,
    'bhava_from_lagna': _eval_bhava_from_lagna,
    'day_night_in': _eval_day_night_in,
    'tara_bala': _eval_tara_bala,
    'chandra_bala': _eval_chandra_bala,
}

_validate_tree = make_validate(CONDITION_TYPES)
_eval_node = make_tree_evaluator(_EVALUATORS, iv_and, iv_or, iv_not, iv_xor)

# 日出界条件依赖公历 date 对象(datetime.date 拒 y≤0),BC 域负年串还会炸
# _vara_of_rise 的 split 解析——诚实拒扫,勿让合法树报成 invalid_conditions。
_SUNRISE_TYPES = ('vara', 'day_kalam')


def _tree_has_types(tree, kinds):
    if not isinstance(tree, dict):
        return False
    t = tree.get('type')
    if t in GROUP_TYPES:
        return any(_tree_has_types(c, kinds) for c in (tree.get('conditions') or []))
    return t in kinds


def scan(data):
    from websrv._guards import validate_geo
    geoerr = validate_geo(data)
    if geoerr is not None:
        return geoerr
    zone = data.get('zone', '+08:00')
    ad = int(data.get('ad') or 1)
    try:
        jd0 = _jd_from(data['startDate'], data.get('startTime', '00:00:00'), zone, ad)
        jd1 = _jd_from(data['endDate'], data.get('endTime', '23:59:59'), zone, ad)
    except (KeyError, ValueError, IndexError) as exc:
        return {'err': 'invalid_range', 'detail': str(exc)}
    if jd1 <= jd0:
        return {'err': 'invalid_range', 'detail': 'end must be after start'}
    if jd1 - jd0 > MAX_SPAN_DAYS:
        return {'err': 'span_too_large',
                'detail': 'span {0:.1f}d exceeds {1}d; split the request'.format(jd1 - jd0, MAX_SPAN_DAYS)}
    tree = data.get('conditions')
    try:
        _validate_tree(tree)
        ctx = IndiaScanContext(data)
    except (ValueError, TypeError) as exc:
        return {'err': 'invalid_conditions', 'detail': str(exc)}
    if ad == -1 and _tree_has_types(tree, _SUNRISE_TYPES):
        return {'err': 'invalid_conditions',
                'detail': 'vara/day_kalam depend on Gregorian sunrise dates; BC era not supported'}
    try:
        ivs = _eval_node(tree, ctx, (jd0, jd1))
    except (ValueError, TypeError, KeyError) as exc:
        return {'err': 'invalid_conditions', 'detail': str(exc)}
    ivs = norm_intervals(ivs)
    truncated = len(ivs) > MAX_INTERVALS
    if truncated:
        ivs = ivs[:MAX_INTERVALS]
    out = []
    for s, e in ivs:
        # 分钟向内对齐(qizheng 同修):start 秒位>0 进位整分,end 剁秒 floor,空行丢弃——
        # 行文本内每一整分钟都判真。
        # jd 域纯数值分钟 ceil(墙钟栅格=jd 栅格平移 zone 固定偏移):曾按文本秒场取整——
        # 亚秒残余(02:48:00.4 秒场='00')不进位,行首整点仍在界外 0.4s,探针实抓。
        # 容差 1e-6 天≈0.09s:恰整分(浮点残余)不虚进一格。
        off = _zone_days(zone)
        s2 = math.ceil((s + off) * 1440.0 - 1e-6) / 1440.0 - off
        e2 = math.ceil((e + off) * 1440.0 - 1e-6) / 1440.0 - off
        # 尾行 clamp 回窗内(endTime=…:59 时 ceil 会越出请求窗一分钟,与本地引擎
        # makeRow 的 min(endMsRaw,t1) 截窗语义对齐;复审 F14)
        e2 = min(e2, math.floor((jd1 + _zone_days(zone)) * 1440.0 + 1e-6) / 1440.0 - _zone_days(zone))
        # 🔴 空行判在 jd 域比较(复审 F1 实抓:文本字典序对天文负年反向——
        # '-1044-12-31'>'-1043-01-01',BC 跨公历年整行被误判倒挂丢弃;5 位年同病)
        if e2 - s2 < 0.5 / 1440.0:
            continue
        rec_s = date_time_from_jd(s2, zone)
        rec_e = date_time_from_jd(e2, zone)
        start_txt = rec_s['datetime'].rsplit(':', 1)[0]
        end_txt = rec_e['datetime'].rsplit(':', 1)[0]
        eps = min(90.0 / 86400.0, max(0.0, (e - s2)) / 4.0)  # pick 锚真界 e(非 e2),恒在界内
        rec_p = date_time_from_jd(s2 + eps, zone)
        out.append({'start': start_txt,
                    'end': end_txt,
                    'pick': rec_p['datetime'].rsplit(':', 1)[0]})
    return {'intervals': out, 'truncated': truncated,
            'stats': {'evalPoints': ctx.eval_points, 'ayanamsa': ctx.ayan_key}}


def explain_at(data):
    zone = data.get('zone', '+08:00')
    ad = int(data.get('ad') or 1)
    t = data.get('t') or ''
    try:
        d_part, t_part = t.split(' ')
        jd = _jd_from(d_part, t_part + (':00' if len(t_part) == 5 else ''), zone, ad)
    except (ValueError, IndexError) as exc:
        return {'err': 'invalid_time', 'detail': str(exc)}
    tree = data.get('conditions')
    try:
        _validate_tree(tree)
        ctx = IndiaScanContext(data)
    except (ValueError, TypeError) as exc:
        return {'err': 'invalid_conditions', 'detail': str(exc)}
    if ad == -1 and _tree_has_types(tree, _SUNRISE_TYPES):
        return {'err': 'invalid_conditions',
                'detail': 'vara/day_kalam depend on Gregorian sunrise dates; BC era not supported'}
    eps = 30.0 / 86400.0

    def node_explain(node):
        ttype = node.get('type')
        if ttype in GROUP_TYPES:
            children = [node_explain(c) for c in (node.get('conditions') or [])]
            passes = [c['pass'] for c in children]
            if ttype == 'any':
                ok = any(passes)
            elif ttype == 'not':
                ok = not all(passes)
            elif ttype == 'xor':
                ok = (sum(1 for p in passes if p) % 2) == 1
            else:
                ok = all(passes)
            return {'kind': 'group', 'op': ttype, 'pass': ok, 'children': children}
        try:
            ivs = _EVALUATORS[ttype](node.get('params') or {}, ctx, (jd - eps, jd + eps))
            ok = any(s <= jd <= e for s, e in ivs)
        except ValueError as exc:
            return {'kind': 'leaf', 'type': ttype, 'pass': False, 'actual': str(exc)}
        m = ctx.moment(jd)
        try:
            vara_txt = m.vara()
        except Exception:
            vara_txt = u'—'   # BC 域日出界不可算,actual 其余肢照常
        actual = u'tithi{0}·vara{1}·月宿{2}·yoga{3}·lagna{4}'.format(
            m.tithi(), vara_txt, m.nak('Moon'), m.yoga(), m.asc_sign() + 1)
        # [W8] 新时段/派生类 actual 追加专属读数(详情面「实际」列可读)
        if ttype == 'nak_pada':
            body = (node.get('params') or {}).get('body') or 'Moon'
            lon = m.sid_lon(body)
            actual = u'{0}·{1}宿足{2}'.format(actual, body, int((lon % NAK_SIZE) // (NAK_SIZE / 4.0)) + 1)
        elif ttype == 'bhava_from_lagna':
            body = (node.get('params') or {}).get('body') or 'Jupiter'
            actual = u'{0}·{1}落第{2}宫'.format(actual, body, ((m.sign(body) - m.asc_sign()) % 12) + 1)
        elif ttype == 'panchaka':
            rem = ((m.tithi() + (m.vara() + 1) + m.nak('Moon') + (m.asc_sign() + 1)) * 2) % 9
            actual = u'{0}·panchaka余{1}({2})'.format(actual, rem, PANCHAKA_TYPES.get(rem, u'无忌'))
        return {'kind': 'leaf', 'type': ttype, 'pass': ok, 'actual': actual}

    return {'tree': node_explain(tree)}
