# -*- coding: utf-8 -*-
"""全行星中心盘计算内核(3D 星盘多中心引擎)。

以任意天体为中心(地心/日心/月心/九大行星心)输出全行星状态、轨道线与相位:

- 中心枚举 = geo / helio / moon / mercury / venus / mars / jupiter / saturn /
  uranus / neptune / pluto(_safe_center 白名单,未知一律回落 geo);
- helio 走 swisseph.calc_ut(FLG_HELCTR),其余非地心中心走 swisseph.calc_pctr;
- calc_pctr 只接受 ET(TT) 儒略日:UT→ET 换算的唯一入口 = _to_et(),
  全文件只允许此一处调用 deltat(有负向测试钉死);
- 每体输出黄道系 lon/lat/speed/dist + 赤道系 ra/decl(FLG_EQUATORIAL 二次计算同口径);
- 轨道线由内置恒星周期表统一推导(闭合整圈 / ±1 会合周期尾迹),不逐对硬编码;
- 相位 = 中心黄经差 + applying 判定;无宫无轴(非地心中心物理上无地平)。

结构性隔离:本模块绝不 import astrostudy.perchart / astrostudy.perpredict /
astrostudy.pd_engine,与主限法 byte-perfect golden 零耦合(测试有源码级守卫)。
"""

import math

import swisseph

# 仅为触发星历文件路径注册(flatlib.ephem 在 import 时 set_ephe_path 到内置
# swefiles;calc_pctr 必须有星历文件,Moshier 内置模型不覆盖行星心计算)。
# 除路径副作用外不使用其中任何符号。
import flatlib.ephem  # noqa: F401


# ---------------------------------------------------------------------------
# 常量表
# ---------------------------------------------------------------------------

_BASE_FLAGS = swisseph.FLG_SWIEPH | swisseph.FLG_SPEED

# 全体天体(输出顺序即此序;中心体自身从 bodies 中剔除)
BODY_ORDER = ('Sun', 'Moon', 'Mercury', 'Venus', 'Earth',
              'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto')

BODY_SWE_ID = {
    'Sun': swisseph.SUN,
    'Moon': swisseph.MOON,
    'Mercury': swisseph.MERCURY,
    'Venus': swisseph.VENUS,
    'Earth': swisseph.EARTH,
    'Mars': swisseph.MARS,
    'Jupiter': swisseph.JUPITER,
    'Saturn': swisseph.SATURN,
    'Uranus': swisseph.URANUS,
    'Neptune': swisseph.NEPTUNE,
    'Pluto': swisseph.PLUTO,
}

# 行星心/月心中心 → swisseph 中心体编号(calc_pctr 第三参)
CENTER_SWE_ID = {
    'moon': swisseph.MOON,
    'mercury': swisseph.MERCURY,
    'venus': swisseph.VENUS,
    'mars': swisseph.MARS,
    'jupiter': swisseph.JUPITER,
    'saturn': swisseph.SATURN,
    'uranus': swisseph.URANUS,
    'neptune': swisseph.NEPTUNE,
    'pluto': swisseph.PLUTO,
}

# 中心 → 中心体天体名(用于从 bodies 剔除自身)
CENTER_BODY_NAME = {
    'geo': 'Earth',
    'helio': 'Sun',
    'moon': 'Moon',
    'mercury': 'Mercury',
    'venus': 'Venus',
    'mars': 'Mars',
    'jupiter': 'Jupiter',
    'saturn': 'Saturn',
    'uranus': 'Uranus',
    'neptune': 'Neptune',
    'pluto': 'Pluto',
}

VALID_CENTERS = tuple(CENTER_BODY_NAME.keys())

# 九星恒星公转周期表(儒略年)——轨道线周期推导的单一来源,
# 会合周期由 1/T_syn = |1/T_a − 1/T_c| 统一推导,不逐对硬编码。
SIDEREAL_PERIOD_YEARS = {
    'Mercury': 0.2408467,
    'Venus': 0.61519726,
    'Earth': 1.0000174,
    'Mars': 1.8808476,
    'Jupiter': 11.862615,
    'Saturn': 29.447498,
    'Uranus': 84.016846,
    'Neptune': 164.79132,
    'Pluto': 247.92065,
}

DAYS_PER_JULIAN_YEAR = 365.25
MOON_SIDEREAL_DAYS = 27.321661  # 恒星月:月绕地整圈(月心盘的地球轨迹与之镜像)

DEFAULT_ASPECT_ANGLES = (0.0, 60.0, 90.0, 120.0, 180.0)
DEFAULT_ASPECT_ORB = 3.0

DEFAULT_ORBIT_SAMPLES = 128      # 闭合整圈采样点数(含首尾两端)
_TRAIL_RATIO = 181.0 / 128.0     # 尾迹点数 = 闭合点数 × 该比例(默认 128→181)


# ---------------------------------------------------------------------------
# 基础工具
# ---------------------------------------------------------------------------

def _norm360(value):
    return value % 360.0


def _norm180(value):
    return (value + 180.0) % 360.0 - 180.0


def _angle_distance(a, b):
    """两黄经的最小角距(0..180)。"""
    return abs(_norm180(a - b))


def _to_bool(value, default=False):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in ('1', 'true', 'yes', 'on')
    return bool(value)


def _safe_center(center):
    """中心白名单:未知/非法一律回落 geo。"""
    c = str(center or 'geo').strip().lower()
    return c if c in CENTER_BODY_NAME else 'geo'


def _to_et(jd_ut):
    """UT→ET(TT) 的唯一转换入口。

    calc_pctr 只接受 ET(TT) 儒略日;全文件仅允许此处做 deltat 换算,
    任何把 jd_ut 直传 calc_pctr 的写法都是错的(负向测试钉死其必偏离)。
    """
    return jd_ut + swisseph.deltat(jd_ut)


def true_obliquity(jd_ut):
    """当日真黄赤交角(含章动,ECL_NUT 直取),禁止写死 23.44。"""
    xx, _ = swisseph.calc_ut(jd_ut, swisseph.ECL_NUT, 0)
    return xx[0]


# ---------------------------------------------------------------------------
# 天体位置(黄道系 + 赤道系同口径)
# ---------------------------------------------------------------------------

def _calc_raw(jd_ut, body_name, center, flags):
    """按中心分派的单次原始计算(返回 swisseph 6 元组)。"""
    body_id = BODY_SWE_ID[body_name]
    if center == 'geo':
        xx, _ = swisseph.calc_ut(jd_ut, body_id, flags)
    elif center == 'helio':
        xx, _ = swisseph.calc_ut(jd_ut, body_id, flags | swisseph.FLG_HELCTR)
    else:
        # 行星心/月心:calc_pctr 只吃 ET,换算必须走唯一入口 _to_et
        xx, _ = swisseph.calc_pctr(_to_et(jd_ut), body_id,
                                   CENTER_SWE_ID[center], flags)
    return xx


def _calc_pair(jd_ut, body_name, center):
    """同口径两次计算:黄道系 + 赤道系(FLG_EQUATORIAL)。"""
    ecl = _calc_raw(jd_ut, body_name, center, _BASE_FLAGS)
    equ = _calc_raw(jd_ut, body_name, center,
                    _BASE_FLAGS | swisseph.FLG_EQUATORIAL)
    return ecl, equ


def _calc_ecl_position(jd_ut, body_name, center):
    """轨道采样专用:只取黄道系位置(不带速度旗标,位置逐位不变、耗时减半)。"""
    return _calc_raw(jd_ut, body_name, center, swisseph.FLG_SWIEPH)


def default_bodies(center, include_moon):
    """bodies = 全集 − 中心体自身;includeMoon=False 时再剔除月球。

    地球在一切非地心盘中作为天体出现;helio 盘无太阳(太阳即中心)。
    """
    names = [n for n in BODY_ORDER if n != CENTER_BODY_NAME[center]]
    if not include_moon and 'Moon' in names:
        names.remove('Moon')
    return names


# ---------------------------------------------------------------------------
# 轨道线(周期表统一推导)
# ---------------------------------------------------------------------------

def _center_helio_period_days(center):
    """中心体的日心公转周期(天)。地心/月心都随地球(月球日心轨迹≈地球轨道)。"""
    cb = CENTER_BODY_NAME[center]
    key = 'Earth' if cb in ('Earth', 'Moon') else cb
    return SIDEREAL_PERIOD_YEARS[key] * DAYS_PER_JULIAN_YEAR


def synodic_period_days(body_name, center):
    """会合周期:1/T_syn = |1/T_a − 1/T_c|(从周期表推导,不逐对硬编码)。

    月球取地球的日心周期(月随地绕日)。与中心同周期(地/月互看)无会合
    周期,返回 None,调用方走闭合分支。
    """
    key = 'Earth' if body_name == 'Moon' else body_name
    t_a = SIDEREAL_PERIOD_YEARS[key] * DAYS_PER_JULIAN_YEAR
    t_c = _center_helio_period_days(center)
    inv = abs(1.0 / t_a - 1.0 / t_c)
    if inv < 1e-12:
        return None
    return 1.0 / inv


def _orbit_plan(center, body_name):
    """轨道线形态推导:返回 (closed, period_days)。

    - helio:每星沿自身恒星周期闭合整圈(月球随地球,按地球年闭合);
    - 非日心的太阳 = 中心行星自身轨道的镜像 → 按中心体日心周期闭合整圈;
    - 地心的月球 / 月心的地球 = 卫星轨道(恒星月闭合整圈);
    - 其余天体 = ±1 会合周期尾迹(逆行环由此显形);月球跟随地球窗口。
    """
    if center == 'helio':
        key = 'Earth' if body_name == 'Moon' else body_name
        return True, SIDEREAL_PERIOD_YEARS[key] * DAYS_PER_JULIAN_YEAR
    if body_name == 'Sun':
        return True, _center_helio_period_days(center)
    if center == 'geo' and body_name == 'Moon':
        return True, MOON_SIDEREAL_DAYS
    if center == 'moon' and body_name == 'Earth':
        return True, MOON_SIDEREAL_DAYS
    t_syn = synodic_period_days(body_name, center)
    if t_syn is None:
        # 防御回退(地/月互看已被上面特判,正常不可达):按自身周期闭合。
        key = 'Earth' if body_name == 'Moon' else body_name
        return True, SIDEREAL_PERIOD_YEARS[key] * DAYS_PER_JULIAN_YEAR
    return False, t_syn


def _clamp_orbit_samples(orbit_samples):
    try:
        n = int(round(float(orbit_samples)))
    except (TypeError, ValueError):
        n = DEFAULT_ORBIT_SAMPLES
    return max(8, min(1024, n))


def _trail_sample_count(orbit_samples):
    """尾迹点数:随闭合点数等比(默认 128→181),取奇数使正中样本恰为当前时刻。"""
    n = int(round(orbit_samples * _TRAIL_RATIO))
    if n % 2 == 0:
        n += 1
    return max(3, n)


def orbit_for(jd_ut, center, body_name, orbit_samples=DEFAULT_ORBIT_SAMPLES):
    """单体轨道线:closed=含首尾采满一整圈(首尾点距<步长);trail=±1 会合周期尾迹。

    采样点带 lon/lat/dist(黄道系),尾迹正中样本 = 当前时刻。
    """
    closed, period = _orbit_plan(center, body_name)
    n = _clamp_orbit_samples(orbit_samples)
    samples = []
    if closed:
        # k=0..n-1 覆盖 [jd, jd+T] 含两端:首尾时间差恰为一整周期 → 自然闭合
        step = period / float(n - 1)
        times = [jd_ut + k * step for k in range(n)]
    else:
        m = _trail_sample_count(n)
        half = (m - 1) // 2
        step = 2.0 * period / float(m - 1)
        times = [jd_ut + (k - half) * step for k in range(m)]
    for t in times:
        xx = _calc_ecl_position(t, body_name, center)
        samples.append({'lon': _norm360(xx[0]), 'lat': xx[1], 'dist': xx[2]})
    return {'closed': closed, 'periodDays': period, 'samples': samples}


# ---------------------------------------------------------------------------
# 相位(中心黄经差;无宫无轴)
# ---------------------------------------------------------------------------

def _parse_aspect_angles(aspect_angles):
    if not aspect_angles:
        return DEFAULT_ASPECT_ANGLES
    out = []
    for item in aspect_angles:
        try:
            v = float(item)
        except (TypeError, ValueError):
            continue
        if 0.0 <= v <= 180.0:
            out.append(v)
    return tuple(out) if out else DEFAULT_ASPECT_ANGLES


def compute_aspects(bodies, aspect_angles=DEFAULT_ASPECT_ANGLES,
                    orb=DEFAULT_ASPECT_ORB):
    """中心黄经差相位。applying = 按黄经速度线性外推短时距后离准确相位更近。"""
    out = []
    dt = 0.01  # 外推步长(日):只用于入相/出相方向判定
    for i in range(len(bodies)):
        for j in range(i + 1, len(bodies)):
            a, b = bodies[i], bodies[j]
            sep = _angle_distance(a['lon'], b['lon'])
            for ang in aspect_angles:
                d = abs(sep - ang)
                if d <= orb:
                    sep_next = _angle_distance(a['lon'] + a['speed'] * dt,
                                               b['lon'] + b['speed'] * dt)
                    out.append({
                        'a': a['id'],
                        'b': b['id'],
                        'aspect': ang,
                        'orb': d,
                        'applying': abs(sep_next - ang) < d,
                    })
    return out


# ---------------------------------------------------------------------------
# 主入口
# ---------------------------------------------------------------------------

def state(center='geo', jd_ut=None, include_moon=None,
          orbit_samples=DEFAULT_ORBIT_SAMPLES, asporb=DEFAULT_ASPECT_ORB,
          aspect_angles=None, with_orbits=True):
    """全行星中心盘状态:bodies + orbits + aspects。

    - center:11 中心白名单(未知回 geo);
    - jd_ut:UT 儒略日(必填);
    - include_moon:默认 = center != 'helio'(日心下月地恒差<0.55° 视觉重叠,
      默认并入地球;其它中心默认单列,UI 可开关);
    - orbit_samples:闭合整圈采样点数(默认 128;尾迹点数等比 → 181);
    - asporb / aspect_angles:相位容许度与相位角集合。
    """
    if jd_ut is None:
        raise ValueError('jd_ut is required')
    jd_ut = float(jd_ut)
    c = _safe_center(center)
    if include_moon is None:
        include_moon = (c != 'helio')
    include_moon = _to_bool(include_moon, c != 'helio')

    names = default_bodies(c, include_moon)
    bodies = []
    for name in names:
        ecl, equ = _calc_pair(jd_ut, name, c)
        bodies.append({
            'id': name,
            'lon': _norm360(ecl[0]),
            'lat': ecl[1],
            'dist': ecl[2],
            'speed': ecl[3],
            'ra': _norm360(equ[0]),
            'decl': equ[1],
        })

    try:
        orb = float(asporb)
    except (TypeError, ValueError):
        orb = DEFAULT_ASPECT_ORB

    result = {
        'center': c,
        'jd': jd_ut,
        'eps': true_obliquity(jd_ut),
        'includeMoon': include_moon,
        'bodies': bodies,
        'aspects': compute_aspects(bodies, _parse_aspect_angles(aspect_angles), orb),
    }
    if with_orbits:
        # 逐星容错:贴近星历域边界时,长周期星整圈采样会越出数据域(如 16799 年冥王轨道
        # 采到 17047)——该星轨道置 None,主体位置与其余轨道照常;域内任何星不受影响。
        orbits = {}
        for name in names:
            try:
                orbits[name] = orbit_for(jd_ut, c, name, orbit_samples)
            except Exception:
                orbits[name] = None
        result['orbits'] = orbits
    return result
