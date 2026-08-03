# -*- coding: utf-8 -*-
"""天星择日·征象搜索引擎(Calculate 侧;动盘侧见 websrv/webqizhengelectionsrv.py)。

给定 时间段+地点+盘面口径+条件树,输出「条件树成立的时间区间」列表。

架构(与前端 src/divination/zeri/ 成对):
  · 条件树:组节点 {type: all|any|not|xor, conditions:[...]}(语义照 financial._event_match:
    all=与/any=或/not=单子取反/xor=奇数个为真),叶节点 {type:<CONDITION_TYPES 键>, params:{...}}。
  · 叶子三类:
      continuous — 把条件写成残差 g(jd)=|角差|-orb 之类的连续函数,粗扫变号+二分求根
                   (照 pd_engine._find_roots 的时间轴版),得角秒级精度的区间;
      boolean    — 布尔谓词 P(jd) 按叶子尺度粗扫+翻转点二分;
      generative — 纯历法/天象解析直接生成周期区间(日窗/昼夜),零采样。
  · 组节点=区间代数:AND=交 / OR=并 / NOT=补 / XOR=扫描线奇偶。区间一律半开 [s, e)。
  · 每请求一个 ScanContext:{jd: LightMoment} 惰性快照缓存,条件树全部叶子共享同一时刻
    的行星/宫位计算(swisseph 调用只发生一次)。

黄道制:内部一律回归框架计算;恒星制(zodiacal=1)只在「星座归属/绝对黄经」判定处减
  ayanamsa(jd)——角差类(相位/中点/围攻)对 ayanamsa 不变,宫位判定行星与宫头同框架、
  差值不变,故均无需恒星化。set_sid_mode 仅在取 ayanamsa 时 set→use 相邻两行
  (swisseph sid_mode 是进程级全局态,并发纪律见 tests/test_swe_concurrency.py)。

dexter/sinister 单源定义(前端 conditionGlyph.js 注释逐字同款,勿各表):
  以施方 A 为基,d = wrap180(lonB - lonA) ∈ (-180, 180];
  d < 0 = dexter(右旋光线,B 在 A 的逆黄道序方向), d > 0 = sinister(左旋)。
  angle=0/180 时左右无意义(调用方应传 side='any')。

上限防呆:单请求跨度 ≤ MAX_SPAN_DAYS 天;输出区间 ≤ MAX_INTERVALS 条(截断置 truncated)。
"""

import swisseph

import flatlib.ephem.swe  # noqa: F401  副作用:激活打包星历路径(set_ephe_path 守卫)
from astrostudy.astroextra import zone_value, date_time_from_jd

# ---------------------------------------------------------------------------
# 条件类型注册表 —— 前后端契约锚点
# ---------------------------------------------------------------------------
# ⚠ 本表被前端一致性哨兵(jest 读本文件 + 正则逐键解析)机器比对:
#   1) 保持「'键': {...},」一键一行的书写格式,勿合并行/勿改引号风格;
#   2) 只登记「后端已实现求值器」的键(杜绝前端可选、后端没有的死开关);
#   3) 增删键必同步前端 src/divination/zeri/conditionTypes.js,哨兵双向差空才放行。
CONDITION_TYPES = {
    'aspect': {'category': 'continuous', 'required': ('planetA', 'planetB', 'angle', 'orb')},
    'in_sign': {'category': 'continuous', 'required': ('planet', 'signs')},
    'numeric': {'category': 'continuous', 'required': ('planet', 'field', 'op', 'value')},
    'midpoint': {'category': 'continuous', 'required': ('a', 'b', 'target', 'modulus', 'orb')},
    'point_relation': {'category': 'continuous', 'required': ('planet', 'point', 'relation')},
    'in_house': {'category': 'boolean', 'required': ('planet', 'houses')},
    'reception': {'category': 'boolean', 'required': ('planetA', 'planetB')},
    'mutual_reception': {'category': 'boolean', 'required': ('planetA', 'planetB')},
    'rulership': {'category': 'boolean', 'required': ('planetA', 'planetB', 'mode')},
    'dignity_state': {'category': 'boolean', 'required': ('planet', 'states')},
    'considerations': {'category': 'boolean', 'required': ('item',)},
    'besieged': {'category': 'boolean', 'required': ('target', 'besiegerA', 'besiegerB')},
    'aspect_pattern': {'category': 'boolean', 'required': ('pattern',)},
    'chart_shape': {'category': 'boolean', 'required': ('shape',)},
    'day_window': {'category': 'generative', 'required': ('from', 'to')},
    'light_dynamics': {'category': 'boolean', 'required': ('item',)},
    'royal_attendance': {'category': 'boolean', 'required': ('ref', 'slot', 'companion')},
    'sect_joy': {'category': 'boolean', 'required': ('item',)},
    'degree_state': {'category': 'boolean', 'required': ('planet', 'item')},
    'decan_state': {'category': 'boolean', 'required': ('mode',)},
    'pattern_overview': {'category': 'boolean', 'required': ('item',)},
    'dispositor_cycle': {'category': 'boolean', 'required': ('mode',)},
    'almuten_is': {'category': 'boolean', 'required': ('scope', 'planet')},
    'distribution_state': {'category': 'boolean', 'required': ('axis', 'key', 'op')},
    'temperament': {'category': 'boolean', 'required': ('kind', 'value')},
    'accidental_score': {'category': 'boolean', 'required': ('planet', 'op')},
    'classical_pattern': {'category': 'boolean', 'required': ('pattern',)},
    'eminence_level': {'category': 'boolean', 'required': ('op',)},
    'antiscia': {'category': 'continuous', 'required': ('planet', 'kind', 'target', 'orb')},
    'fixed_star': {'category': 'continuous', 'required': ('star', 'target', 'orb')},
    'planetary_hour': {'category': 'generative', 'required': ('kind', 'planet')},
    'lifespan_state': {'category': 'boolean', 'required': ('item',)},
}
# 预留扩展位(设计留档,实现后才准入上表): in_sign / in_house / reception /
# mutual_reception / rulership / besieged / dignity_state / considerations /
# aspect_pattern / point_relation / numeric / chart_shape / midpoint / day_window;
# 更远期: antiscia / fixed_star / planetary_hour。

GROUP_TYPES = ('all', 'any', 'not', 'xor')

MAX_SPAN_DAYS = 93.0
MAX_INTERVALS = 600

# 天体注册:键 = 前端 chartId(flatlib const 同名)。South Node 由 North Node 派生。
_SWE_BODY = {
    'Sun': swisseph.SUN,
    'Moon': swisseph.MOON,
    'Mercury': swisseph.MERCURY,
    'Venus': swisseph.VENUS,
    'Mars': swisseph.MARS,
    'Jupiter': swisseph.JUPITER,
    'Saturn': swisseph.SATURN,
    'Uranus': swisseph.URANUS,
    'Neptune': swisseph.NEPTUNE,
    'Pluto': swisseph.PLUTO,
    'Chiron': swisseph.CHIRON,
}

# 黄经最大日速(度/日,含逆行段的保守上界)——步长自适应用。
_MAX_SPEED = {
    'Sun': 1.03, 'Moon': 15.5, 'Mercury': 2.3, 'Venus': 1.3, 'Mars': 0.9,
    'Jupiter': 0.3, 'Saturn': 0.2, 'Uranus': 0.1, 'Neptune': 0.1, 'Pluto': 0.1,
    'North Node': 0.3, 'South Node': 0.3, 'Chiron': 0.2,
}


def _norm360(x):
    v = float(x) % 360.0
    return v + 360.0 if v < 0 else v


def _wrap180(x):
    """角差归一到 (-180, 180]。"""
    v = (float(x) + 180.0) % 360.0 - 180.0
    return 180.0 if v == -180.0 else v


def _jd_from(date_text, time_text, zone, ad=1):
    """本地 date/time/zone → UT 儒略日。date 收 'YYYY/MM/DD' 或 'YYYY-MM-DD';ad=-1 → 天文年号 1-y。"""
    parts = str(date_text).replace('-', '/').split('/')
    y, m, d = int(parts[0]), int(parts[1]), int(parts[2])
    if int(ad or 1) < 0:
        y = 1 - y
    seg = (str(time_text or '00:00:00').split(':') + ['0', '0'])[:3]
    hh, mm, ss = int(seg[0]), int(seg[1] or 0), int(seg[2] or 0)
    local_jd = swisseph.julday(y, m, d, hh + mm / 60.0 + ss / 3600.0)
    return local_jd - zone_value(zone) / 24.0


# ---------------------------------------------------------------------------
# 区间代数(半开区间 [s, e),单位=jd)
# ---------------------------------------------------------------------------

def norm_intervals(ivs):
    """排序 + 合并重叠/相邻,返回不相交升序表。"""
    out = []
    for s, e in sorted((float(s), float(e)) for s, e in ivs if e > s):
        if out and s <= out[-1][1]:
            if e > out[-1][1]:
                out[-1] = (out[-1][0], e)
        else:
            out.append((s, e))
    return [(s, e) for s, e in out]


def iv_and(a, b):
    out, i, j = [], 0, 0
    a, b = norm_intervals(a), norm_intervals(b)
    while i < len(a) and j < len(b):
        s = max(a[i][0], b[j][0])
        e = min(a[i][1], b[j][1])
        if e > s:
            out.append((s, e))
        if a[i][1] < b[j][1]:
            i += 1
        else:
            j += 1
    return out


def iv_or(a, b):
    return norm_intervals(list(a) + list(b))


def iv_not(a, domain):
    d0, d1 = domain
    out, cur = [], d0
    for s, e in norm_intervals(a):
        s, e = max(s, d0), min(e, d1)
        if e <= s:
            continue
        if s > cur:
            out.append((cur, s))
        cur = max(cur, e)
    if cur < d1:
        out.append((cur, d1))
    return out


def iv_xor(sets, domain):
    """多输入 XOR = 覆盖集数为奇数的区段(扫描线;每个输入集先自归一)。"""
    events = []
    d0, d1 = domain
    for ivs in sets:
        for s, e in norm_intervals(ivs):
            s, e = max(s, d0), min(e, d1)
            if e > s:
                events.append((s, 1))
                events.append((e, -1))
    if not events:
        return []
    events.sort()
    out, depth, prev = [], 0, None
    for x, delta in events:
        if prev is not None and x > prev and depth % 2 == 1:
            out.append((prev, x))
        depth += delta
        prev = x
    return norm_intervals(out)


# ---------------------------------------------------------------------------
# 求根 / 翻转检测(照 pd_engine._find_roots 的时间轴版)
# ---------------------------------------------------------------------------

def _find_roots_time(f, jd0, jd1, step):
    """扫 [jd0, jd1] 找 f 的符号变化并 60 轮二分;|Δf|<90 防角度 wrap 假变号。返回全部根(升序)。"""
    roots = []
    n = max(1, int((jd1 - jd0) / step))
    d0 = jd0
    f0 = f(d0)
    for i in range(1, n + 2):
        d1 = min(jd0 + i * step, jd1)
        if d1 <= d0:
            break
        f1 = f(d1)
        if f0 == 0.0:
            roots.append(d0)
        elif f0 * f1 < 0 and abs(f1 - f0) < 90:
            a, b, fa = d0, d1, f0
            for _ in range(60):
                mid = 0.5 * (a + b)
                fm = f(mid)
                if fa * fm <= 0:
                    b = mid
                else:
                    a, fa = mid, fm
            roots.append(0.5 * (a + b))
        d0, f0 = d1, f1
        if d1 >= jd1:
            break
    return roots


def negative_intervals(g, jd0, jd1, step):
    """g(jd) < 0 的区段(半开)。根=g 的零点;逐段中点判号。
    变号根之外另做窄谷捕捉:粗扫样本局部极小(下凹)且 g>0 处三分法收缩,谷底真负才补根——
    防「负谷宽 ≪ 粗扫步长」整段漏检(实案:速度类窄 between 于水星留,谷宽 3h vs 步长 1d);
    谷底非负则不加根=与纯变号法行为逐字节一致,绝不误加。"""
    n = max(1, int((jd1 - jd0) / step))
    xs = [jd0 + i * step for i in range(n + 1)]
    if xs[-1] < jd1:
        xs.append(jd1)
    else:
        xs[-1] = jd1
    gs = [g(x) for x in xs]
    roots = []
    for i in range(len(xs) - 1):
        f0, f1 = gs[i], gs[i + 1]
        if f0 == 0.0:
            roots.append(xs[i])
        elif f0 * f1 < 0 and abs(f1 - f0) < 90:
            a, b, fa = xs[i], xs[i + 1], f0
            for _ in range(60):
                mid = 0.5 * (a + b)
                fm = g(mid)
                if fa * fm <= 0:
                    b = mid
                else:
                    a, fa = mid, fm
            roots.append(0.5 * (a + b))
    for i in range(1, len(xs) - 1):
        if not (gs[i - 1] > gs[i] <= gs[i + 1] and gs[i] > 0.0):
            continue
        a, b = xs[i - 1], xs[i + 1]
        while b - a > 1e-4:  # 收缩到 ≈9 秒
            m1 = a + (b - a) / 3.0
            m2 = b - (b - a) / 3.0
            if g(m1) <= g(m2):
                b = m2
            else:
                a = m1
        tmin = 0.5 * (a + b)
        if g(tmin) < 0.0:
            fine_l = max((tmin - xs[i - 1]) / 8.0, 1e-5)
            fine_r = max((xs[i + 1] - tmin) / 8.0, 1e-5)
            roots.extend(_find_roots_time(g, xs[i - 1], tmin, fine_l))
            roots.extend(_find_roots_time(g, tmin, xs[i + 1], fine_r))
    roots.sort()
    pts = [jd0] + [r for r in roots if jd0 < r < jd1] + [jd1]
    out = []
    for i in range(len(pts) - 1):
        s, e = pts[i], pts[i + 1]
        if e <= s:
            continue
        if g(0.5 * (s + e)) < 0:
            out.append((s, e))
    return norm_intervals(out)


def _find_flips(pred, jd0, jd1, step, iters=40):
    """布尔谓词翻转点:粗扫相邻异值格 → 二分翻转点。返回升序翻转时刻表。"""
    flips = []
    n = max(1, int((jd1 - jd0) / step))
    d0 = jd0
    p0 = bool(pred(d0))
    for i in range(1, n + 2):
        d1 = min(jd0 + i * step, jd1)
        if d1 <= d0:
            break
        p1 = bool(pred(d1))
        if p1 != p0:
            a, b = d0, d1
            for _ in range(iters):
                mid = 0.5 * (a + b)
                if bool(pred(mid)) == p0:
                    a = mid
                else:
                    b = mid
            flips.append(0.5 * (a + b))
        d0, p0 = d1, p1
        if d1 >= jd1:
            break
    return flips


def true_intervals(pred, jd0, jd1, step, iters=40):
    """布尔谓词为真的区段(半开):翻转点切分 + 中点判真。"""
    flips = _find_flips(pred, jd0, jd1, step, iters)
    pts = [jd0] + flips + [jd1]
    out = []
    for i in range(len(pts) - 1):
        s, e = pts[i], pts[i + 1]
        if e <= s:
            continue
        if pred(0.5 * (s + e)):
            out.append((s, e))
    return norm_intervals(out)


# ---------------------------------------------------------------------------
# 时刻快照与请求上下文
# ---------------------------------------------------------------------------

class ScanContext(object):
    """单次扫描请求的共享上下文:地点/宫制/黄道口径 + per-jd 快照缓存。"""

    def __init__(self, data):
        self.zone = data.get('zone', '+08:00')
        self.lat = float(data.get('gpsLat'))
        self.lon = float(data.get('gpsLon'))
        self.alt = float(data.get('height') or 0.0)
        self.hsys_name, self.hsys_code = _hsys_code(data)
        self.zodiacal = int(data.get('zodiacal') or 0)
        self.ayanamsa = data.get('siderealAyanamsa') or data.get('ayanamsa') or ''
        self.sid_mode = None
        if self.zodiacal:
            try:
                from astrostudy.india.india_chart_kernel import normalize_ayanamsa
                self.sid_mode = normalize_ayanamsa(self.ayanamsa)
            except Exception:
                self.sid_mode = None
        node_type = str(data.get('westNodeType') or data.get('nodeType') or 'mean').lower()
        self.node_swe = swisseph.TRUE_NODE if node_type == 'true' else swisseph.MEAN_NODE
        # 古典口径包(与前端 classicalChartGlobals 同名键;缺省用 1647 经典档)
        self.eff = {
            'cazimiOrb': float(data.get('cazimiOrb') or (17.0 / 60.0)),
            'combustOrb': float(data.get('combustOrb') or 8.5),
            'underBeamsOrb': float(data.get('underBeamsOrb') or 17.0),
            'vocMode': data.get('vocMode') or 'classic',
            'vocIncludeOuter': bool(data.get('vocIncludeOuter')),
            'viaCombustaVariant': data.get('viaCombustaVariant') or 'standard',
            'partileDef': data.get('partileDef') or 'same_degree',
            'termsVariant': data.get('termsVariant'),
            'triplicity': data.get('triplicity'),
            'sectBuffer': data.get('sectBuffer') or 'geo',
            'houseCuspAdvance': _parse_house_advance(data.get('houseCuspAdvance')),
        }
        self._moments = {}
        self._ayan_cache = {}
        self._syzygies = None
        self._syz_lo = None   # scan() 入口按域界回填;直调 ScanContext 的测试须自行设置
        self._syz_hi = None
        self.eval_points = 0

    def house_advance(self):
        """落宫前移有效值:整宫制(含自定义回退 b'W')天然豁免=0;其余按请求档(默认 5 传统)。"""
        if self.hsys_code == b'W':
            return 0.0
        return self.eff.get('houseCuspAdvance', 5.0)

    def swe_id(self, key):
        if key == 'North Node' or key == 'South Node':
            return self.node_swe
        try:
            return _SWE_BODY[key]
        except KeyError:
            raise ValueError('unknown body: {0!r}'.format(key))

    def moment(self, jd):
        m = self._moments.get(jd)
        if m is None:
            m = LightMoment(jd, self)
            self._moments[jd] = m
            self.eval_points += 1
        return m

    def ayanamsa_deg(self, jd):
        """恒星制偏移(按整日缓存;ayanamsa 日变化 ~1e-4 度,星座边界判定误差可忽略)。"""
        if not self.zodiacal:
            return 0.0
        key = round(jd)
        v = self._ayan_cache.get(key)
        if v is None:
            v = _sidereal_offset(self.ayanamsa, jd)
            self._ayan_cache[key] = v
        return v

    def syzygy_before(self, jd):
        """≤jd 最近一次朔/望的 (事件jd, 月黄经)。单一真值源=flatlib ephem.tools.syzygyJD
        (与本命 SYZYGY 对象同语义);域内事件懒算一次(93 天 ≤8 个),此后 O(1)/moment——
        almuten 五要点/寿命体系共用,防每帧收敛迭代爆炸。"""
        if self._syzygies is None:
            from flatlib.ephem import tools as _ftools
            events = []
            # 从扫描域起点前的最近事件起顺推;+16d 回看必落在下一事件之后(朔望间隔 ~14.77d)
            e = _ftools.syzygyJD(self._syz_lo)
            while True:
                res, _fl = swisseph.calc_ut(e, swisseph.MOON, swisseph.FLG_SWIEPH)
                events.append((e, _norm360(res[0])))
                if e > self._syz_hi:
                    break
                e = _ftools.syzygyJD(e + 16.0)
            self._syzygies = events
        evs = self._syzygies
        lo, hi = 0, len(evs) - 1
        best = evs[0]
        while lo <= hi:
            mid = (lo + hi) // 2
            if evs[mid][0] <= jd:
                best = evs[mid]
                lo = mid + 1
            else:
                hi = mid - 1
        return best


def _parse_house_advance(v):
    """收编 0/1/3/5(perchart.parse_house_cusp_advance 同律);缺省/畸形回 5=主排盘现状。"""
    try:
        n = float(v)
    except (TypeError, ValueError):
        return 5.0
    return n if n in (0.0, 1.0, 3.0, 5.0) else 5.0


def _hsys_code(data):
    """hsys 入参必须是整数下标(与主排盘 perchart.hsys[] 同序);非法直接抛 —— 不静默回落。
    返回 (flatlib 分宫名, swisseph 字节码)。"""
    raw = data.get('hsys', 0)
    if isinstance(raw, bool) or not isinstance(raw, (int, float)) or int(raw) != raw:
        raise ValueError('hsys must be an integer index, got {0!r}'.format(raw))
    idx = int(raw)
    from astrostudy import perchart
    from flatlib.ephem import swe as _fswe
    if idx < 0 or idx >= len(perchart.hsys):
        raise ValueError('hsys index out of range: {0}'.format(idx))
    name = perchart.hsys[idx]
    code = _fswe.SWE_HOUSESYS.get(name)
    if code is None:
        # 自定义分宫(福点整宫等)不在 swisseph 码表 —— 扫描按整宫计算口径处理
        name = 'Whole Sign'
        code = _fswe.SWE_HOUSESYS.get(name) or b'W'
    return name, code


def _sidereal_offset(ayanamsa_key, jd):
    """取 ayanamsa 度数。set_sid_mode → get_ayanamsa_ut 相邻两行(全局态并发纪律)。
    normalize_ayanamsa 返回 {'key','label','mode'} dict —— set_sid_mode 只吃其中 mode 整数
    (穷举矩阵实抓:整 dict 传入 = 'dict' object cannot be interpreted as an integer)。"""
    mode = None
    try:
        from astrostudy.india.india_chart_kernel import normalize_ayanamsa
        resolved = normalize_ayanamsa(ayanamsa_key)
        if isinstance(resolved, dict):
            mode = resolved.get('mode')
    except Exception:
        mode = None
    if mode is None:
        mode = swisseph.SIDM_LAHIRI
    swisseph.set_sid_mode(mode, 0, 0)
    return swisseph.get_ayanamsa_ut(jd)


class LightMoment(object):
    """单时刻惰性快照:只算被条件树问到的量,一次算好全叶子共享。"""

    __slots__ = ('jd', 'ctx', '_pl', '_eq', '_hor', '_cusps', '_ascmc', '_chart', '_dyn', '_eps',
                 '_lots', '_ext')

    def __init__(self, jd, ctx):
        self.jd = jd
        self.ctx = ctx
        self._pl = {}
        self._eq = {}
        self._hor = {}
        self._cusps = None
        self._ascmc = None
        self._chart = None
        self._dyn = None
        self._eps = None
        self._lots = {}
        self._ext = {}   # ext 模块的快照 memo 槽(单 moment 单快照全核共享)

    # -- 黄道系(lon/lat + 速度) --
    def planet(self, key):
        rec = self._pl.get(key)
        if rec is None:
            if key == 'South Node':
                n = self.planet('North Node')
                rec = {'lon': _norm360(n['lon'] + 180.0), 'lat': -n['lat'],
                       'lonspeed': n['lonspeed'], 'latspeed': -n['latspeed']}
            else:
                res, _flag = swisseph.calc_ut(self.jd, self.ctx.swe_id(key),
                                              swisseph.FLG_SWIEPH | swisseph.FLG_SPEED)
                rec = {'lon': _norm360(res[0]), 'lat': res[1],
                       'lonspeed': res[3], 'latspeed': res[4]}
            self._pl[key] = rec
        return rec

    def lon(self, key):
        return self.planet(key)['lon']

    def lonspeed(self, key):
        return self.planet(key)['lonspeed']

    # -- 赤道系(ra/decl + 速度;FLG_EQUATORIAL|FLG_SPEED 直出,无需数值微分) --
    def equatorial(self, key):
        rec = self._eq.get(key)
        if rec is None:
            if key == 'South Node':
                n = self.equatorial('North Node')
                rec = {'ra': _norm360(n['ra'] + 180.0), 'decl': -n['decl'],
                       'raspeed': n['raspeed'], 'declspeed': -n['declspeed']}
            else:
                res, _flag = swisseph.calc_ut(
                    self.jd, self.ctx.swe_id(key),
                    swisseph.FLG_SWIEPH | swisseph.FLG_SPEED | swisseph.FLG_EQUATORIAL)
                rec = {'ra': _norm360(res[0]), 'decl': res[1],
                       'raspeed': res[3], 'declspeed': res[4]}
            self._eq[key] = rec
        return rec

    # -- 地平系(azimuth/altitude;口径与主排盘 flatlib ephem 一致:ECL2HOR,大气 1013.25/15) --
    def horizontal(self, key):
        rec = self._hor.get(key)
        if rec is None:
            p = self.planet(key)
            res = swisseph.azalt(self.jd, swisseph.ECL2HOR,
                                 (self.ctx.lon, self.ctx.lat, self.ctx.alt),
                                 1013.25, 15.0, [p['lon'], p['lat'], 0.0])
            rec = {'azimuth': res[0], 'altitudeTrue': res[1], 'altitudeAppa': res[2]}
            self._hor[key] = rec
        return rec

    # -- 宫位(极区兜底:swisseph 报错回退 Porphyry,照主排盘 flatlib sweHouses 同款策略) --
    def houses(self):
        if self._cusps is None:
            try:
                cusps, ascmc = swisseph.houses_ex(self.jd, self.ctx.lat, self.ctx.lon,
                                                  self.ctx.hsys_code)
            except swisseph.Error:
                cusps, ascmc = swisseph.houses_ex(self.jd, self.ctx.lat, self.ctx.lon, b'O')
            self._cusps = tuple(_norm360(c) for c in cusps)
            self._ascmc = tuple(_norm360(a) for a in ascmc)
        return self._cusps

    def asc(self):
        self.houses()
        return self._ascmc[0]

    def mc(self):
        self.houses()
        return self._ascmc[1]

    def obliquity(self):
        if self._eps is None:
            self._eps = swisseph.calc_ut(self.jd, swisseph.ECL_NUT, swisseph.FLG_SWIEPH)[0][0]
        return self._eps

    # -- 昼夜(宗派单源):默认纯几何地平 altitudeTrue(Sun)>0;buffer='ptolemy5' 逐字复刻
    #    perchart._diurnalWithSectBuffer——太阳在地平下但距上升 ≤5°(拂晓将升)仍判昼 --
    def is_diurnal(self, buffer='geo'):
        base = self.horizontal('Sun')['altitudeTrue'] > 0
        if base or buffer != 'ptolemy5':
            return base
        d = abs(_wrap180(self.lon('Sun') - self.asc()))
        return d <= 5.0

    # -- 阿拉伯点(arabicparts.partLon 逐字;昼夜判据=is_diurnal('geo') 与既有 point_relation
    #    福点式同源)。扫描侧不支持 lotReversal/lotsDocReverse 请求级反转(文档明示) --
    def lot_lon(self, key):
        v = self._lots.get(key)
        if v is not None:
            return v
        sun = self.lon('Sun')
        moon = self.lon('Moon')
        asc = self.asc()
        diurnal = self.is_diurnal('geo')
        if key == 'fortuna':
            v = _norm360(asc + moon - sun) if diurnal else _norm360(asc + sun - moon)
        elif key == 'spirit':
            v = _norm360(asc + sun - moon) if diurnal else _norm360(asc + moon - sun)
        elif key == 'basis':
            f = self.lot_lon('fortuna')
            s = self.lot_lon('spirit')
            arc = (s - f) % 360.0
            arc = min(arc, 360.0 - arc)
            v = _norm360(asc + arc)
        elif key == 'exaltation':
            v = _norm360(asc + 19.0 - sun) if diurnal else _norm360(asc + 33.0 - moon)
        else:
            raise ValueError('unknown lot: {0!r}'.format(key))
        self._lots[key] = v
        return v

    # -- 整宫宫位(恒星制下星与 ASC 同减 ayanamsa,座差恒等):perchart.setupJoy 同口径 --
    def whole_sign_house(self, key):
        off = self.ctx.ayanamsa_deg(self.jd)
        p_sign = int(_norm360(self.lon(key) - off) // 30.0)
        a_sign = int(_norm360(self.asc() - off) // 30.0)
        return (p_sign - a_sign) % 12 + 1

    def syzygy_lon(self):
        return self.ctx.syzygy_before(self.jd)[1]

    # -- flatlib Chart(惰性;仅 reception/mutual/voc 类判定用,时刻串秒级截断对布尔判定无碍) --
    def flatchart(self):
        if self._chart is None:
            from flatlib import const as fconst
            from flatlib.chart import Chart
            from flatlib.datetime import Datetime
            from flatlib.geopos import GeoPos
            rec = date_time_from_jd(self.jd, self.ctx.zone)
            date = Datetime(rec['date'].replace('-', '/'), rec['time'], self.ctx.zone)
            pos = GeoPos(self.ctx.lat, self.ctx.lon)
            zodiacal = fconst.SIDEREAL if self.ctx.zodiacal else fconst.TROPICAL
            self._chart = Chart(date, pos, zodiacal, hsys=self.ctx.hsys_name,
                                IDs=fconst.LIST_OBJECTS, needpars=False,
                                sidereal_mode=self.ctx.sid_mode)
        return self._chart

    def dynamics(self):
        if self._dyn is None:
            from flatlib.tools.chartdynamics import ChartDynamics
            self._dyn = ChartDynamics(self.flatchart())
        return self._dyn


# ---------------------------------------------------------------------------
# 叶子求值:aspect
# ---------------------------------------------------------------------------

def _aspect_step(planet_a, planet_b, orb):
    """粗扫步长:命中窗宽 ≈ 2·orb/相对速度,取 0.4 窗宽;并按体系基准档封顶。"""
    rel = _MAX_SPEED.get(planet_a, 1.0) + _MAX_SPEED.get(planet_b, 1.0)
    window = 2.0 * max(float(orb), 0.1) / max(rel, 1e-6)
    if rel > 13.0:
        base = 0.25
    elif rel > 1.0:
        base = 1.0
    else:
        base = 3.0
    return max(0.02, min(base, 0.4 * window))


def _eval_aspect(params, ctx, domain):
    """A星-B星 成 C 相位:入/出/任意、partile 三口径、左右相位、orb。

    残差按 ±angle 两支各自求负区间后取并;motion/side/partile 在命中区间内细分过滤。
    擦边极窄窗(残差极值恰入 orb 又即刻退出)按业界惯例容忍漏检(无择日实用价值)。
    """
    pa = params['planetA']
    pb = params['planetB']
    if pa == pb:
        raise ValueError('aspect 两端不能是同一星体')
    angle = float(params['angle'])
    orb = float(params['orb'])
    motion = params.get('motion') or 'any'
    side = params.get('side') or 'any'
    partile = params.get('partile') or 'off'
    jd0, jd1 = domain
    step = _aspect_step(pa, pb, orb)

    def delta(jd):
        m = ctx.moment(jd)
        return _wrap180(m.lon(pa) - m.lon(pb))

    branches = [angle] if angle in (0.0, 180.0) else [angle, -angle]
    hits = []
    for br in branches:
        def g(jd, _br=br):
            return abs(_wrap180(delta(jd) - _br)) - orb

        hits = iv_or(hits, negative_intervals(g, jd0, jd1, step))

    if not hits:
        return []

    # partile:le3/le1 等价于把 orb 收紧后重求;same_degree 走整数度谓词细分。
    if partile == 'le3' or partile == 'le1':
        tight = 3.0 if partile == 'le3' else 1.0
        if tight < orb:
            tight_hits = []
            for br in branches:
                def gt(jd, _br=br):
                    return abs(_wrap180(delta(jd) - _br)) - tight

                tight_hits = iv_or(tight_hits, negative_intervals(gt, jd0, jd1, step))
            hits = tight_hits
    elif partile == 'same_degree':
        def same_degree(jd):
            m = ctx.moment(jd)
            return int(m.lon(pa) % 30.0) == int(m.lon(pb) % 30.0)

        refined = []
        for s, e in hits:
            sub = true_intervals(same_degree, s, e, max(0.003, (e - s) / 24.0))
            refined = iv_or(refined, sub)
        hits = refined

    if motion in ('applying', 'separating'):
        want_applying = (motion == 'applying')

        def is_applying(jd):
            m = ctx.moment(jd)
            d = _wrap180(m.lon(pa) - m.lon(pb))
            best = None
            for br in branches:
                r = _wrap180(d - br)
                if best is None or abs(r) < abs(best):
                    best = r
            dres = m.lonspeed(pa) - m.lonspeed(pb)
            # |残差| 收窄 = 入相位:residual 与其导数异号
            return (best * dres) < 0

        refined = []
        for s, e in hits:
            sub_step = max(0.01, (e - s) / 6.0)
            sub = true_intervals(lambda jd: is_applying(jd) == want_applying, s, e, sub_step)
            refined = iv_or(refined, sub)
        hits = refined

    if side in ('dexter', 'sinister') and angle not in (0.0, 180.0):
        keep = []
        for s, e in hits:
            d = _wrap180(ctx.moment(0.5 * (s + e)).lon(pb) - ctx.moment(0.5 * (s + e)).lon(pa))
            is_dexter = d < 0
            if (side == 'dexter') == is_dexter:
                keep.append((s, e))
        hits = keep

    return hits


# ---------------------------------------------------------------------------
# 叶子求值:in_sign / numeric / midpoint / point_relation(A 类续)
# ---------------------------------------------------------------------------

def _sid_lon(m, key, ctx):
    """星座归属用黄经:恒星制减 ayanamsa,回归制原样(角差类条件勿用本函数)。"""
    return _norm360(m.lon(key) - ctx.ayanamsa_deg(m.jd))


def _eval_in_sign(params, ctx, domain):
    """A星 在 星座集(多选=并)。连续化:|wrap180(lon_sid − 座中心)| − 15 < 0。"""
    planet = params['planet']
    signs = params['signs']
    if not isinstance(signs, (list, tuple)) or not signs:
        raise ValueError('in_sign 需要非空 signs 列表')
    jd0, jd1 = domain
    speed = _MAX_SPEED.get(planet, 1.0)
    step = max(0.05, min(3.0, 0.35 * 30.0 / max(speed, 1e-6)))
    hits = []
    for s in signs:
        center = (int(s) % 12) * 30.0 + 15.0

        def g(jd, _c=center):
            return abs(_wrap180(_sid_lon(ctx.moment(jd), planet, ctx) - _c)) - 15.0

        hits = iv_or(hits, negative_intervals(g, jd0, jd1, step))
    return hits


# numeric 字段表:取值函数键 + 是否循环角 + 粗扫步长档(天)。
_NUMERIC_FIELDS = {
    'Long': {'kind': 'lon', 'circular': True},
    'Lat': {'kind': 'lat', 'circular': False},
    'LongSpeed': {'kind': 'lonspeed', 'circular': False},
    'LatSpeed': {'kind': 'latspeed', 'circular': False},
    'RA': {'kind': 'ra', 'circular': True},
    'RASpeed': {'kind': 'raspeed', 'circular': False},
    'Decl': {'kind': 'decl', 'circular': False},
    'DeclSpeed': {'kind': 'declspeed', 'circular': False},
    'Azimuth': {'kind': 'azimuth', 'circular': True},
    'Altitude': {'kind': 'altitude', 'circular': False},
}


def _numeric_value(m, planet, kind, altitude_kind):
    if kind in ('lon', 'lat', 'lonspeed', 'latspeed'):
        return m.planet(planet)[kind]
    if kind in ('ra', 'decl', 'raspeed', 'declspeed'):
        return m.equatorial(planet)[kind]
    if kind == 'azimuth':
        # 口径=主排盘行星资料页 azimuth 同源(swisseph azalt 原生方位,非罗盘向)
        return m.horizontal(planet)['azimuth']
    if kind == 'altitude':
        key = 'altitudeAppa' if altitude_kind == 'apparent' else 'altitudeTrue'
        return m.horizontal(planet)[key]
    raise ValueError('unknown numeric kind: {0}'.format(kind))


def _numeric_step(planet, kind):
    if kind in ('azimuth', 'altitude'):
        return 0.0015  # ≈2 分钟(周日运动 15°/h)
    speed = _MAX_SPEED.get(planet, 1.0)
    if kind in ('lon', 'ra'):
        return max(0.02, min(3.0, 1.5 / max(speed, 1e-6)))
    if kind in ('lat', 'decl'):
        return max(0.1, min(3.0, 1.0 / max(speed / 4.0, 1e-6)))
    return 1.0  # 速度类字段变率(加速度)慢


def _eval_numeric(params, ctx, domain):
    """A星 天文数值比较。角度型字段(Long/RA/Azimuth)只允许 circular between 与 eq(跨 0° 弧)。"""
    planet = params['planet']
    field = params['field']
    spec = _NUMERIC_FIELDS.get(field)
    if spec is None:
        raise ValueError('numeric 不支持字段 {0!r}'.format(field))
    op = params['op']
    value = float(params['value'])
    value2 = params.get('value2')
    eps = float(params.get('eps') or (0.01 if spec['circular'] else 0.001))
    altitude_kind = params.get('altitudeKind') or 'true'
    kind = spec['kind']
    jd0, jd1 = domain
    step = _numeric_step(planet, kind)

    def val(jd):
        v = _numeric_value(ctx.moment(jd), planet, kind, altitude_kind)
        if kind == 'lon' and ctx.zodiacal:
            v = _norm360(v - ctx.ayanamsa_deg(jd))
        return v

    if spec['circular']:
        if op == 'eq':
            def g(jd):
                return abs(_wrap180(val(jd) - value)) - eps
        elif op == 'between':
            if value2 is None:
                raise ValueError('between 需要 value2')
            hi = float(value2)
            arc = _norm360(hi - value)
            if arc == 0.0:
                arc = 360.0
            center = _norm360(value + arc / 2.0)
            half = arc / 2.0

            def g(jd):
                return abs(_wrap180(val(jd) - center)) - half
        else:
            raise ValueError('角度型字段 {0} 只支持 between/eq(圆弧语义)'.format(field))
    else:
        if op in ('gt', 'gte'):
            def g(jd):
                return value - val(jd)
        elif op in ('lt', 'lte'):
            def g(jd):
                return val(jd) - value
        elif op == 'eq':
            def g(jd):
                return abs(val(jd) - value) - eps
        elif op == 'between':
            if value2 is None:
                raise ValueError('between 需要 value2')
            lo, hi = sorted((value, float(value2)))

            def g(jd):
                v = val(jd)
                return max(lo - v, v - hi)
        else:
            raise ValueError('numeric 不支持 op {0!r}'.format(op))

    return negative_intervals(g, jd0, jd1, step)


def _near_axis_midpoint(lon_a, lon_b):
    """近轴中点(与前端 uranianDial.midpoint 同口径)。"""
    a, b = _norm360(lon_a), _norm360(lon_b)
    mid = (a + b) / 2.0
    if abs(a - b) > 180.0:
        mid = _norm360(mid + 180.0)
    return mid


def _dial_dist(x, modulus):
    """modulus 盘上的最短角距。"""
    d = float(x) % modulus
    if d < 0:
        d += modulus
    return min(d, modulus - d)


def _resolve_point(point, ctx):
    """点定义 → (lon 取值函数, decl 取值函数, 速度档)。
    kind: planet(星体)/angle(ASC/MC/DESC/IC)/lot(福点)/fixedLon(固定黄经)。"""
    kind = (point or {}).get('kind')
    if kind == 'planet':
        pid = point['id']
        ctx.swe_id(pid)  # 校验

        def lon_fn(m):
            return m.lon(pid)

        def decl_fn(m):
            return m.equatorial(pid)['decl']

        return lon_fn, decl_fn, _MAX_SPEED.get(pid, 1.0)
    if kind == 'angle':
        axis = str(point.get('id') or 'ASC').upper()
        if axis not in ('ASC', 'MC', 'DESC', 'IC'):
            raise ValueError('angle 点仅支持 ASC/MC/DESC/IC')

        def lon_fn(m, _axis=axis):
            if _axis == 'ASC':
                return m.asc()
            if _axis == 'DESC':
                return _norm360(m.asc() + 180.0)
            if _axis == 'MC':
                return m.mc()
            return _norm360(m.mc() + 180.0)

        def decl_fn(m, _lf=lon_fn):
            return _ecl_lon_to_decl(m.jd, _lf(m))

        return lon_fn, decl_fn, 361.0  # 周日运动:一天一整圈
    if kind == 'lot':
        lot = str(point.get('id') or 'fortuna').lower()
        if lot != 'fortuna':
            raise ValueError('lot 点暂支持 fortuna(福点)')

        def lon_fn(m):
            sun = m.planet('Sun')
            moon = m.planet('Moon')
            diurnal = m.horizontal('Sun')['altitudeTrue'] > 0
            if diurnal:
                return _norm360(m.asc() + moon['lon'] - sun['lon'])
            return _norm360(m.asc() + sun['lon'] - moon['lon'])

        def decl_fn(m, _lf=lon_fn):
            return _ecl_lon_to_decl(m.jd, _lf(m))

        return lon_fn, decl_fn, 361.0
    if kind == 'fixedLon':
        fixed = _norm360(float(point.get('lon') or 0.0))

        def lon_fn(m, _v=fixed):
            return _v

        def decl_fn(m, _v=fixed):
            return _ecl_lon_to_decl(m.jd, _v)

        return lon_fn, decl_fn, 0.0
    raise ValueError('point.kind 不支持 {0!r}'.format(kind))


def _ecl_lon_to_decl(jd, lon):
    """黄道点(黄纬 0)的赤纬:黄道→赤道 cotrans(负 eps)。"""
    eps = swisseph.calc_ut(jd, swisseph.ECL_NUT, swisseph.FLG_SWIEPH)[0][0]
    ra_decl = swisseph.cotrans((lon, 0.0, 1.0), -eps)
    return ra_decl[1]


def _eval_midpoint(params, ctx, domain):
    """A/B 中点(近轴;A=B 退化单星)在 modulus 盘上与目标合相(≤orb)。"""
    a = params['a']
    b = params['b']
    modulus = float(params['modulus'])
    orb = float(params['orb'])
    if not (0 < modulus <= 360):
        raise ValueError('modulus 需在 (0,360]')
    if not (0 < orb < modulus / 2.0):
        raise ValueError('orb 需在 (0, modulus/2)')
    target = params['target'] or {}
    tkind = target.get('kind')
    if tkind == 'midpoint':
        pair = target.get('pair') or []
        if len(pair) != 2:
            raise ValueError('target.midpoint 需要 pair 两星')
        ctx.swe_id(pair[0])
        ctx.swe_id(pair[1])

        def target_lon(m, _p=tuple(pair)):
            return _near_axis_midpoint(m.lon(_p[0]), m.lon(_p[1]))

        t_speed = (_MAX_SPEED.get(pair[0], 1.0) + _MAX_SPEED.get(pair[1], 1.0)) / 2.0
    else:
        lon_fn, _decl_fn, t_speed = _resolve_point(target, ctx)
        target_lon = lon_fn
    ctx.swe_id(a)
    ctx.swe_id(b)
    jd0, jd1 = domain
    mid_speed = (_MAX_SPEED.get(a, 1.0) + _MAX_SPEED.get(b, 1.0)) / 2.0
    rel = mid_speed + t_speed
    if rel > 300.0:
        step = 0.0015
    else:
        window = 2.0 * orb / max(rel, 1e-6)
        step = max(0.02, min(1.0 if rel > 1.0 else 3.0, 0.4 * window))

    def g(jd):
        m = ctx.moment(jd)
        mid = _near_axis_midpoint(m.lon(a), m.lon(b)) if a != b else m.lon(a)
        return _dial_dist(mid - target_lon(m), modulus) - orb

    return negative_intervals(g, jd0, jd1, step)


_SOFT_ANGLES = (60.0, 120.0)
_HARD_ANGLES = (0.0, 90.0, 180.0)
_MAJOR_ANGLES = (0.0, 60.0, 90.0, 120.0, 180.0)


def _eval_point_relation(params, ctx, domain):
    """A星 × B点:任意/软/硬/显式相位集,或 平行/反平行(赤纬)。"""
    planet = params['planet']
    ctx.swe_id(planet)
    relation = params['relation']
    orb = float(params.get('orb') or 3.0)
    point = params.get('point') or {}
    lon_fn, decl_fn, t_speed = _resolve_point(point, ctx)
    jd0, jd1 = domain
    p_speed = _MAX_SPEED.get(planet, 1.0)
    rel = p_speed + t_speed
    if rel > 300.0:
        step = 0.0015
    else:
        window = 2.0 * orb / max(rel, 1e-6)
        step = max(0.02, min(1.0 if rel > 1.0 else 3.0, 0.4 * window))

    if relation in ('parallel', 'contraparallel'):
        # 平行:|declA − declT| ≤ orb;反平行:|declA + declT| ≤ orb。
        # 赤纬变率慢(月亮 ≤~5°/d) → 步长放宽;angle 点的 decl 随周日运动快 → 保持 FAST。
        d_step = step if t_speed > 300.0 else max(step, 0.25)

        def g(jd):
            m = ctx.moment(jd)
            da = m.equatorial(planet)['decl']
            dt = decl_fn(m)
            diff = (da - dt) if relation == 'parallel' else (da + dt)
            return abs(diff) - orb

        return negative_intervals(g, jd0, jd1, d_step)

    if relation == 'any':
        angles = _MAJOR_ANGLES
    elif relation == 'soft':
        angles = _SOFT_ANGLES
    elif relation == 'hard':
        angles = _HARD_ANGLES
    elif relation == 'angles':
        angles = tuple(float(x) for x in (params.get('angles') or []))
        if not angles:
            raise ValueError('relation=angles 需要非空 angles')
    else:
        raise ValueError('point_relation 不支持 relation {0!r}'.format(relation))

    hits = []
    for ang in angles:
        branches = [ang] if ang in (0.0, 180.0) else [ang, -ang]
        for br in branches:
            def g(jd, _br=br):
                m = ctx.moment(jd)
                return abs(_wrap180(_wrap180(m.lon(planet) - lon_fn(m)) - _br)) - orb

            hits = iv_or(hits, negative_intervals(g, jd0, jd1, step))
    return hits


# ---------------------------------------------------------------------------
# 叶子求值:B 类(布尔谓词粗扫+翻转二分)
# ---------------------------------------------------------------------------

# moiety 光半径表(与前端 src/divination/data/aspects.js PLANET_ORB 同源,fixture 对拍锁定)。
_MOIETY = {
    'Sun': 15.0, 'Moon': 12.0, 'Mercury': 7.0, 'Venus': 7.0, 'Mars': 8.0,
    'Jupiter': 9.0, 'Saturn': 9.0, 'Uranus': 5.0, 'Neptune': 5.0, 'Pluto': 5.0,
    'North Node': 3.0, 'South Node': 3.0, 'Chiron': 5.0,
}

# 燃烧之路四变体(与前端 src/divination/engine/radicality.js viaCombustaRange 同表)。
_VIA_COMBUSTA = {
    'standard': (195.0, 225.0),
    'scorpioFull': (195.0, 240.0),
    'bothFull': (180.0, 240.0),
    'narrow': (208.0, 217.0),
}

# 平均日速(fast/slow 判据基准;flatlib object.meanMotion 同源数值)。
_MEAN_SPEED = {
    'Sun': 0.9833, 'Moon': 13.1833, 'Mercury': 1.383, 'Venus': 1.2,
    'Mars': 0.524, 'Jupiter': 0.083, 'Saturn': 0.033,
    'Uranus': 0.012, 'Neptune': 0.006, 'Pluto': 0.004,
    'North Node': 0.053, 'South Node': 0.053, 'Chiron': 0.018,
}

_SIGN_NAMES = ('Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra',
               'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces')

_TRIP_KEYS = ('dayTrip', 'nightTrip', 'partTrip')


def _norm_level(dign):
    """flatlib 尊贵键归一到条件层级名:dayTrip/nightTrip/partTrip → trip。"""
    return 'trip' if dign in _TRIP_KEYS else dign


def _b_step(keys, fast=False):
    """B 类叶粗扫步长(天):涉角宫/地平=2min;涉月=1h;内行星=6h;慢星=1d。"""
    if fast:
        return 0.0015
    fastest = 0.0
    for k in keys:
        fastest = max(fastest, _MAX_SPEED.get(k, 1.0))
    if fastest > 10.0:
        return 1.0 / 24.0
    if fastest > 0.5:
        return 0.25
    return 1.0


def _sign_pos(m, key, ctx):
    """(flatlib 座名, 座内度) —— essential 查表用;恒星制走 sid 黄经。"""
    lon = _sid_lon(m, key, ctx)
    return _SIGN_NAMES[int(lon // 30.0) % 12], lon % 30.0


def _essential_info(m, key, ctx):
    from flatlib.dignities import essential
    sign, signlon = _sign_pos(m, key, ctx)
    return essential.getInfo(sign, signlon)


def _house_index(lon, cusps, advance=0.0):
    """行星黄经落宫(1-12):找「从 cusp[i] 顺行到 cusp[i+1]」覆盖 lon 的宫。
    advance=宫头前移量(flatlib House._OFFSET 同律:星距下一宫头 ≤advance° 入下一宫;
    主排盘默认 5° 传统档,整宫制由调用方传 0 豁免)——「行星落宫·宫头前移」设置同源,
    否则宫位类判定在宫头前窗内与页面显示不一致(用户实抓;Placidus 诊断 7/42 差异)。"""
    h = 12
    for i in range(12):
        a = cusps[i]
        b = cusps[(i + 1) % 12]
        span = _norm360(b - a)
        if span <= 0:
            span += 360.0
        if _norm360(lon - a) < span:
            h = i + 1
            break
    if advance and advance > 0:
        nxt = (h % 12) + 1
        d = _norm360(cusps[nxt - 1] - lon)
        if 0.0 < d <= advance:
            return nxt
    return h


def _voc_mode_key(mode):
    return 'lilly' if mode in (None, '', 'classic', 'backend') else mode


def _eval_in_house(params, ctx, domain):
    """A星 在 宫集(cusps 随 ScanContext.hsys;FAST 档,极区 cusps 已回退 Porphyry)。"""
    planet = params['planet']
    ctx.swe_id(planet)
    houses = params['houses']
    if not isinstance(houses, (list, tuple)) or not houses:
        raise ValueError('in_house 需要非空 houses 列表')
    want = set(int(h) for h in houses)
    if not all(1 <= h <= 12 for h in want):
        raise ValueError('houses 取值需在 1-12')
    jd0, jd1 = domain

    def pred(jd):
        m = ctx.moment(jd)
        return _house_index(m.lon(planet), m.houses(), ctx.house_advance()) in want

    return true_intervals(pred, jd0, jd1, _b_step([planet], fast=True))


def _reception_hits(m, ctx, a, b, levels, match, require_asp):
    """A 接纳 B 的层级命中:receives=尊贵+相位(chartdynamics 单一真值源);宽松版仅论落座。"""
    dyn = m.dynamics()
    digs = dyn.receives(a, b) if require_asp else dyn.inDignities(b, a)
    got = set(_norm_level(d) for d in digs if d not in ('exile', 'fall'))
    wanted = set(levels)
    if match == 'all':
        return wanted.issubset(got)
    return bool(got & wanted)


def _eval_reception(params, ctx, domain):
    a = params['planetA']
    b = params['planetB']
    if a == b:
        raise ValueError('reception 两端不能相同')
    levels = params.get('levels') or ['ruler', 'exalt', 'trip', 'term', 'face']
    match = params.get('match') or 'any'
    require_asp = params.get('requireAspect', True)
    jd0, jd1 = domain

    def pred(jd):
        return _reception_hits(ctx.moment(jd), ctx, a, b, levels, match, require_asp)

    return true_intervals(pred, jd0, jd1, _b_step([a, b]))


def _eval_mutual_reception(params, ctx, domain):
    a = params['planetA']
    b = params['planetB']
    if a == b:
        raise ValueError('mutual_reception 两端不能相同')
    levels = set(params.get('levels') or ['ruler', 'exalt', 'trip', 'term', 'face'])
    pairing = params.get('pairing') or 'any_pair'
    require_asp = params.get('requireAspect', True)
    jd0, jd1 = domain

    def pred(jd):
        m = ctx.moment(jd)
        dyn = m.dynamics()
        if require_asp:
            pairs = dyn.mutualReceptions(a, b)
        else:
            ab = dyn.inDignities(b, a)
            ba = dyn.inDignities(a, b)
            pairs = [(x, y) for x in ab for y in ba]
        pairs = [(_norm_level(x), _norm_level(y)) for x, y in pairs
                 if x not in ('exile', 'fall') and y not in ('exile', 'fall')]
        pairs = [(x, y) for x, y in pairs if x in levels and y in levels]
        if pairing == 'same_level':
            return any(x == y for x, y in pairs)
        return bool(pairs)

    return true_intervals(pred, jd0, jd1, _b_step([a, b]))


def _eval_rulership(params, ctx, domain):
    """'rules'=A 是 B 所在座的庙主;'dispositor_is'=A 所在座庙主是 B(纯 essential 表,零 Chart)。"""
    a = params['planetA']
    b = params['planetB']
    mode = params['mode']
    ctx.swe_id(a)
    ctx.swe_id(b)
    if mode not in ('rules', 'dispositor_is'):
        raise ValueError('rulership.mode 需为 rules/dispositor_is')
    jd0, jd1 = domain

    def pred(jd):
        m = ctx.moment(jd)
        if mode == 'rules':
            info = _essential_info(m, b, ctx)
            return info.get('ruler') == a
        info = _essential_info(m, a, ctx)
        return info.get('ruler') == b

    key = b if mode == 'rules' else a
    return true_intervals(pred, jd0, jd1, _b_step([key]))


def _feral(m, ctx, planet, chart_ids):
    """无相位(feral):与七政(除自身)全部主相位均不在 moiety 均值 orb 内。"""
    lon_p = m.lon(planet)
    for other in chart_ids:
        if other == planet:
            continue
        orb_lim = (_MOIETY.get(planet, 5.0) + _MOIETY.get(other, 5.0)) / 2.0
        d = _wrap180(lon_p - m.lon(other))
        for ang in _MAJOR_ANGLES:
            for br in ((ang,) if ang in (0.0, 180.0) else (ang, -ang)):
                if abs(_wrap180(d - br)) <= orb_lim:
                    return False
    return True


_SEVEN = ('Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn')

_DIGNITY_STATES = (
    'ruler', 'exalt', 'trip', 'term', 'face', 'detriment', 'fall', 'peregrine',
    'cazimi', 'combust', 'under_beams', 'free_of_sun', 'oriental', 'occidental',
    'direct', 'retrograde', 'station', 'fast', 'slow',
    'angular', 'succedent', 'cadent', 'feral', 'oob',
)


def _dignity_state_one(m, ctx, planet, state, sub):
    """dignity_state 单原子判定。太阳关系口径=perchart setupPhasis 同式(阈值走 eff)。"""
    if state in ('ruler', 'exalt', 'term', 'face'):
        info = _essential_info(m, planet, ctx)
        return info.get(state) == planet
    if state == 'trip':
        info = _essential_info(m, planet, ctx)
        return any(info.get(k) == planet for k in _TRIP_KEYS)
    if state == 'detriment':
        info = _essential_info(m, planet, ctx)
        return info.get('exile') == planet
    if state == 'fall':
        info = _essential_info(m, planet, ctx)
        return info.get('fall') == planet
    if state == 'peregrine':
        from flatlib.dignities import essential
        sign, signlon = _sign_pos(m, planet, ctx)
        return essential.isPeregrine(planet, sign, signlon)
    if state in ('cazimi', 'combust', 'under_beams', 'free_of_sun'):
        if planet == 'Sun':
            return state == 'free_of_sun'
        d = abs(_wrap180(m.lon(planet) - m.lon('Sun')))
        cz = ctx.eff['cazimiOrb']
        cb = ctx.eff['combustOrb']
        ub = ctx.eff['underBeamsOrb']
        if state == 'cazimi':
            return d < cz
        if state == 'combust':
            return cz <= d < cb
        if state == 'under_beams':
            return cb <= d < ub
        return d >= ub
    if state in ('oriental', 'occidental'):
        if planet == 'Sun':
            return False
        # 单源定义与前端 chartFacts.orientalityOf 同款:planet−sun < 0 = oriental(先日而升)。
        d = _wrap180(m.lon(planet) - m.lon('Sun'))
        return (d < 0) if state == 'oriental' else (d > 0)
    if state == 'direct':
        return m.lonspeed(planet) > 0
    if state == 'retrograde':
        return m.lonspeed(planet) < 0
    if state == 'station':
        thresh = float((sub or {}).get('stationOrb') or 0.05)
        return abs(m.lonspeed(planet)) < thresh
    if state in ('fast', 'slow'):
        mean = _MEAN_SPEED.get(planet, 1.0)
        return (abs(m.lonspeed(planet)) >= mean) if state == 'fast' else (abs(m.lonspeed(planet)) < mean)
    if state in ('angular', 'succedent', 'cadent'):
        h = _house_index(m.lon(planet), m.houses(), ctx.house_advance())
        group = {'angular': (1, 4, 7, 10), 'succedent': (2, 5, 8, 11), 'cadent': (3, 6, 9, 12)}[state]
        return h in group
    if state == 'feral':
        return _feral(m, ctx, planet, _SEVEN)
    if state == 'oob':
        return abs(m.equatorial(planet)['decl']) > m.obliquity()
    raise ValueError('dignity_state 不支持 {0!r}'.format(state))


def _eval_dignity_state(params, ctx, domain):
    planet = params['planet']
    ctx.swe_id(planet)
    states = params['states']
    if not isinstance(states, (list, tuple)) or not states:
        raise ValueError('dignity_state 需要非空 states')
    for s in states:
        if s not in _DIGNITY_STATES:
            raise ValueError('未知 dignity_state 状态 {0!r}'.format(s))
    require = params.get('require') or 'all'
    sub = params
    jd0, jd1 = domain
    fast = any(s in ('angular', 'succedent', 'cadent') for s in states)

    def pred(jd):
        m = ctx.moment(jd)
        checks = (_dignity_state_one(m, ctx, planet, s, sub) for s in states)
        return all(checks) if require == 'all' else any(checks)

    keys = [planet] if planet == 'Sun' else [planet, 'Sun']
    return true_intervals(pred, jd0, jd1, _b_step(keys, fast=fast))


_CONSIDERATION_ITEMS = (
    'moon_voc', 'moon_waxing', 'moon_waning', 'moon_fast', 'moon_slow',
    'via_combusta', 'moon_early_sign', 'moon_late_sign', 'asc_near_boundary',
    'sun_above_horizon', 'sun_below_horizon',
)

# 月速三口径阈(度/日):ramesey=13°10′(经典十损)/mean=平均日速/twelve=12°(旧注)。
_MOON_SPEED_MODES = {'ramesey': 13.0 + 10.0 / 60.0, 'mean': 13.1833, 'twelve': 12.0}


def _sun_horizon_intervals(ctx, domain, above):
    """日在地平上/下(C 类生成式):rise_trans 事件流(视升落=上缘+折射,与黄历口径一致)
    翻转成区间;极区整域零事件 → 正午真高度判极昼/极夜整段(任务书兜底范式)。"""
    jd0, jd1 = domain
    geopos = (ctx.lon, ctx.lat, ctx.alt)

    def next_evt(jd, which):
        try:
            res, tret = swisseph.rise_trans(jd, swisseph.SUN, which, geopos, 0.0, 0.0,
                                            swisseph.FLG_SWIEPH)
        except swisseph.Error:
            return None
        if res == 0 and tret and tret[0]:
            return tret[0]
        return None

    events = []
    for which, kind in ((swisseph.CALC_RISE, 'rise'), (swisseph.CALC_SET, 'set')):
        t = jd0 - 1.5
        for _guard in range(int(jd1 - jd0) + 8):
            nxt = next_evt(t, which)
            if nxt is None or nxt <= t:
                break
            if nxt > jd1 + 1.5:
                break
            events.append((nxt, kind))
            t = nxt + 1e-4
    if not events:
        # 极昼/极夜:正午(域中点)真高度定整段归属
        mid_alt = ctx.moment(0.5 * (jd0 + jd1)).horizontal('Sun')['altitudeTrue']
        state_above = mid_alt > 0
        return [(jd0, jd1)] if state_above == above else []
    events.sort()
    # 初态由首事件反推:首事件是 rise → 之前在地平下(口径与事件流一致,不混用真高度)
    state_up = events[0][1] == 'set'
    out = []
    cur = jd0
    for t, kind in events:
        if t <= jd0:
            state_up = (kind == 'rise')
            continue
        if t >= jd1:
            break
        if state_up == above and t > cur:
            out.append((cur, t))
        cur = t
        state_up = (kind == 'rise')
    if state_up == above and jd1 > cur:
        out.append((cur, jd1))
    return norm_intervals(out)


def _eval_day_window(params, ctx, domain):
    """当日时间窗(纯历法生成;跨午夜支持:to ≤ from 视为跨到次日)。"""
    import math

    def parse_hm(text, name):
        seg = str(text or '').split(':')
        try:
            hh, mm = int(seg[0]), int(seg[1] if len(seg) > 1 else 0)
        except (ValueError, IndexError):
            raise ValueError('day_window.{0} 需为 HH:mm'.format(name))
        if not (0 <= hh <= 23 and 0 <= mm <= 59):
            raise ValueError('day_window.{0} 超出 00:00-23:59'.format(name))
        return hh + mm / 60.0

    fh = parse_hm(params['from'], 'from')
    th = parse_hm(params['to'], 'to')
    if abs(fh - th) < 1e-9:
        raise ValueError('day_window from/to 不能相同')
    cross = th < fh
    jd0, jd1 = domain
    z = zone_value(ctx.zone) / 24.0
    day_local0 = math.floor(jd0 + z + 0.5) - 0.5  # 本地当日 00:00(local jd)
    out = []
    d = day_local0 - 1.0
    while d - z <= jd1 + 1.0:
        s = d + fh / 24.0 - z
        e = d + (1.0 if cross else 0.0) + th / 24.0 - z
        s2, e2 = max(s, jd0), min(e, jd1)
        if e2 > s2:
            out.append((s2, e2))
        d += 1.0
    return norm_intervals(out)


def _eval_considerations(params, ctx, domain):
    """择日考量(item 制;sun_above/below_horizon 走 C 类生成式,零采样)。"""
    item = params['item']
    if item not in _CONSIDERATION_ITEMS:
        raise ValueError('considerations 不支持 item {0!r}'.format(item))
    jd0, jd1 = domain

    if item in ('sun_above_horizon', 'sun_below_horizon'):
        return _sun_horizon_intervals(ctx, domain, above=(item == 'sun_above_horizon'))

    if item == 'moon_voc':
        mode = _voc_mode_key(params.get('vocMode') or ctx.eff.get('vocMode'))
        include_outer = bool(params.get('vocIncludeOuter', ctx.eff.get('vocIncludeOuter')))

        def pred(jd):
            return ctx.moment(jd).dynamics().isVOC('Moon', mode, include_outer)
    elif item in ('moon_waxing', 'moon_waning'):
        def pred(jd):
            m = ctx.moment(jd)
            elong = _norm360(m.lon('Moon') - m.lon('Sun'))
            return (elong < 180.0) if item == 'moon_waxing' else (elong >= 180.0)
    elif item in ('moon_fast', 'moon_slow'):
        mode = params.get('speedMode') or 'ramesey'
        thresh = _MOON_SPEED_MODES.get(mode)
        if thresh is None:
            raise ValueError('speedMode 需为 ramesey/mean/twelve')

        def pred(jd):
            v = abs(ctx.moment(jd).lonspeed('Moon'))
            return (v >= thresh) if item == 'moon_fast' else (v < thresh)
    elif item == 'via_combusta':
        variant = params.get('variant') or ctx.eff.get('viaCombustaVariant') or 'standard'
        rng = _VIA_COMBUSTA.get(variant)
        if rng is None:
            raise ValueError('viaCombusta variant 需为 standard/scorpioFull/bothFull/narrow')

        def pred(jd):
            lon = _sid_lon(ctx.moment(jd), 'Moon', ctx)
            return rng[0] <= lon < rng[1]
    elif item in ('moon_early_sign', 'moon_late_sign'):
        early = float(params.get('earlyDeg') or 3.0)
        late = float(params.get('lateDeg') or 27.0)

        def pred(jd):
            _sign, signlon = _sign_pos(ctx.moment(jd), 'Moon', ctx)
            return (signlon < early) if item == 'moon_early_sign' else (signlon >= late)
    else:  # asc_near_boundary
        early = float(params.get('earlyDeg') or 3.0)
        late = float(params.get('lateDeg') or 27.0)

        def pred(jd):
            m = ctx.moment(jd)
            asc_sid = _norm360(m.asc() - ctx.ayanamsa_deg(jd)) if ctx.zodiacal else m.asc()
            signlon = asc_sid % 30.0
            return signlon < early or signlon >= late

    fast = (item == 'asc_near_boundary')
    return true_intervals(pred, jd0, jd1, _b_step(['Moon'], fast=fast))


# ---------------------------------------------------------------------------
# 叶子求值:围攻 / 相位格局 / 盘面形状(纯几何核+采样谓词)
# ---------------------------------------------------------------------------

_RAY_OFFSETS = (0.0, 60.0, -60.0, 90.0, -90.0, 120.0, -120.0, 180.0)


def _side_dist(target_lon, lon):
    """带向距离:>0 = lon 在 target 顺黄道序前方(左/东);<0 = 后方。0 视作前方。"""
    return _wrap180(lon - target_lon)


def _nearest_body_each_side(target, lons, pool):
    """两侧最近实体:返回 (fwd_key, fwd_dist, back_key, back_dist);无则 None/None。"""
    t = lons[target]
    fwd = back = None
    fwd_d = back_d = 1e9
    for key in pool:
        if key == target:
            continue
        d = _side_dist(t, lons[key])
        if d >= 0:
            if d < fwd_d:
                fwd, fwd_d = key, d
        else:
            if -d < back_d:
                back, back_d = key, -d
    return fwd, (fwd_d if fwd else None), back, (back_d if back else None)


def _besieged_core(params, lons):
    """围攻纯几何核(不含接纳缓解;lons = {key: 黄经})。

    body:两侧最近实体恰为两攻星(各踞一侧)且距离各≤该侧 orb,夹缝内无救星实体。
    ray :两攻星各有一枚主相位点(0/±60/±90/±120/180)分踞两侧各自 orb 内(同星占两侧不算),
         救援=救星实体(byBody)或其光线(byRay)落入两夹点之间。
    """
    target = params['target']
    ba = params['besiegerA']
    bb = params['besiegerB']
    mode = params.get('mode') or 'body'
    orb_l = float(params.get('orbLeft') or 8.0)
    orb_r = float(params.get('orbRight') or 8.0)
    rescue = params.get('rescue') or {}
    rescue_on = bool(rescue.get('enabled', True))
    rescuers = rescue.get('rescuers') or ['Venus', 'Jupiter']
    rescue_body = bool(rescue.get('byBody', True))
    rescue_ray = bool(rescue.get('byRay', False))
    t = lons[target]

    if mode == 'body':
        pool = [k for k in _SEVEN if k != target and k in lons]
        fwd, fwd_d, back, back_d = _nearest_body_each_side(target, lons, pool)
        if fwd is None or back is None:
            return False
        if {fwd, back} != {ba, bb}:
            return False
        # 侧别对号:顺行前方按 orbLeft、后方按 orbRight(左右=黄道序前后,与前端 dexter 注释同框架)
        if fwd_d > orb_l or back_d > orb_r:
            return False
        if rescue_on and rescue_body:
            for rk in rescuers:
                if rk in lons and rk not in (ba, bb, target):
                    d = _side_dist(t, lons[rk])
                    if 0 <= d < fwd_d or 0 > d > -back_d:
                        return False
        return True

    # ray 模式
    def side_rays(key):
        fwd_best = back_best = None
        for off in _RAY_OFFSETS:
            d = _side_dist(t, lons[key] + off)
            if d >= 0:
                if fwd_best is None or d < fwd_best:
                    fwd_best = d
            else:
                if back_best is None or -d < back_best:
                    back_best = -d
        return fwd_best, back_best

    a_fwd, a_back = side_rays(ba)
    b_fwd, b_back = side_rays(bb)
    combos = []
    if a_fwd is not None and b_back is not None:
        combos.append((a_fwd, b_back))
    if b_fwd is not None and a_back is not None:
        combos.append((b_fwd, a_back))
    hit = None
    for fwd_d, back_d in combos:
        if fwd_d <= orb_l and back_d <= orb_r:
            if hit is None or (fwd_d + back_d) < (hit[0] + hit[1]):
                hit = (fwd_d, back_d)
    if hit is None:
        return False
    if rescue_on:
        fwd_d, back_d = hit
        for rk in rescuers:
            if rk not in lons or rk in (ba, bb, target):
                continue
            if rescue_body:
                d = _side_dist(t, lons[rk])
                if 0 <= d < fwd_d or 0 > d > -back_d:
                    return False
            if rescue_ray:
                rf, rb = side_rays(rk)
                if (rf is not None and rf < fwd_d) or (rb is not None and rb < back_d):
                    return False
    return True


def _eval_besieged(params, ctx, domain):
    target = params['target']
    ba = params['besiegerA']
    bb = params['besiegerB']
    for k in (target, ba, bb):
        ctx.swe_id(k)
    if len({target, ba, bb}) != 3:
        raise ValueError('besieged 三星必须互异')
    if (params.get('mode') or 'body') not in ('body', 'ray'):
        raise ValueError('besieged.mode 需为 body/ray')
    mitigation = params.get('mitigation') or {}
    reception_breaks = bool(mitigation.get('receptionBreaks', False))
    rescuers = (params.get('rescue') or {}).get('rescuers') or ['Venus', 'Jupiter']
    jd0, jd1 = domain
    keys = list({target, ba, bb, *(_SEVEN if (params.get('mode') or 'body') == 'body' else ()), *rescuers})

    def pred(jd):
        m = ctx.moment(jd)
        lons = {k: m.lon(k) for k in _SEVEN}
        for extra in (target, ba, bb, *rescuers):
            if extra not in lons:
                lons[extra] = m.lon(extra)
        if not _besieged_core(params, lons):
            return False
        if reception_breaks:
            # 缓解:被围星与任一攻星存在(宽松,不要求相位)任一方向的正尊贵接纳 → 视为解围
            dyn = m.dynamics()
            for other in (ba, bb):
                for x, y in ((target, other), (other, target)):
                    digs = [d for d in dyn.inDignities(x, y) if d not in ('exile', 'fall')]
                    if digs:
                        return False
        return True

    return true_intervals(pred, jd0, jd1, _b_step(keys))


_PATTERNS = ('t_square', 'grand_trine', 'grand_cross', 'kite', 'yod', 'mystic_rectangle')

_PATTERN_POOL = _SEVEN + ('Uranus', 'Neptune', 'Pluto')


def _within(lons, a, b, angle, orb):
    return abs(_wrap180(_wrap180(lons[a] - lons[b]) - angle)) <= orb or \
        abs(_wrap180(_wrap180(lons[a] - lons[b]) + angle)) <= orb


def _pattern_hits(lons, pattern, apex, members, orb):
    """相位格局纯几何核:在 lons 池上枚举组合,返回是否存在满足形。apex 限定顶点星。"""
    pool = [k for k in (members if members and members != 'any' else _PATTERN_POOL) if k in lons]
    n = len(pool)
    idx = range(n)

    def W(a, b, ang):
        return _within(lons, pool[a], pool[b], ang, orb)

    if pattern == 't_square':
        for i in idx:
            for j in idx:
                if j <= i or not W(i, j, 180.0):
                    continue
                for k in idx:
                    if k in (i, j):
                        continue
                    if apex and apex != 'any' and pool[k] != apex:
                        continue
                    if W(k, i, 90.0) and W(k, j, 90.0):
                        return True
        return False
    if pattern == 'grand_trine':
        for i in idx:
            for j in idx:
                if j <= i or not W(i, j, 120.0):
                    continue
                for k in idx:
                    if k <= j or not (W(k, i, 120.0) and W(k, j, 120.0)):
                        continue
                    return True
        return False
    if pattern == 'grand_cross':
        for i in idx:
            for j in idx:
                if j <= i or not W(i, j, 180.0):
                    continue
                for k in idx:
                    if k in (i, j):
                        continue
                    for l in idx:
                        if l <= k or l in (i, j) or not W(k, l, 180.0):
                            continue
                        if W(i, k, 90.0) and W(i, l, 90.0) and W(j, k, 90.0) and W(j, l, 90.0):
                            return True
        return False
    if pattern == 'kite':
        for i in idx:
            for j in idx:
                if j <= i or not W(i, j, 120.0):
                    continue
                for k in idx:
                    if k <= j or not (W(k, i, 120.0) and W(k, j, 120.0)):
                        continue
                    for l in idx:
                        if l in (i, j, k):
                            continue
                        for tail in (i, j, k):
                            others = [x for x in (i, j, k) if x != tail]
                            if W(l, tail, 180.0) and W(l, others[0], 60.0) and W(l, others[1], 60.0):
                                return True
        return False
    if pattern == 'yod':
        for i in idx:
            for j in idx:
                if j <= i or not W(i, j, 60.0):
                    continue
                for k in idx:
                    if k in (i, j):
                        continue
                    if apex and apex != 'any' and pool[k] != apex:
                        continue
                    if W(k, i, 150.0) and W(k, j, 150.0):
                        return True
        return False
    if pattern == 'mystic_rectangle':
        for i in idx:
            for j in idx:
                if j <= i or not W(i, j, 180.0):
                    continue
                for k in idx:
                    if k in (i, j):
                        continue
                    for l in idx:
                        if l <= k or l in (i, j) or not W(k, l, 180.0):
                            continue
                        if W(i, k, 60.0) and W(j, l, 60.0) and W(i, l, 120.0) and W(j, k, 120.0):
                            return True
                        if W(i, k, 120.0) and W(j, l, 120.0) and W(i, l, 60.0) and W(j, k, 60.0):
                            return True
        return False
    raise ValueError('aspect_pattern 不支持 {0!r}'.format(pattern))


def _eval_pattern(params, ctx, domain):
    pattern = params['pattern']
    if pattern not in _PATTERNS:
        raise ValueError('aspect_pattern 不支持 {0!r}'.format(pattern))
    apex = params.get('apex') or 'any'
    members = params.get('members') or 'any'
    if members != 'any':
        for k in members:
            ctx.swe_id(k)
    orb = float(params.get('orb') or 6.0)
    jd0, jd1 = domain
    pool = members if members != 'any' else _PATTERN_POOL

    def pred(jd):
        m = ctx.moment(jd)
        lons = {k: m.lon(k) for k in pool}
        return _pattern_hits(lons, pattern, apex, members, orb)

    return true_intervals(pred, jd0, jd1, _b_step(list(pool)))


_JONES_SHAPES = ('splash', 'bundle', 'bowl', 'locomotive', 'seesaw', 'sling', 'bucket', 'splay')


def _jones_type(lons_list, with_sling=True):
    """Jones 盘形八型(与前端 mundane/patterns.js jonesType(lons, withSling) 双端 fixture 对拍)。

    with_sling=False = 前端旧七型口径逐字(世俗盘兼容基线)。
    with_sling=True 先做**把手型检测**(独立于 g1≥180 门槛——旧口径的 bucket 分支
    g1≥180∧g2≥60 数学上蕴含主群 span≤120,即抓到的全是紧聚提把型;宽群+把手会漏到
    seesaw/splay):∃星 两侧空档均≥60° 且 其余空档全<60°(主群连贯) → 把手型;
    主群跨度 span=360−两侧空档 ≤120° → sling(紧聚掷出),否则 → bucket(碗+把手)。
    非把手型回落七型原判据。"""
    lons = sorted(_norm360(x) for x in lons_list)
    n = len(lons)
    if n < 4:
        return 'splash'
    gaps = []
    for i in range(n):
        nxt = lons[(i + 1) % n]
        cur = lons[i]
        gaps.append(_norm360(nxt - cur) if i < n - 1 else _norm360(lons[0] + 360.0 - cur))
    if with_sling and n >= 5:
        # 把手检测:星 i 的两侧空档 = gaps[i-1](其前) 与 gaps[i](其后)
        for i in range(n):
            a = gaps[(i - 1) % n]
            b = gaps[i]
            if min(a, b) < 60.0:
                continue
            rest = [gaps[j] for j in range(n) if j != i and j != (i - 1) % n]
            if rest and max(rest) < 60.0:
                span = 360.0 - a - b
                return 'sling' if span <= 120.0 else 'bucket'
    g_sorted = sorted(gaps, reverse=True)
    g1 = g_sorted[0]
    g2 = g_sorted[1] if len(g_sorted) > 1 else 0.0
    if g1 >= 240.0:
        return 'bundle'
    if g1 >= 180.0:
        return 'bucket' if g2 >= 60.0 else 'bowl'
    if g1 >= 120.0:
        return 'seesaw' if g2 >= 90.0 else 'locomotive'
    if g1 < 62.0:
        return 'splash'
    return 'splay'


def _eval_chart_shape(params, ctx, domain):
    shape = params['shape']
    if shape not in _JONES_SHAPES:
        raise ValueError('chart_shape 不支持 {0!r}'.format(shape))
    include_outer = bool(params.get('includeOuter', True))
    pool = _PATTERN_POOL if include_outer else _SEVEN
    jd0, jd1 = domain

    def pred(jd):
        m = ctx.moment(jd)
        return _jones_type([m.lon(k) for k in pool]) == shape

    return true_intervals(pred, jd0, jd1, _b_step(list(pool)))


_EVALUATORS = {
    'aspect': _eval_aspect,
    'in_sign': _eval_in_sign,
    'numeric': _eval_numeric,
    'midpoint': _eval_midpoint,
    'point_relation': _eval_point_relation,
    'in_house': _eval_in_house,
    'reception': _eval_reception,
    'mutual_reception': _eval_mutual_reception,
    'rulership': _eval_rulership,
    'dignity_state': _eval_dignity_state,
    'considerations': _eval_considerations,
    'besieged': _eval_besieged,
    'aspect_pattern': _eval_pattern,
    'chart_shape': _eval_chart_shape,
    'day_window': _eval_day_window,
}


# ---------------------------------------------------------------------------
# 条件树求值 + 请求入口
# ---------------------------------------------------------------------------

def _validate_tree(node):
    if not isinstance(node, dict):
        raise ValueError('condition node must be an object')
    t = node.get('type')
    if t in GROUP_TYPES:
        subs = node.get('conditions')
        if not isinstance(subs, list) or not subs:
            raise ValueError('group {0!r} needs non-empty conditions'.format(t))
        if t == 'not' and len(subs) != 1:
            raise ValueError('not group takes exactly one child')
        for c in subs:
            _validate_tree(c)
        return
    spec = CONDITION_TYPES.get(t)
    if spec is None:
        raise ValueError('unknown condition type: {0!r}'.format(t))
    params = node.get('params') or {}
    for key in spec['required']:
        if key not in params:
            raise ValueError('condition {0!r} missing param {1!r}'.format(t, key))


def _eval_node(node, ctx, domain):
    t = node.get('type')
    if t in GROUP_TYPES:
        subs = node.get('conditions') or []
        if t == 'all':
            acc = None
            for c in subs:
                ivs = _eval_node(c, ctx, domain)
                acc = ivs if acc is None else iv_and(acc, ivs)
                if not acc:
                    return []
            return acc or []
        if t == 'any':
            acc = []
            for c in subs:
                acc = iv_or(acc, _eval_node(c, ctx, domain))
            return acc
        if t == 'not':
            return iv_not(_eval_node(subs[0], ctx, domain), domain)
        if t == 'xor':
            return iv_xor([_eval_node(c, ctx, domain) for c in subs], domain)
    return _EVALUATORS[t](node.get('params') or {}, ctx, domain)


def scan(data):
    """征象搜索入口。入参见模块 docstring;返回 {'intervals':[...], 'truncated':bool, 'stats':{...}}。

    口径令牌(termsVariant/triplicity)整个请求 push 一次、finally pop —— 绝不在扫描循环内
    反复 push(全局临界区,照 webchartsrv.index 的配对纪律)。
    """
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
        ctx = ScanContext(data)
    except (ValueError, TypeError) as exc:
        return {'err': 'invalid_conditions', 'detail': str(exc)}
    ctx._syz_lo = jd0 - 1.0
    ctx._syz_hi = jd1

    from astrostudy import perchart
    terms_token = perchart.push_request_terms(
        ctx.eff.get('termsVariant'),
        bool(data.get('leoBoundFirst')),
        bool(data.get('geminiBoundEmended')))
    trip_token = perchart.push_request_trip(ctx.eff.get('triplicity'))
    try:
        ivs = _eval_node(tree, ctx, (jd0, jd1))
    except (ValueError, TypeError, KeyError) as exc:
        # 求值期参数错误(如角度字段用 gt、未知点类型)同样归 invalid_conditions,
        # 不让它冒成端点层的 internal(前端要能把 detail 直给用户)。
        return {'err': 'invalid_conditions', 'detail': str(exc)}
    finally:
        perchart.pop_request_trip(trip_token)
        perchart.pop_request_terms(terms_token)

    ivs = norm_intervals(ivs)
    truncated = len(ivs) > MAX_INTERVALS
    if truncated:
        ivs = ivs[:MAX_INTERVALS]

    precision = data.get('precision') or 'minute'
    out = []
    for s, e in ivs:
        rec_s = date_time_from_jd(s, zone)
        rec_e = date_time_from_jd(e, zone)
        if precision == 'minute':
            start_text = rec_s['datetime'][:16]
            end_text = rec_e['datetime'][:16]
        else:
            start_text = rec_s['datetime']
            end_text = rec_e['datetime']
        # 安全起盘时刻 pick:起点+ε 缓冲(ε=min(90s, 区间长/4))秒级——区间起点恰是征象
        # 翻转瞬间,显示串按分钟截断回填必落到边界错侧(真机实抓:月 29°59′双子「未入庙」);
        # 起盘一律用 pick,显示仍用 start。
        eps = min(90.0 / 86400.0, (e - s) / 4.0)
        rec_p = date_time_from_jd(s + eps, zone)
        rec_pe = date_time_from_jd(e - eps, zone)
        out.append({
            'start': start_text,
            'end': end_text,
            'pick': rec_p['datetime'],
            'pickEnd': rec_pe['datetime'],
            'startJd': s,
            'endJd': e,
            'durationMin': round((e - s) * 1440.0, 1),
        })
    return {
        'intervals': out,
        'truncated': truncated,
        'stats': {'evalPoints': ctx.eval_points, 'spanDays': round(jd1 - jd0, 2)},
    }


# ---------------------------------------------------------------------------
# R3 判读条件族接线(light_dynamics/royal_attendance/sect_joy/pattern_overview/…):
# 求值层在 election_scan_ext.py、纯几何核在 election_scan_cores.py;此处仅并表。
# ---------------------------------------------------------------------------
from astrostudy import election_scan_ext as _ext  # noqa: E402  (late-import,防循环加载)

_EVALUATORS.update(_ext.EVALUATORS)


def explain(data):
    """单时刻逐叶判读(R4 详情面板):入参=scan 同构 + t='YYYY/MM/DD HH:mm:ss'。
    pass 判定复用扫描求值器于微域(与 scan 绝对同源);actual=每类实测文本。"""
    from websrv._guards import validate_geo
    geoerr = validate_geo(data)
    if geoerr is not None:
        return geoerr
    zone = data.get('zone', '+08:00')
    ad = int(data.get('ad') or 1)
    t = data.get('t') or ''
    try:
        date_part, time_part = t.replace('-', '/').split(' ')
        jd = _jd_from(date_part, time_part, zone, ad)
    except Exception as exc:
        return {'err': 'invalid_range', 'detail': 't 需为 YYYY/MM/DD HH:mm:ss ({0})'.format(exc)}
    tree = data.get('conditions')
    try:
        _validate_tree(tree)
        ctx = ScanContext(data)
    except (ValueError, TypeError) as exc:
        return {'err': 'invalid_conditions', 'detail': str(exc)}
    ctx._syz_lo = jd - 40.0
    ctx._syz_hi = jd + 1.0
    from astrostudy import perchart as _pch
    terms_token = _pch.push_request_terms(
        ctx.eff.get('termsVariant'),
        bool(data.get('leoBoundFirst')),
        bool(data.get('geminiBoundEmended')))
    trip_token = _pch.push_request_trip(ctx.eff.get('triplicity'))
    try:
        node = _ext.explain_tree(tree, ctx, jd)
    except (ValueError, TypeError, KeyError) as exc:
        return {'err': 'invalid_conditions', 'detail': str(exc)}
    finally:
        _pch.pop_request_trip(trip_token)
        _pch.pop_request_terms(terms_token)
    return {'t': t, 'tree': node}
