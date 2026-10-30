# -*- coding: utf-8 -*-
"""主限法 · 世俗向运(In Mundo)的世俗位置与逆变换。

Placidus:迫星(作目标)的半弧象限比例位置加上相位(每 90° 一象限),应星沿自身周日圈走到该比例位置;
子午距按 [0,360) 原值求、取较小者(只有两者都大于 90° 且离 IC 更近时取折叠后的 IC 距),
比例分母取迫星在真实地平那一侧的半弧;迫星在地平上恒按东半取 T = 4 − q,地平下按「东 = RAMC < RA < RAIC」取 2 ± q
(见 placidus_mundane_arc)。

Equal(时圈):宫圈为时圈、宫位按黄道等分;点的世俗位置 = 其时圈与黄道交点的黄经,相位加在应星一侧,
应星相位点的赤经走到迫星赤经处(见 equal_hour_mundane_arc)。

Morinus:世俗相位加在黄经圈与赤道交点的赤经(黄道升)上,再换回黄经得目标黄经圈(见 morinus_mundane_target_lon);
迫星沿自身赤纬圈走到该黄经圈上(交点函数同 pd_semiarc_pole.ecliptic_pole_circle_arc)。

Alcabitius 分宫的宫圈是过三分点的时圈:上升点昼半弧 D = 90 + AD(上升点)、夜半弧 N = 180 − D,
赤道上自 MC 向东依次 D, N, D, N 四段,各段线性映到世俗角 U = 0 / 90 / 180 / 270(MC=0、ASC=90、IC=180、DSC=270)。

世俗位置一律按距 MC 的东向赤经差(真实最短角距)分段,与赤经 0° 落在哪里无关;
Placidus 比例位置与半弧法同一个函数(pd_semiarc_pole.placidus_position)。

全部角度单位为度。函数无副作用。
"""
import math

from astrostudy import pd_semiarc_pole as _sp


def _wrap180(x):
    return (x + 180.0) % 360.0 - 180.0


def alcabitius_mundane_position(ra, ramc, dsa_asc):
    """世俗角 U ∈ [0,360)。dsa_asc = 上升点昼半弧 D。"""
    d = dsa_asc
    n = 180.0 - d
    x = (ra - ramc) % 360.0          # 距 MC 的东向赤经差
    if x < d:
        u = 90.0 * x / d
    elif x < 180.0:
        u = 90.0 + 90.0 * (x - d) / n
    elif x < 180.0 + d:
        u = 180.0 + 90.0 * (x - 180.0) / d
    else:
        u = 270.0 + 90.0 * (x - 180.0 - d) / n
    return u % 360.0


def alcabitius_mundane_inverse(u, dsa_asc):
    """世俗角 U → 距 MC 向东的赤经差。"""
    u %= 360.0
    d = dsa_asc
    n = 180.0 - d
    if u <= 90.0:
        return u * d / 90.0
    if u <= 180.0:
        return d + (u - 90.0) * n / 90.0
    if u <= 270.0:
        return 180.0 + (u - 180.0) * d / 90.0
    return 180.0 + d + (u - 270.0) * n / 90.0


def alcabitius_mundane_arc(ra_p, ra_s, ramc, dsa_asc, aspect):
    """迫星(赤经 ra_p)走到应星世俗位置 + aspect 处所需的赤经转角(有符号,正 = 顺)。"""
    if not (0.0 < dsa_asc < 180.0):
        return None
    u = alcabitius_mundane_position(ra_s, ramc, dsa_asc)
    h = alcabitius_mundane_inverse(u + aspect, dsa_asc)
    return _wrap180(ra_p - ramc - h)


def morinus_mundane_target_lon(lon_s, aspect, eps):
    """应星黄经 → 其黄道升(过黄极经度圈与赤道交点的赤经)加 aspect → 换回黄经。"""
    l = math.radians(lon_s)
    e = math.radians(eps)
    z = math.atan2(math.sin(l), math.cos(e) * math.cos(l)) + math.radians(aspect)
    return math.degrees(math.atan2(math.cos(e) * math.sin(z), math.cos(z))) % 360.0


def ecliptic_angles(ramc, lat, eps):
    """由 RAMC、地理纬度与黄赤交角求中天、上升的黄经(度)。"""
    r = math.radians(ramc)
    e = math.radians(eps)
    mc = math.degrees(math.atan2(math.sin(r), math.cos(r) * math.cos(e))) % 360.0
    asc = math.degrees(math.atan2(math.cos(r), -(math.sin(r) * math.cos(e)
                                              + math.tan(math.radians(lat)) * math.sin(e)))) % 360.0
    return mc, asc


def porphyry_quadrants(ramc, lat, eps):
    """Porphyry 四象限 [(起点黄经, 终点黄经, 世俗角起点)]:MC→ASC(0)、ASC→IC(90)、IC→DSC(180)、DSC→MC(270)。"""
    mc, asc = ecliptic_angles(ramc, lat, eps)
    ic, dsc = (mc + 180.0) % 360.0, (asc + 180.0) % 360.0
    return [(mc, asc, 0.0), (asc, ic, 90.0), (ic, dsc, 180.0), (dsc, mc, 270.0)]


def porphyry_mundane_position(lon, quadrants):
    """黄经在所在象限内的比例 → 世俗角(每象限 90°)。"""
    for a, b, base in quadrants:
        span = (b - a) % 360.0
        x = (lon - a) % 360.0
        if x < span:
            return base + 90.0 * x / span
    return 0.0


def porphyry_mundane_inverse(u, quadrants):
    """世俗角 → 黄经(porphyry_mundane_position 的反函数)。"""
    u %= 360.0
    for a, b, base in quadrants:
        if base <= u < base + 90.0:
            return (a + ((b - a) % 360.0) * (u - base) / 90.0) % 360.0
    return quadrants[0][0]


def porphyry_mundane_target_lon(lon_s, aspect, ramc, lat, eps):
    """世俗 Porphyry:应星黄经的世俗角 + aspect → 换回黄经(本命四轴下)。"""
    q = porphyry_quadrants(ramc, lat, eps)
    return porphyry_mundane_inverse(porphyry_mundane_position(lon_s, q) + aspect, q)


def equal_mundane_target_lon(lon_s, aspect):
    """世俗 Equal(黄道等宫):世俗角对黄经斜率为 1,目标黄经 = 应星黄经 + aspect。"""
    return (lon_s + aspect) % 360.0


def placidus_mundane_arc(ra_p, decl_p, ra_s, decl_s, ramc, lat, aspect):
    """应星被带到迫星世俗位置 + aspect 处的弧(arc = RA应 − RA目标,归一到 ±180)。"""
    t = _sp.placidus_position(ra_p, decl_p, ramc, lat)
    if t is None:
        return None
    ra_t = _sp.placidus_position_ra(t - aspect / 90.0, decl_s, ramc, lat)
    if ra_t is None:
        return None
    return _wrap180(ra_s - ra_t)


def position_circle_mundane_position(ra, decl, ramc, lat, kind):
    """过地平南北点的位置圈世俗角 U ∈ [0,360)(MC=0、ASC=90、IC=180、DSC=270)。
    kind='regiomontanus' 取位置圈与赤道的交点,'campanus' 取与卯酉圈的交点,都取该点所在的半圆,
    自子午圈(赤道上的子午点 / 天顶)向东量角。"""
    phi = math.radians(lat)
    north = (-math.sin(phi), 0.0, math.cos(phi))
    x = _sp._vec(ramc - ra, decl)
    m = _sp._cross(north, x)
    if kind == 'campanus':
        hit = _sp._cross(m, north)          # 卯酉圈的法向就是地平南北轴
        ref = (math.cos(phi), 0.0, math.sin(phi))
    else:
        hit = _sp._cross(m, (0.0, 0.0, 1.0))
        ref = (1.0, 0.0, 0.0)
    if _sp._dot(_sp._cross(north, hit), m) < 0.0:
        hit = (-hit[0], -hit[1], -hit[2])
    east = (0.0, -1.0, 0.0)
    return math.degrees(math.atan2(_sp._dot(hit, east), _sp._dot(hit, ref))) % 360.0


def position_circle_mundane_arc(ra_p, decl_p, ra_s, decl_s, ramc, lat, aspect, kind):
    """应星被带到迫星世俗角 + aspect 的那个位置半圆上的弧(正 = 顺)。"""
    return position_circle_arc_to(position_circle_mundane_position(ra_p, decl_p, ramc, lat, kind) + aspect,
                                  ra_s, decl_s, ramc, lat, kind)


def position_circle_arc_to(u_deg, ra_s, decl_s, ramc, lat, kind):
    """应星被带到世俗角 u_deg(约定同 position_circle_mundane_position)那个位置半圆上的弧(正 = 顺)。"""
    u = math.radians(u_deg)
    phi = math.radians(lat)
    ref = (math.cos(phi), 0.0, math.sin(phi)) if kind == 'campanus' else (1.0, 0.0, 0.0)
    east = (0.0, -1.0, 0.0)
    y = tuple(math.cos(u) * ref[k] + math.sin(u) * east[k] for k in range(3))
    h_y = math.degrees(math.atan2(y[1], y[0]))
    d_y = math.degrees(math.asin(max(-1.0, min(1.0, y[2]))))
    return _sp.pole_circle_arc(ramc - h_y, d_y, ra_s, decl_s, ramc, lat)


def position_circle_meridian_parallel_arc(ra_p, decl_p, ra_s, decl_s, ramc, lat, kind):
    """世俗平行(子午,Regiomontanus / Campanus):应星被带到迫星世俗角关于子午圈的镜像(U ↦ −U,同在地平上或下)
    那个位置半圆上;与 Placidus 的半弧比例镜像同一构造,只是换成本法自己的世俗坐标。"""
    u = position_circle_mundane_position(ra_p, decl_p, ramc, lat, kind)
    return position_circle_arc_to(-u, ra_s, decl_s, ramc, lat, kind)


def position_circle_horizon_parallel_arc(ra_p, decl_p, ra_s, decl_s, ramc, lat, kind):
    """世俗平行(地平,Regiomontanus / Campanus):应星被带到迫星世俗角关于地平(上升—下降)的镜像
    (U ↦ 180 − U,同在子午圈东或西)那个位置半圆上;与子午平行同一构造,只换镜像轴。"""
    u = position_circle_mundane_position(ra_p, decl_p, ramc, lat, kind)
    return position_circle_arc_to(180.0 - u, ra_s, decl_s, ramc, lat, kind)


def axis_plane_parallel_arc(ra_p, ra_s, axis_ra):
    """世俗平行(赤经版,任一时圈轴):迫星走到与应星关于该时圈平面镜像的赤经。
    子午轴取 RAMC;地平轴取上升点所在时圈(Alcabitius / Porphyry / 黄道等宫)或 RAMC + 90°(Meridian / 时圈等宫 / Morinus)。
    时圈平面过两极,镜像只翻赤经(α ↦ 2·轴 − α)、赤纬不变,是真实的平面反射。"""
    return _wrap180(ra_p + ra_s - 2.0 * axis_ra)


def axis_plane_rapt_arcs(ra_p, ra_s, axis_ra):
    """急动平行(赤经版):迫星与应星同被周日运动带动,走到关于该时圈平面互为镜像处。
    两者同转 a 后 (α迫 − a) + (α应 − a) ≡ 2·轴 → a ≡ (α迫 + α应 − 2·轴)/2 (mod 180),±180 内两解。"""
    c = _wrap180(ra_p + ra_s - 2.0 * axis_ra) / 2.0
    return [c, _wrap180(c + 180.0)]


def position_circle_rapt_arcs(ra_p, decl_p, ra_s, decl_s, ramc, lat, kind, axis_u, span=179.0):
    """急动平行(Regiomontanus / Campanus):两者同转 a 后世俗角 U迫 + U应 ≡ 2·axis_u(子午轴 axis_u = 0°,地平轴 = 90°)。"""
    from astrostudy.pd_engine import _find_roots

    def f(a):
        r = ramc + a
        return _wrap180(position_circle_mundane_position(ra_p, decl_p, r, lat, kind)
                        + position_circle_mundane_position(ra_s, decl_s, r, lat, kind) - 2.0 * axis_u)

    return [a for a in _find_roots(f, span, 1.0) if abs(f(a)) < 1e-6]


def meridian_parallel_arc(ra_p, ra_s, ramc):
    """世俗平行(子午,赤经版):迫星走到与应星子午距相等、东西相反的位置。"""
    return _wrap180(ra_p + ra_s - 2.0 * ramc)


def morinus_meridian_parallel_arc(ra_p, decl_p, lon_s, ra_s, ramc, eps):
    """世俗子午平行(Morinus):与其余赤经类方法同一构造 —— 子午距相等、东西相反(赤经关于子午圈镜像)。"""
    return meridian_parallel_arc(ra_p, ra_s, ramc)


def placidus_meridian_parallel_arc(ra_p, decl_p, ra_s, decl_s, ramc, lat):
    """世俗平行(子午,Placidus):应星被带到迫星关于子午圈的半弧比例镜像(T ↦ 4 − T)。"""
    t = _sp.placidus_position(ra_p, decl_p, ramc, lat)
    if t is None:
        return None
    ra_t = _sp.placidus_position_ra((4.0 - t) % 4.0, decl_s, ramc, lat)
    if ra_t is None:
        return None
    return _wrap180(ra_s - ra_t)


def equal_hour_mundane_arc(ra_p, ra_s, aspect, eps):
    """应星时圈与黄道交点的黄经 + aspect 处的黄道点,其赤经走到迫星赤经处的弧:wrap180(RA相位点 − RA迫)。"""
    e = math.radians(eps)
    a = math.radians(ra_s)
    lam = math.atan2(math.sin(a), math.cos(a) * math.cos(e)) + math.radians(aspect)
    ra_q = math.degrees(math.atan2(math.sin(lam) * math.cos(e), math.cos(lam)))
    return _wrap180(ra_q - ra_p)



def horizon_point_eq(azimuth_deg, ramc, lat, altitude=0.0):
    """地平坐标(方位 A 自北向东、高度 h)→ (赤经, 赤纬)(同 pd_semiarc_pole.horizon_to_eq)。"""
    return _sp.horizon_to_eq(azimuth_deg, altitude, ramc, lat)


def horizontal_mundane_arc(ra_p, decl_p, ra_s, decl_s, ramc, lat, aspect, target_azimuth=None):
    """世俗 Horizontal:世俗相位加在方位角上,应星沿周日圈走到目标方位那半条地平经圈上。
    北纬目标方位 = A迫 + aspect;南纬 = A迫 − aspect(南纬盘是北纬盘关于赤道的镜像,方位 A ↦ 180° − A,
    这样左右相位对宫位的方向两半球一致)。target_azimuth 给定时直接用它(经典口径的写法由调用方算)。"""
    if target_azimuth is None:
        a_p = _sp.azimuth(ra_p, decl_p, ramc, lat)
        target_azimuth = a_p + aspect if lat >= 0 else a_p - aspect
    return _sp.vertical_circle_arc(target_azimuth % 360.0, ra_s, decl_s, ramc, lat)


def horizontal_parallel_arc(ra_p, decl_p, ra_s, decl_s, ramc, lat, axis):
    """世俗平行(Horizontal):应星走到迫星方位关于子午面(axis='MER',A ↦ −A)或卯酉面(axis='HOR',A ↦ 180° − A)的镜像
    那半条地平经圈上 —— 同一构造换成本法自己的度量(方位角)。"""
    a_p = _sp.azimuth(ra_p, decl_p, ramc, lat)
    a_t = -a_p if axis == 'MER' else 180.0 - a_p
    return _sp.vertical_circle_arc(a_t % 360.0, ra_s, decl_s, ramc, lat)


def horizontal_rapt_arcs(ra_p, decl_p, ra_s, decl_s, ramc, lat, axis, span=179.0):
    """急动平行(Horizontal):两者同被周日运动带动,走到方位关于子午面(A迫 + A应 ≡ 0)或卯酉面(≡ 180°)互为镜像处。"""
    from astrostudy.pd_engine import _find_roots
    target = 0.0 if axis == 'MER' else 180.0

    def f(a):
        return _wrap180(_sp.azimuth(ra_p - a, decl_p, ramc, lat) + _sp.azimuth(ra_s - a, decl_s, ramc, lat) - target)

    return [a for a in _find_roots(f, span, 1.0) if abs(f(a)) < 1e-6]


def _ad_clamped(decl, lat):
    x = math.tan(math.radians(decl)) * math.tan(math.radians(lat))
    return math.degrees(math.asin(max(-1.0, min(1.0, x))))


def koch_mundane_position(ra, decl, ramc, lat, ad_mc, east=None):
    """Koch 世俗角 U ∈ [0,360)(MC=0、ASC=90、IC=180、DSC=270):东半用出生地纬度下的斜升、西半用斜降,
    自天顶度数的斜升 / 斜降起按天顶度数昼半弧 DSA = 90° + AD天顶 线性量(上下象限同一斜率,与 Koch 宫首三分同式)。
    east 不给时按真实时角判东西。"""
    dsa = 90.0 + ad_mc
    if east is None:
        east = _wrap180(ra - ramc) > 0
    if east:
        oa = ra - _ad_clamped(decl, lat)
        return (90.0 * ((oa - (ramc - ad_mc)) % 360.0) / dsa) % 360.0
    od = ra + _ad_clamped(decl, lat)
    return (360.0 - 90.0 * (((ramc + ad_mc) - od) % 360.0) / dsa) % 360.0


def koch_arc_to(u, ra_s, decl_s, ramc, lat, ad_mc):
    """应星沿周日圈走到 Koch 世俗角 u 的位置圈上:u 在东半(0 … 180)取 +φ 斜升圈、西半取 −φ 斜降圈。"""
    dsa = 90.0 + ad_mc
    u %= 360.0
    if u <= 180.0:
        p, c = float(lat), (ramc - ad_mc) + u * dsa / 90.0
    else:
        p, c = -float(lat), (ramc + ad_mc) - (360.0 - u) * dsa / 90.0
    x = math.tan(math.radians(p)) * math.tan(math.radians(decl_s))
    if abs(x) >= 1.0:
        return None
    return _wrap180((ra_s - math.degrees(math.asin(x))) - c)


def koch_parallel_arc(ra_p, decl_p, ra_s, decl_s, ramc, lat, ad_mc, axis):
    """世俗平行(Koch):应星走到迫星世俗角关于子午(U ↦ 360 − U)或地平(U ↦ 180 − U)的镜像位置圈上。"""
    u = koch_mundane_position(ra_p, decl_p, ramc, lat, ad_mc)
    return koch_arc_to((360.0 - u) if axis == 'MER' else (180.0 - u), ra_s, decl_s, ramc, lat, ad_mc)


def koch_rapt_arcs(ra_p, decl_p, ra_s, decl_s, ramc, lat, ad_mc, axis, span=179.0):
    """急动平行(Koch):两者同被周日运动带动,走到世俗角关于子午(U迫 + U应 ≡ 0)或地平(≡ 180)互为镜像处(本命宫架不动)。"""
    from astrostudy.pd_engine import _find_roots
    target = 0.0 if axis == 'MER' else 180.0

    def f(a):
        return _wrap180(koch_mundane_position(ra_p - a, decl_p, ramc, lat, ad_mc)
                        + koch_mundane_position(ra_s - a, decl_s, ramc, lat, ad_mc) - target)

    return [a for a in _find_roots(f, span, 1.0) if abs(f(a)) < 1e-6]


def koch_mundane_arc(ra_p, decl_p, ra_s, decl_s, ramc, lat, ad_mc, aspect, east=None):
    """世俗 Koch:目标世俗角 U迫 + aspect;目标位置圈在东半取 +φ 斜升圈、西半取 −φ 斜降圈(由世俗角反推常数),
    应星沿周日圈走到这条圈上(按目标圈定极,不看应星自己在哪一侧 —— Koch 世俗角在子午线上对非天顶赤纬的点不连续)。"""
    return koch_arc_to(koch_mundane_position(ra_p, decl_p, ramc, lat, ad_mc, east) + aspect, ra_s, decl_s, ramc, lat, ad_mc)
