# -*- coding: utf-8 -*-
"""[Z7] 七政四余·择日征象扫描引擎(纯 swisseph 直连,分钟粒度)。

架构(与 election_scan.py 天星引擎同族,经 election_scan_kernel 共用树校验/求值;
区间代数 norm_intervals/iv_*/true_intervals 直接 import 天星引擎,零复制):
  QizhengScanContext —— 单请求上下文(地点/宿制/口径+QizhengMoment per-jd 缓存)
  QizhengMoment —— 单时刻惰性快照(11 曜黄经/速度/地平,swisseph 直连 ~0.1ms/曜)

判定表单源(制度层1):宿界/庙旺/化曜/四余谱全取 astrostudy.guolao_const ——
与前端 guolaoData.js 成对(两侧 golden + qizhengElectionParity jest 逐值 diff 看守);
主表修正,扫描自动跟。

🔴 口径首版收敛(死开关律,工作台只放实装档):
  · 宿界=su28Mode 2(回归今宿:28 距星活体 tropical 黄经,perchart._moira_distar_lons
    严格 IAU 岁差)/3(回归古制:开禧基值+活 ayanamsha 1300/4.0)——与主页
    getMoiraFixedStarSu28 同两档**同一函数/常量源**。曾用 guolao_const 线性距度表,
    与主页界差最大 2.18°、mode3 整表错位 3.7°(审查实抓,界带内判宿相反);线性表
    只留展示层,判定禁用。主页另有七档(恒星/赤道/授时历古法等)coverage/帮助明示 gap。
  · 十二宫=回归黄经 12 等分(地支宫,戌宫起白羊,与前端 PALACE_LORD 地支序同源);
    命宫=ASC 所落地支宫(lifeMode=asc 档)。
  · 罗计=平/真交点两档(nodeType);🔴 罗睺=升交点(swisseph node 直取)、计都=+180°,
    与 Java QizhengMoiraRuleService「North Node→罗」/AstroConst NORTH_NODE→罗睺/
    flatlib 全链同口径(曾互换,审查实抓);月孛=平/真远地点(lilithType);
    紫炁=28 年平行度(flatlib ephem.tools.pcLon 同式,主页盘唯一口径;曾错用
    OSCU_APOG 振荡远地点,与主页差 ~99° 且 lilithType=true 时紫炁≡月孛)。
"""
import math

import swisseph

from astrostudy import guolao_const as gc
from astrostudy.election_scan import (
    _jd_from, _norm360, norm_intervals, iv_and, iv_or, iv_not, iv_xor,
    true_intervals, date_time_from_jd,
)
from astrostudy.election_scan_kernel import GROUP_TYPES, make_validate, make_tree_evaluator
# 宿界同源(制度层1):mode2 活体距星/mode3 开禧+ayanamsha 与主页 getMoiraFixedStarSu28
# 共用同一函数与常量表——perchart 侧修距星表/岁差,扫描自动跟。
from astrostudy.perchart import (
    MOIRA_KAIXI_STELLAR_DEGREES, MOIRA_STELLAR_ORDER, _moira_ayanamsha, _moira_distar_lons,
)

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

# 11 曜(七政+四余;键=中文,前端条件参数同名)。
QIZHENG_BODIES = ['日', '月', '金', '木', '水', '火', '土', '罗睺', '计都', '月孛', '紫炁']
_SWE = {
    '日': swisseph.SUN, '月': swisseph.MOON, '金': swisseph.VENUS, '木': swisseph.JUPITER,
    '水': swisseph.MERCURY, '火': swisseph.MARS, '土': swisseph.SATURN,
}
# 地支十二宫(黄经段):戌宫=白羊 0°-30°(七政「戌为降娄」传统),逆黄道序排地支。
# 黄经 λ 所在宫 = GONG_SEQ[int(λ/30)];与前端 signToPalaceZhi(guolaoData PALACE_LORD 键序)同源。
GONG_SEQ = ['戌', '酉', '申', '未', '午', '巳', '辰', '卯', '寅', '丑', '子', '亥']


class QizhengScanContext(object):
    def __init__(self, data):
        self.zone = data.get('zone', '+08:00')
        self.lat = float(data.get('gpsLat'))
        self.lon = float(data.get('gpsLon'))
        self.alt = float(data.get('height') or 0.0)
        self.su28_mode = int(data.get('su28Mode', 2) or 2)
        if self.su28_mode not in (2, 3):
            raise ValueError('su28Mode {0!r} not supported by scan (only 2/3)'.format(self.su28_mode))
        node_type = str(data.get('nodeType') or 'mean').lower()
        self.node_swe = swisseph.TRUE_NODE if node_type == 'true' else swisseph.MEAN_NODE
        lilith_type = str(data.get('lilithType') or 'mean').lower()
        self.apog_swe = getattr(swisseph, 'OSCU_APOG', 13) if lilith_type == 'true' else swisseph.MEAN_APOG
        self.combust_orb = float(data.get('combustOrb') or 8.0)
        self.fu_orb = float(data.get('fuOrb') or 3.0)
        self._moments = {}
        self._xiu_cum_cache = {}
        self.eval_points = 0

    def moment(self, jd):
        m = self._moments.get(jd)
        if m is None:
            m = QizhengMoment(jd, self)
            self._moments[jd] = m
            self.eval_points += 1
        return m

    def xiu_bounds(self, jd):
        """当日 28 宿界环表 [(起点黄经, 宿名)] 升序——与主页 getMoiraFixedStarSu28
        同源:mode2=活体距星 tropical 黄经(严格 IAU 岁差,逐宿不均匀),
        mode3=开禧基值+活 ayanamsha(非冻结)。每日一缓存(日内漂移 <0.01°)。"""
        key = int(jd)
        v = self._xiu_cum_cache.get(key)
        if v is None:
            if self.su28_mode == 3:
                ayan = _moira_ayanamsha(jd)
                pairs = [((MOIRA_KAIXI_STELLAR_DEGREES[i] + ayan) % 360.0, MOIRA_STELLAR_ORDER[i])
                         for i in range(28)]
            else:
                lon_by_name = _moira_distar_lons(jd)
                pairs = [(lon_by_name[n] % 360.0, n) for n in MOIRA_STELLAR_ORDER]
            v = sorted(pairs)
            self._xiu_cum_cache[key] = v
        return v

    def xiu_of(self, jd, lon):
        """黄经→宿名:λ 落 [界_i, 界_i+1) 归 i 宿;小于首界=跨 0° 环段,归末宿。"""
        bounds = self.xiu_bounds(jd)
        x = _norm360(lon)
        if x < bounds[0][0]:
            return bounds[-1][1]
        name = bounds[-1][1]
        for b, n in bounds:
            if x >= b:
                name = n
            else:
                break
        return name


class QizhengMoment(object):
    __slots__ = ('jd', 'ctx', '_lon', '_speed', '_hor', '_asc')

    def __init__(self, jd, ctx):
        self.jd = jd
        self.ctx = ctx
        self._lon = {}
        self._speed = {}
        self._hor = {}
        self._asc = None

    def _calc(self, body):
        if body in _SWE:
            res, _f = swisseph.calc_ut(self.jd, _SWE[body], swisseph.FLG_SWIEPH | swisseph.FLG_SPEED)
            return _norm360(res[0]), res[3]
        if body == '罗睺':
            # 🔴 罗睺=升交点直取(Java QizhengMoiraRuleService「North Node→罗」全链同口径)
            res, _f = swisseph.calc_ut(self.jd, self.ctx.node_swe, swisseph.FLG_SWIEPH | swisseph.FLG_SPEED)
            return _norm360(res[0]), res[3]
        if body == '计都':
            lon, sp = self._calc('罗睺')
            return _norm360(lon + 180.0), sp
        if body == '月孛':
            res, _f = swisseph.calc_ut(self.jd, self.ctx.apog_swe, swisseph.FLG_SWIEPH | swisseph.FLG_SPEED)
            return _norm360(res[0]), res[3]
        if body == '紫炁':
            # 28 年平行度(flatlib ephem/tools.py pcLon 同式;主页盘紫炁唯一口径,与
            # lilithType 无关。曾错用 OSCU_APOG——那是月孛真远地点,非紫炁)。
            lon = (188.6849 + 360.0 * (self.jd - 2451543.5) / 10226.78132) % 360.0
            return _norm360(lon), 360.0 / 10226.78132
        raise ValueError('unknown body: {0!r}'.format(body))

    def lon(self, body):
        v = self._lon.get(body)
        if v is None:
            v, sp = self._calc(body)
            self._lon[body] = v
            self._speed[body] = sp
        return v

    def speed(self, body):
        if body not in self._speed:
            self.lon(body)
        return self._speed[body]

    def gong(self, body):
        return GONG_SEQ[int(self.lon(body) // 30.0) % 12]

    def xiu(self, body):
        return self.ctx.xiu_of(self.jd, self.lon(body))

    def sun_alt(self):
        rec = self._hor.get('日')
        if rec is None:
            res, _f = swisseph.calc_ut(self.jd, swisseph.SUN, swisseph.FLG_SWIEPH)
            az = swisseph.azalt(self.jd, swisseph.ECL2HOR,
                                (self.ctx.lon, self.ctx.lat, self.ctx.alt),
                                1013.25, 15.0, [_norm360(res[0]), res[1], 0.0])
            rec = az[1]
            self._hor['日'] = rec
        return rec

    def asc_gong(self):
        if self._asc is None:
            cusps, ascmc = swisseph.houses_ex(self.jd, self.lat_(), self.ctx.lon, b'W')
            self._asc = GONG_SEQ[int(_norm360(ascmc[0]) // 30.0) % 12]
        return self._asc

    def lat_(self):
        return self.ctx.lat


# ── 庙旺(guolao_const DIGNITY_TABLE:行=曜,列=地支宫 子..亥 序列表) ──
def _dignity_of(body, gong):
    row = gc.DIGNITY_TABLE.get(body)
    if not row:
        return ''
    try:
        return row[gc.DIZHI.index(gong)]
    except (ValueError, IndexError):
        return ''


# ── 叶求值器(全 continuous 走 true_intervals;step 按曜速选) ──
_STEP_FAST = 0.5 / 24.0      # 月等快曜:半小时
_STEP_SLOW = 6.0 / 24.0      # 外行星/四余:6 小时


def _step_for(body):
    return _STEP_FAST if body in ('月', '日', '水', '金') else _STEP_SLOW


def _eval_body_in_gong(params, ctx, domain):
    body = params['body']
    wants = set(params.get('values') or [])
    step = _step_for(body)
    return true_intervals(lambda jd: ctx.moment(jd).gong(body) in wants, domain[0], domain[1], step)


def _eval_body_in_xiu(params, ctx, domain):
    body = params['body']
    wants = set(params.get('values') or [])
    step = _step_for(body)
    return true_intervals(lambda jd: ctx.moment(jd).xiu(body) in wants, domain[0], domain[1], step)


def _eval_dignity(params, ctx, domain):
    body = params['body']
    wants = set(params.get('values') or [])
    step = _step_for(body)
    return true_intervals(lambda jd: _dignity_of(body, ctx.moment(jd).gong(body)) in wants,
                          domain[0], domain[1], step)


def _eval_dignity_seven(params, ctx, domain):
    # [W7] 殿垣庙旺乐喜怒七态(js starDignityStatuses 基表镜像;升殿峰值档不入扫描——
    # 需旺度距峰判定,显示层专属)。任一所选状态命中即真。
    body = params['body']
    wants = set(params.get('values') or [])
    step = _step_for(body)

    def pred(jd):
        sts = gc.qizheng_sign_statuses(body, ctx.moment(jd).gong(body))
        return any(st in wants for st in sts)
    return true_intervals(pred, domain[0], domain[1], step)


def _eval_deg_lord(params, ctx, domain):
    body = params['body']
    wants = set(params.get('values') or [])
    step = _step_for(body)

    def pred(jd):
        m = ctx.moment(jd)
        x = m.xiu(body)
        return gc.SU28_DEGREE_LORD[gc.SU28.index(x)] in wants
    return true_intervals(pred, domain[0], domain[1], step)


def _eval_speed_state(params, ctx, domain):
    body = params['body']
    state = params.get('state') or 'retro'
    thr = float(params.get('threshold') or 0.0)

    spec = gc.QIZHENG_SPEED_SPEC.get(body)

    def pred(jd):
        sp = ctx.moment(jd).speed(body)
        if state == 'retro':
            return sp < 0.0
        if state == 'direct':
            return sp > 0.0
        if state == 'stationary':
            return abs(sp) <= (thr or 0.02)
        # [W7] 迟/速两档(js starMotionState 同判据:非留态下 |v|<slow=迟、|v|>fast=速;仅五星有谱)
        if state in ('slow', 'fast'):
            if not spec:
                return False
            a = abs(sp)
            if a < spec['stat']:
                return False
            return a < spec['slow'] if state == 'slow' else a > spec['fast']
        return False
    return true_intervals(pred, domain[0], domain[1], _step_for(body))


def _eval_combust(params, ctx, domain):
    body = params['body']
    mode = params.get('mode') or 'combust'   # combust=焦(默认 8°)/fu=伏(3°)/free=不伏不焦

    def dist(jd):
        m = ctx.moment(jd)
        d = abs(m.lon(body) - m.lon('日'))
        return min(d, 360.0 - d)

    def pred(jd):
        d = dist(jd)
        if mode == 'fu':
            return d <= ctx.fu_orb
        if mode == 'free':
            return d > ctx.combust_orb
        return d <= ctx.combust_orb
    return true_intervals(pred, domain[0], domain[1], _step_for(body))


def _lat_step(lat, base, mid, high):
    """高纬采样加密:|lat|≥60° 昼夜窗/快升宫窗可短至分钟级(66°N 戌宫真升窗仅 ~4
    分钟,20 分步整窗漏检——审查实抓);50-60° 过渡带用中档。"""
    a = abs(lat or 0.0)
    if a >= 60.0:
        return high
    if a >= 50.0:
        return mid
    return base


def _eval_day_night(params, ctx, domain):
    want_day = (params.get('value') or 'day') == 'day'
    step = _lat_step(ctx.lat, 1.5 / 24.0, 0.5 / 24.0, 10.0 / 1440.0)
    return true_intervals(lambda jd: (ctx.moment(jd).sun_alt() > 0.0) == want_day,
                          domain[0], domain[1], step)


def _eval_asc_gong(params, ctx, domain):
    wants = set(params.get('values') or [])
    # ASC 中纬约 2 小时过一宫:20 分钟步;高纬快升宫按 _lat_step 加密
    step = _lat_step(ctx.lat, 20.0 / 1440.0, 5.0 / 1440.0, 2.0 / 1440.0)
    return true_intervals(lambda jd: ctx.moment(jd).asc_gong() in wants,
                          domain[0], domain[1], step)


def _eval_body_rel(params, ctx, domain):
    a = params['bodyA']
    b = params['bodyB']
    rel = params.get('rel') or 'same'
    step = min(_step_for(a), _step_for(b))

    def pred(jd):
        m = ctx.moment(jd)
        ga = int(m.lon(a) // 30.0) % 12
        gb = int(m.lon(b) // 30.0) % 12
        d = (ga - gb) % 12
        if rel == 'same':
            return d == 0
        if rel == 'opposite':
            return d == 6
        if rel == 'trine':
            return d == 4 or d == 8
        return False
    return true_intervals(pred, domain[0], domain[1], step)


def _eval_hua_lu(params, ctx, domain):
    """化曜(年干禄主等)落宫/宿:年干由候选时刻立春界推;禄主=HUAYAO_A[年干]。"""
    wants = set(params.get('values') or [])
    where = params.get('where') or 'gong'

    def pred(jd):
        # 年干:粗取公历年立春(2/4)界;误差窗(2/3-2/5)按 jd 精算成本高,先近似+详情注记
        rec = date_time_from_jd(jd, ctx.zone)
        # 负年(天文纪年 '-1044-02-01')安全解析:rsplit 保号位,勿用 [:4] 截断
        d_part = rec['datetime'].split(' ')[0]
        seg = d_part.rsplit('-', 2)
        y = int(seg[0])
        md = seg[1] + '-' + seg[2]
        if md < '02-04':
            y -= 1
        gan = '甲乙丙丁戊己庚辛壬癸'[(y - 4) % 10]
        star = gc.HUAYAO_A.get(gan)
        if star is None:
            return False
        body = {'火': '火', '木': '木', '金': '金', '土': '土', '水': '水',
                '太阴': '月', '月孛': '月孛', '紫炁': '紫炁', '计都': '计都', '罗睺': '罗睺'}.get(star)
        if body is None:
            return False
        m = ctx.moment(jd)
        cur = m.gong(body) if where == 'gong' else m.xiu(body)
        return cur in wants
    # 🔴 步长按最快可能化曜取:己年化禄=太阴(13.2°/日,觜宿 1° 真窗仅 ~1.8h),
    # 6h 慢步会整窗漏检(审查实抓);统一 0.5h 快步(年内单曜,采样成本可忽略)。
    return true_intervals(pred, domain[0], domain[1], _STEP_FAST)


CONDITION_TYPES = {
    'body_in_gong': {'required': ('body', 'values')},
    'body_in_xiu': {'required': ('body', 'values')},
    'dignity': {'required': ('body', 'values')},
    'dignity_seven': {'required': ('body', 'values')},
    'deg_lord': {'required': ('body', 'values')},
    'speed_state': {'required': ('body',)},
    'combust': {'required': ('body',)},
    'day_night': {'required': ()},
    'asc_gong': {'required': ('values',)},
    'body_rel': {'required': ('bodyA', 'bodyB')},
    'hua_lu': {'required': ('values',)},
}

_EVALUATORS = {
    'body_in_gong': _eval_body_in_gong,
    'body_in_xiu': _eval_body_in_xiu,
    'dignity': _eval_dignity,
    'dignity_seven': _eval_dignity_seven,
    'deg_lord': _eval_deg_lord,
    'speed_state': _eval_speed_state,
    'combust': _eval_combust,
    'day_night': _eval_day_night,
    'asc_gong': _eval_asc_gong,
    'body_rel': _eval_body_rel,
    'hua_lu': _eval_hua_lu,
}

_validate_tree = make_validate(CONDITION_TYPES)
_eval_node = make_tree_evaluator(_EVALUATORS, iv_and, iv_or, iv_not, iv_xor)


def scan(data):
    """七政择日扫描入口;返回 {'intervals': [...], 'truncated': bool, 'stats': {...}}。"""
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
        ctx = QizhengScanContext(data)
    except (ValueError, TypeError) as exc:
        return {'err': 'invalid_conditions', 'detail': str(exc)}

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
        # 🔴 分钟向内对齐:真区间是秒级浮点,start 直剁秒=下取整——行首那一分钟实际可在
        # 界外(最多 59 秒,压测行内探针实抓 asc 快升窗 02:48 判假)。start 秒位>0 则进位到
        # 下一整分钟;end 剁秒天然 floor;对齐后空行(真窗 <1 分钟)丢弃——「行文本内每一
        # 整分钟都判真」语义 by construction 成立。
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
        out.append({
            'start': start_txt,
            'end': end_txt,
            'pick': rec_p['datetime'].rsplit(':', 1)[0],
        })
    return {'intervals': out, 'truncated': truncated,
            'stats': {'evalPoints': ctx.eval_points, 'suMode': ctx.su28_mode}}


def explain_at(data):
    """单时刻逐叶判读(与扫描同源求值;供详情面)。data 须含 t='YYYY-MM-DD HH:mm'。"""
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
        ctx = QizhengScanContext(data)
    except (ValueError, TypeError) as exc:
        return {'err': 'invalid_conditions', 'detail': str(exc)}
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
        ivs = _EVALUATORS[ttype](node.get('params') or {}, ctx, (jd - eps, jd + eps))
        ok = any(s <= jd <= e for s, e in ivs)
        m = ctx.moment(jd)
        params = node.get('params') or {}
        body = params.get('body')
        actual = ''
        if body:
            actual = u'{0}:{1}宫·{2}宿·速{3:+.3f}'.format(
                body, m.gong(body), m.xiu(body), m.speed(body))
            # [W7] 七态类 actual 追加当支状态串(详情面「实际」列可读)
            if ttype == 'dignity_seven':
                sts = gc.qizheng_sign_statuses(body, m.gong(body))
                actual = u'{0}·态:{1}'.format(actual, u'/'.join(sts) if sts else u'无')
        return {'kind': 'leaf', 'type': ttype, 'pass': ok, 'actual': actual}

    return {'tree': node_explain(tree)}
