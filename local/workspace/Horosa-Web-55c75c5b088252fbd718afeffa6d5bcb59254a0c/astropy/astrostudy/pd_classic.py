# -*- coding: utf-8 -*-
"""主限法几何「经典」口径:沿用传统程序的写法,与「改进」口径(pd_semiarc_pole / pd_mundane 里的同名函数)
的差别只在下面几处:
- 子午东西按赤经数值直接比较(东 = RAMC < RA < RAMC + 180,不跨 0° 回绕);到中天、天底的距离先不折叠,
  两者都大于 90° 时才各自折叠;
- 半弧比例按「离中天 / 天底哪个近」量距离,目标赤经与弧不再归一;
- 极下法的弧一律取 −|W应 − W迫|(不分顺逆);
- 世俗 Alcabitius 的三段区间按 [0, 360) 原值比较,区间跨 0° 时判空、点落入最后一支;
- 世俗子午平行的镜像点同样按上面的东西判定与不折叠的距离取;
- 世俗 Regiomontanus / Campanus 的东西与象限按字面标志取,世俗 Porphyry 跨 0° 白羊的象限不回绕;
- 世俗 Campanus 的子午平行按 Regiomontanus 的子午平行算(迫星极下斜升 / 斜降关于子午对折,应星在同一极下走到该处)。
这几处让赤经起点落在不同位置时结果不同;函数签名与改进口径一一对应,由 pd_geometry 按设置选用。
全部角度单位为度,函数无副作用,无解返回 None。"""
import math

from astrostudy import pd_semiarc_pole as _sp

def _meridian(ra, ramc):
    raic = (ramc + 180.0) % 360.0
    east = ramc < ra < raic
    med = abs(ramc - ra)
    icd = abs(raic - ra)
    fmed = 360.0 - med if med > 180.0 else med
    ficd = 360.0 - icd if icd > 180.0 else icd
    return med, icd, fmed, ficd, east, min(med, icd) > 90.0


def _regio_zenith_distance(md, lat, decl, near_mc):
    """Regiomontanus 位置圈的天顶距(md ≤ 90)。"""
    if md == 90.0:
        return 90.0 - math.degrees(math.atan(math.sin(abs(math.radians(lat)))) * math.tan(math.radians(decl)))
    a = math.degrees(math.atan(math.cos(math.radians(lat)) * math.tan(math.radians(md))))
    b = math.degrees(math.atan(math.tan(abs(math.radians(lat))) * math.cos(math.radians(md))))
    same_side = (decl < 0 and lat < 0) or (decl >= 0 and lat >= 0)
    if same_side:
        c = b - abs(decl) if near_mc else b + abs(decl)
    else:
        c = b + abs(decl) if near_mc else b - abs(decl)
    return a + math.degrees(math.atan(math.sin(abs(math.radians(lat))) * math.sin(math.radians(md)) * math.tan(math.radians(c))))


def _meridian_flags(ra, ramc):
    """子午距与标志 (md, east, near_mc, wrap):东西按字面比较;两段距离都大于 90° 时(赤经跨 0° 回绕)
    改用折叠距离,且近中天时一律记为东。"""
    med, icd, fmed, ficd, east, wrap = _meridian(ra, ramc)
    if wrap:
        md, near_mc = min(fmed, ficd), fmed <= ficd
        if near_mc:
            east = True
    else:
        md, near_mc = min(med, icd), med <= icd
    return md, east, near_mc, wrap


def _regio_pole(ra, decl, ramc, lat):
    """Regiomontanus 位置圈的极与子午标志 (pole, east, near_mc, wrap);无解返回 None。"""
    md, east, near_mc, wrap = _meridian_flags(ra, ramc)
    zd = _regio_zenith_distance(md, lat, decl, near_mc)
    v = math.sin(math.radians(lat)) * math.sin(math.radians(zd))
    if abs(v) > 1.0:
        return None
    return math.degrees(math.asin(v)), east, near_mc, wrap


def topocentric_pole(ra, decl, ramc, lat):
    """Topocentric(Polich–Page)极的传统程序写法:半弧比例与改进口径相同(地平之上从中天量、除以昼半弧,之下从天底量、
    除以夜半弧),东西按赤经字面比较(_meridian_flags,不跨 0° 回绕)。东西判对时与改进口径逐位相同。"""
    from astrostudy import pd_semiarc_pole as _sp
    r = _sp._meridian_ratio(ra, decl, ramc, lat)
    if r is None:
        return None
    east = _meridian_flags(ra % 360.0, ramc)[1]
    p = math.degrees(math.atan(math.tan(math.radians(lat)) * r[1]))
    return p if east else -p


def topocentric_arc(ra_t, decl_t, ra_m, decl_m, ramc, lat):
    """Topocentric 本体弧(传统程序写法):动点走到目标点自己的 Topocentric 位置圈,极按上式。"""
    from astrostudy import pd_semiarc_pole as _sp
    return _sp.under_pole_arc(topocentric_pole(ra_t, decl_t, ramc, lat), ra_t, decl_t, ra_m, decl_m)


def horizontal_pole(ra, decl, ramc, lat):
    """Horizontal 极的传统程序写法:|p| 与改进口径相同,正负里的「东西」按赤经字面比较(东取 −sgn φ、西取 +sgn φ)。
    东西判对时与改进口径逐位相同。"""
    from astrostudy import pd_semiarc_pole as _sp
    a = _sp.azimuth(ra, decl, ramc, lat)
    p = math.degrees(math.asin(math.cos(math.radians(lat)) * abs(math.sin(math.radians(a)))))
    east = _meridian_flags(ra % 360.0, ramc)[1]
    return (1.0 if lat >= 0 else -1.0) * p * (-1.0 if east else 1.0)


def horizontal_arc(ra_t, decl_t, ra_m, decl_m, ramc, lat):
    from astrostudy import pd_semiarc_pole as _sp
    return _sp.under_pole_arc(horizontal_pole(ra_t, decl_t, ramc, lat), ra_t, decl_t, ra_m, decl_m)


def koch_pole(ra, decl, ramc, lat):
    """Koch 极的传统程序写法:东西按赤经字面比较(东 +φ、西 −φ)。"""
    return float(lat) if _meridian_flags(ra % 360.0, ramc)[1] else -float(lat)


def koch_arc(ra_t, decl_t, ra_m, decl_m, ramc, lat):
    from astrostudy import pd_semiarc_pole as _sp
    return _sp.under_pole_arc(koch_pole(ra_t, decl_t, ramc, lat), ra_t, decl_t, ra_m, decl_m)


def horizontal_mundane_arc(ra_p, decl_p, ra_s, decl_s, ramc, lat, aspect):
    """世俗 Horizontal 的传统程序写法:南纬把迫星方位角取反后再加相位(目标方位 −A迫 + aspect),
    相当于把迫星镜像到子午面另一侧、连合相都不再相合;北纬与改进口径相同(A迫 + aspect)。"""
    from astrostudy import pd_mundane as _pm
    from astrostudy import pd_semiarc_pole as _sp
    a_p = _sp.azimuth(ra_p, decl_p, ramc, lat)
    return _pm.horizontal_mundane_arc(ra_p, decl_p, ra_s, decl_s, ramc, lat, aspect,
                                      target_azimuth=(a_p if lat >= 0 else -a_p) + aspect)


def _asc_diff(decl, pole):
    v = math.tan(math.radians(decl)) * math.tan(math.radians(pole))
    return None if abs(v) > 1.0 else math.degrees(math.asin(v))


def pole_circle_arc(ra_p, decl_p, ra_s, decl_s, ramc, lat):
    """极下法本体弧(Regiomontanus / Campanus)。迫星点 (ra_p, decl_p) 为黄纬 0 的相位点。"""
    r = _regio_pole(ra_p, decl_p, ramc, lat)
    if r is None:
        return None
    pole, east = r[0], r[1]
    qp = _asc_diff(decl_p, pole)
    qs = _asc_diff(decl_s, pole)
    if qp is None or qs is None:
        return None
    w_s = (ra_s - qs) if east else (ra_s + qs)
    w_p = (ra_p - qp) if east else (ra_p + qp)
    return -abs(w_s - w_p)


def _regio_target_east(ra_p, target, ramc, east, near_mc, wrap):
    """世俗 Regiomontanus 目标位置圈(赤道交点 target,不归一)在子午哪一侧,决定应星取斜升还是斜降。
    以迫星最近的子午轴(中天或天底)为基准,x = 目标点离该轴、朝迫星一侧量的距离(正 = 与迫星同侧):
    - 迫星字面判为东:x > 0 即同侧(只认越过最近那根轴,绕过对面那根轴不察觉),同侧记东;
    - 否则看字面西判断(RAIC < RA < RAMC,只在 RAMC ≥ 180° 时成立):成立则 −180 < x < 0(越过到对侧)记东,
      不成立则 0 < x < 180(与迫星同侧)记东;
    - 两段距离都大于 90° 时轴先展开到迫星一侧,同侧在近中天时要求 0 < x < 180、近天底时只要 x > 0,
      再按迫星(已改写的)东西标志取同侧或对侧为东。"""
    raic = (ramc + 180.0) % 360.0
    axis = ramc if near_mc else raic
    if wrap:
        axis = ra_p - _sp._n180(ra_p - axis)
    x = (target - axis) if ra_p > axis else (axis - target)
    if wrap:
        same = (0.0 < x < 180.0) if near_mc else (x > 0.0)
        return same if east else not same
    if east:
        return x > 0.0
    if raic < ra_p < ramc:
        return -180.0 < x < 0.0
    return 0.0 < x < 180.0


def regio_mundane_arc(ra_p, decl_p, ra_s, decl_s, ramc, lat, aspect):
    """世俗 Regiomontanus:迫星位置圈与赤道交点 W(东取斜升、西取斜降)加相位得目标交点 t(不归一),
    目标位置圈的极 = atan(tanφ·|sin(t − RAMC)|);应星在该极下取斜升或斜降(见 _regio_target_east),
    arc = W应 − t(归一到 ±180°)。"""
    ra_p %= 360.0
    ra_s %= 360.0
    r = _regio_pole(ra_p, decl_p, ramc, lat)
    if r is None:
        return None
    pole, east, near_mc, wrap = r
    qp = _asc_diff(decl_p, pole)
    if qp is None:
        return None
    target = ((ra_p - qp) if east else (ra_p + qp)) + aspect
    pole_t = math.degrees(math.atan(math.tan(math.radians(lat)) * abs(math.sin(math.radians(target - ramc)))))
    qs = _asc_diff(decl_s, pole_t)
    if qs is None:
        return None
    w_s = (ra_s - qs) if _regio_target_east(ra_p, target, ramc, east, near_mc, wrap) else (ra_s + qs)
    return _sp._n180(w_s - target)


def campanus_mundane_arc(ra_p, decl_p, ra_s, decl_s, ramc, lat, aspect):
    """世俗 Campanus:迫星卯酉圈世俗角先量成离最近子午轴的角距 u0(0..90),再按经典子午标志放回象限——
    近中天:东 u0、西 −u0;近天底:东 180 − u0、西 180 + u0;赤经跨 0° 回绕时一律按近天底那两式放。
    其后应星被带到该世俗角 + aspect 的位置半圆上,与改进口径同一几何。"""
    from astrostudy import pd_mundane as _pm
    ra_p %= 360.0
    u = _pm.position_circle_mundane_position(ra_p, decl_p, ramc, lat, 'campanus')
    _md, east, near_mc, wrap = _meridian_flags(ra_p, ramc)
    m = abs(_sp._n180(u))
    u0 = m if near_mc else 180.0 - m
    if near_mc and not wrap:
        u = u0 if east else -u0
    else:
        u = (180.0 - u0) if east else (180.0 + u0)
    return _pm.position_circle_arc_to(u + aspect, ra_s, decl_s, ramc, lat, 'campanus')


def porphyry_mundane_position(lon, quadrants):
    """世俗 Porphyry 世俗角的经典写法:象限内照常按比例;跨 0° 白羊的那个象限四种情形各有写法
    (λ − 起点一律取原始差、结果取模 360):
    - MC→ASC:90·(λ − MC)/(ASC − MC 的原始差,为负);
    - ASC→IC:90 + 90·(λ − ASC)/(180 − 跨度);
    - IC→DSC:90·(λ − MC)/跨度(从中天起量、不加基角);
    - DSC→MC:360 − 90·(MC − λ)/(180 − 跨度)。"""
    mc = quadrants[0][0]
    for k, (a, b, base) in enumerate(quadrants):
        inside = (a <= lon < b) if a < b else (lon >= a or lon < b)
        if not inside:
            continue
        span = (b - a) % 360.0
        if a < b:
            return (base + 90.0 * (lon - a) / span) % 360.0
        if k == 0:
            return (90.0 * (lon - mc) / (b - a)) % 360.0
        if k == 1:
            return (90.0 + 90.0 * (lon - a) / (180.0 - span)) % 360.0
        if k == 2:
            return (90.0 * (lon - mc) / span) % 360.0
        return (360.0 - 90.0 * (mc - lon) / (180.0 - span)) % 360.0
    return 0.0


def porphyry_mundane_inverse(u, quadrants):
    """世俗角 → 黄经的经典写法:跨度取终点 − 起点的原始差(跨 0° 的象限为负,往反方向绕)。"""
    u %= 360.0
    for a, b, base in quadrants:
        if base <= u < base + 90.0:
            return (a + (b - a) * (u - base) / 90.0) % 360.0
    return quadrants[0][0]


def porphyry_mundane_target_lon(lon_s, aspect, ramc, lat, eps):
    from astrostudy import pd_mundane as _pm
    q = _pm.porphyry_quadrants(ramc, lat, eps)
    return porphyry_mundane_inverse(porphyry_mundane_position(lon_s, q) + aspect, q)


def position_circle_mundane_arc(ra_p, decl_p, ra_s, decl_s, ramc, lat, aspect, kind):
    """世俗 Regiomontanus / Campanus 的经典写法,签名与改进口径的同名函数一致。"""
    if kind == 'regiomontanus':
        return regio_mundane_arc(ra_p, decl_p, ra_s, decl_s, ramc, lat, aspect)
    return campanus_mundane_arc(ra_p, decl_p, ra_s, decl_s, ramc, lat, aspect)


def position_circle_meridian_parallel_arc(ra_p, decl_p, ra_s, decl_s, ramc, lat, kind):
    """世俗子午平行(经典)。Regiomontanus 与 Campanus 同用 Regiomontanus 极下的写法(位置圈是同一条过地平南北点的大圆、
    极相同):迫星位置圈的极(子午东西按字面判),W迫 = 赤经 ∓ 斜升差(字面东取 −),关于子午对折得
    t = 2·RAMC − W迫;对折后的位置圈极不变,应星在同一个极下取另一侧 W应,弧 = W应 − t(归一到 ±180°)。
    东西判对时与改进口径(位置圈世俗角关于子午的镜像)逐位相同,只在字面判错的子组(RAMC 侧回绕、近天底、南半球高纬)不同。"""
    from astrostudy import pd_mundane as _pm
    if kind not in ('campanus', 'regiomontanus'):
        return _pm.position_circle_meridian_parallel_arc(ra_p, decl_p, ra_s, decl_s, ramc, lat, kind)
    ra_p %= 360.0
    ra_s %= 360.0
    r = _regio_pole(ra_p, decl_p, ramc, lat)
    if r is None:
        return None
    pole, east = r[0], r[1]
    qp = _asc_diff(decl_p, pole)
    qs = _asc_diff(decl_s, pole)
    if qp is None or qs is None:
        return None
    w_p = (ra_p - qp) if east else (ra_p + qp)
    w_s = (ra_s + qs) if east else (ra_s - qs)
    return _sp._n180(w_s - (2.0 * ramc - w_p))


def _semiarc_fraction_target(t, ad_s, ramc):
    """比例位置 t∈[0,4)(MC=0 → DSC=1 → IC=2 → ASC=3)→ 应星按自身半弧到达的赤经。
    地平上以 RAMC 为基、地平下以 RAIC 为基,结果不归一。"""
    dsa = 90.0 + ad_s
    nsa = 90.0 - ad_s
    t %= 4.0
    raic = (ramc + 180.0) % 360.0
    if t <= 1.0:
        return ramc - t * dsa
    if t <= 2.0:
        return raic + (2.0 - t) * nsa
    if t <= 3.0:
        return raic - (t - 2.0) * nsa
    return ramc + (4.0 - t) * dsa


def semiarc_arc(ra_p, decl_p, ra_s, decl_s, ramc, lat):
    """半弧法本体弧(Placidus)。"""
    ad_p = _sp.ascensional_difference(decl_p, lat)
    ad_s = _sp.ascensional_difference(decl_s, lat)
    if ad_p is None or ad_s is None:
        return None
    med, icd, fmed, ficd, east, wrap = _meridian(ra_p, ramc)
    above = abs(_sp._n180(ra_p - ramc)) <= 90.0 + ad_p
    sa_p = (90.0 + ad_p) if above else (90.0 - ad_p)
    if (not wrap) or fmed > ficd:
        md = min(med, icd) if not wrap else ficd
        q = md / sa_p
        if above:
            t = ((4.0 - q) % 4.0) if east else q
        else:
            t = (2.0 + q) if east else (2.0 - q)
        ra_target = _semiarc_fraction_target(t, ad_s, ramc)
    else:
        q = min(med, icd) / sa_p
        raic = (ramc + 180.0) % 360.0
        if above:
            ra_target = (ramc + q * (90.0 + ad_s)) if east else (ramc - q * (90.0 + ad_s))
        else:
            ra_target = (raic - q * (90.0 - ad_s)) if east else (raic + q * (90.0 - ad_s))
    return (ra_s % 360.0) - ra_target


def alcabitius_mundane_position(ra, ramc, dsa_asc):
    """世俗角 U ∈ [0,360)。dsa_asc = 上升点昼半弧 D。"""
    alpha = ra % 360.0
    r = ramc % 360.0
    d = dsa_asc
    n = 180.0 - d
    asc, ic, desc = (r + d) % 360.0, (r + 180.0) % 360.0, (r + d + 180.0) % 360.0
    if asc <= alpha <= ic:
        u = 90.0 + 90.0 * (alpha - asc) / n
    elif ic <= alpha <= desc:
        u = 180.0 + 90.0 * (alpha - ic) / d
    elif desc <= alpha <= r:
        u = 270.0 + 90.0 * (alpha - desc) / n
    else:
        u = 90.0 * (alpha - r) / d
    return u % 360.0


def placidus_mundane_fraction(ra, decl, ramc, lat):
    """半弧象限比例位置 T ∈ [0,4)(MC=0 → DSC=1 → IC=2 → ASC=3,西向递增),约定见模块说明。"""
    ad = _sp.ascensional_difference(decl, lat)
    if ad is None:
        return None
    raic = (ramc + 180.0) % 360.0
    east = ramc < ra < raic
    med = abs(ramc - ra)
    icd = abs(raic - ra)
    fmed = 360.0 - med if med > 180.0 else med
    ficd = 360.0 - icd if icd > 180.0 else icd
    md = ficd if (min(med, icd) > 90.0 and fmed > ficd) else min(med, icd)
    above = abs(_sp._n180(ra - ramc)) <= 90.0 + ad
    q = md / ((90.0 + ad) if above else (90.0 - ad))
    if above:
        return 4.0 - q
    return (2.0 + q) if east else (2.0 - q)


def placidus_fraction_ra(t, decl, ramc, lat):
    """比例位置 t(取模 4)按该点自身半弧换回赤经:地平上以 RAMC、地平下以 RAIC 为基,结果不归一。"""
    ad = _sp.ascensional_difference(decl, lat)
    if ad is None:
        return None
    dsa = 90.0 + ad
    nsa = 90.0 - ad
    raic = (ramc + 180.0) % 360.0
    t %= 4.0
    if t <= 1.0:
        return ramc - t * dsa
    if t <= 2.0:
        return raic + (2.0 - t) * nsa
    if t <= 3.0:
        return raic - (t - 2.0) * nsa
    return ramc + (4.0 - t) * dsa


def placidus_mundane_arc(ra_p, decl_p, ra_s, decl_s, ramc, lat, aspect):
    """应星被带到迫星世俗位置 + aspect 处的弧(arc = RA应 − RA目标,不再归一)。"""
    t = placidus_mundane_fraction(ra_p, decl_p, ramc, lat)
    if t is None:
        return None
    ra_t = placidus_fraction_ra(t - aspect / 90.0, decl_s, ramc, lat)
    if ra_t is None:
        return None
    return (ra_s % 360.0) - ra_t


def alcabitius_mundane_arc(ra_p, ra_s, ramc, dsa_asc, aspect):
    """迫星走到应星世俗位置 + aspect 处的赤经转角(世俗位置按经典区间判定)。"""
    from astrostudy import pd_mundane as _pm
    if not (0.0 < dsa_asc < 180.0):
        return None
    u = alcabitius_mundane_position(ra_s, ramc, dsa_asc)
    h = _pm.alcabitius_mundane_inverse(u + aspect, dsa_asc)
    return _sp._n180(ra_p - ramc - h)


def meridian_parallel_arc(ra_p, ra_s, ramc):
    """世俗子午平行(赤经版):镜像点按经典东西判定与不折叠的子午距取。"""
    med, icd, _fmed, _ficd, east, _wrap = _meridian(ra_s % 360.0, ramc)
    raic = (ramc + 180.0) % 360.0
    if med <= icd:
        target = (ramc - med) if east else (ramc + med)
    else:
        target = (raic + icd) if east else (raic - icd)
    return _sp._n180(ra_p - target)


def morinus_meridian_parallel_arc(ra_p, decl_p, lon_s, ra_s, ramc, eps):
    """世俗子午平行(Morinus,传统程序写法):目标取应星的映点(关于二至圈对称的黄经 180° − λ应),
    迫星沿自身赤纬圈走到映点所在的黄经圈(与 Morinus 世俗合相同一套黄极圈求交)。与本盘子午无关:
    平行弧 + 合相弧 ≡ 180° − 2·RA迫(黄极圈交点的赤经关于二至圈对称)。"""
    arc = _sp.ecliptic_pole_circle_arc((180.0 - float(lon_s)) % 360.0, ra_p, decl_p, eps)
    return None if arc is None else -arc


def placidus_meridian_parallel_arc(ra_p, decl_p, ra_s, decl_s, ramc, lat):
    """世俗子午平行(Placidus,传统程序写法):先按本体弧 semiarc_arc 的写法把应星带到迫星比例位置得目标赤经,
    再把这个目标关于子午圈作赤经镜像(α ↦ 2·RAMC − α):arc = N180[2(RA应 − RAMC) − semiarc_arc(迫, 应)]。
    与正确几何(半弧比例镜像 T ↦ 4 − T 后再按应星半弧反算)只在 semiarc_arc 的东西 / 回绕分支与比例镜像不一致处有别。"""
    c_old = semiarc_arc(ra_p, decl_p, ra_s, decl_s, ramc, lat)
    if c_old is None:
        return None
    return _sp._n180(2.0 * ((ra_s % 360.0) - ramc) - c_old)
