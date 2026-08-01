# -*- coding: utf-8 -*-
"""
pd_engine.py — 主限法(primary directions)通用推运引擎(自研)。

设计:
  1) 通用数值法(universal numerical method),建在 swisseph 的 swe.house_pos() 之上 ——
     它对 Placidus / Regiomontanus / Campanus / Topocentric 四种位置框架都能给出任意点的
     「世俗位置(mundane position)」,推运 = 在「转动天球(改 ARMC)」上对世俗位置求根。
     这是各闭式的「地面真值」。
  2) 各系统的闭式公式(closed forms),用基础球面三角直接算(向四轴 / Placidus 半弧 /
     Regiomontanus 位置圈 / Campanus(=Regio body→body) / Topocentric 极)。
  3) 时间钥匙:Ptolemy / Naibod / Cardan / Placidus(真太阳弧,逐盘动态)。
  4) 允星扩展:黄道相位 / 世俗相位 / 映点 antiscia / 界 terms。

约定:
  * 角度一律用「度」。
  * 弧 arc > 0 = direct(顺周日运动,promissor 前向到达 significator);arc < 0 = converse。
  * 时角 H = RAMC - RA(向西为正)。

依赖:swisseph(pyswisseph)。纯球面三角 + swisseph 原语,不依赖具体星历数据文件。
"""

import math

import swisseph

DEG = math.pi / 180.0


# ---------------------------------------------------------------------------
# 角度工具
# ---------------------------------------------------------------------------
def norm360(x):
    return x % 360.0


def norm180(x):
    return (x + 180.0) % 360.0 - 180.0


def sind(x):
    return math.sin(x * DEG)


def cosd(x):
    return math.cos(x * DEG)


def tand(x):
    return math.tan(x * DEG)


def asind(x):
    return math.degrees(math.asin(max(-1.0, min(1.0, x))))


def acosd(x):
    return math.degrees(math.acos(max(-1.0, min(1.0, x))))


def atand(x):
    return math.degrees(math.atan(x))


def atan2d(y, x):
    return math.degrees(math.atan2(y, x))


# ---------------------------------------------------------------------------
# 1. 基础球面天文学(所有方法共用的积木)
# ---------------------------------------------------------------------------
def ecl_to_eq(lon, lat, eps):
    """黄道(lon,lat) -> 赤道(RA, dec)。zodiacal 方向时传 lat=0。"""
    ra = atan2d(sind(lon) * cosd(eps) - tand(lat) * sind(eps), cosd(lon))
    dec = asind(sind(lat) * cosd(eps) + cosd(lat) * sind(eps) * sind(lon))
    return norm360(ra), dec


def ascensional_difference(dec, phi):
    """AD = asin(tan phi * tan dec);拱极点 clamp。"""
    v = tand(phi) * tand(dec)
    if v >= 1.0:
        return 90.0
    if v <= -1.0:
        return -90.0
    return asind(v)


def semiarc(dec, phi, diurnal=True):
    """昼半弧 DSA = 90 + AD;夜半弧 NSA = 90 - AD。"""
    ad = ascensional_difference(dec, phi)
    return (90.0 + ad) if diurnal else (90.0 - ad)


def hour_angle(ra, ramc):
    """时角 H = RAMC - RA(向西为正),归一到 ±180。"""
    return norm180(ramc - ra)


def meridian_distance(ra, ramc):
    """上子午距 MD = RA - RAMC(= -H),归一到 ±180。"""
    return norm180(ra - ramc)


def is_above_horizon(ra, dec, ramc, phi):
    """|H| < 昼半弧 则在地平之上。"""
    return abs(hour_angle(ra, ramc)) < semiarc(dec, phi, True)


def relevant_semiarc(ra, dec, ramc, phi):
    """该点当前所在的半弧(在地平上用昼半弧,否则夜半弧)。"""
    return semiarc(dec, phi, is_above_horizon(ra, dec, ramc, phi))


# ---------------------------------------------------------------------------
# 2. 通用数值法(地面真值):建在 swe.house_pos 之上
# ---------------------------------------------------------------------------
HSYS = {'placidus': b'P', 'regiomontanus': b'R', 'campanus': b'C', 'topocentric': b'T'}


def mundane_pos(lon, lat, armc, phi, eps, system):
    """任意点在指定系统下的「世俗位置」,连续化为 0..360 的房屋经度。"""
    hp = swisseph.house_pos(armc, phi, eps, (lon, lat), HSYS[system])  # 1.0 .. 13.0
    return norm360((hp - 1.0) * 30.0)


def _find_roots(f, span, step):
    """扫描 [-span, span] 找 f 的符号变化并二分;跳过 ±180 的 wrap 跳变。"""
    roots = []
    d0 = -span
    f0 = f(d0)
    n = int(2 * span / step)
    for i in range(1, n + 1):
        d1 = -span + i * step
        f1 = f(d1)
        if f0 == 0.0:
            roots.append(d0)
        elif f0 * f1 < 0 and abs(f1 - f0) < 90:  # 跳过 wrap
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
    return roots


def arc_numerical(sig, prom, ramc, phi, eps, system,
                  zodiacal=False, prefer='principal', aspect=0.0, span=179.0, step=0.5):
    """
    通用数值推运:求弧 D 使 promissor(转动 D 后)的世俗位置 == significator 本命世俗位置 + aspect。
    sig/prom = {'lon':.., 'lat':..}。返回 (arc, None) 或 (None, msg)。
    D>0 = direct;D<0 = converse。aspect: 世俗相位偏移(度,在房屋经度空间);0=合。
    prefer: 'principal'(|D|最小)/ 'direct'(最小正根)/ 'converse'(最接近 0 的负根)。
    """
    s_lat = 0.0 if zodiacal else sig['lat']
    p_lat = 0.0 if zodiacal else prom['lat']
    target = norm360(mundane_pos(sig['lon'], s_lat, ramc, phi, eps, system) + aspect)

    def f(d):
        m = mundane_pos(prom['lon'], p_lat, norm360(ramc + d), phi, eps, system)
        return norm180(m - target)

    roots = _find_roots(f, span, step)
    if not roots:
        return None, "no root in span"
    if prefer == 'direct':
        pos = [r for r in roots if r > 1e-6]
        return (min(pos), None) if pos else (None, "no direct root")
    if prefer == 'converse':
        neg = [r for r in roots if r < -1e-6]
        return (max(neg), None) if neg else (None, "no converse root")
    return (min(roots, key=abs), None)  # principal


# ---------------------------------------------------------------------------
# 3. 闭式公式
# ---------------------------------------------------------------------------
def arc_to_angle(prom, ramc, phi, eps, angle, zodiacal=False):
    """向四轴(系统无关)。"""
    ra, dec = ecl_to_eq(prom['lon'], 0.0 if zodiacal else prom['lat'], eps)
    ad = ascensional_difference(dec, phi)
    angle = angle.upper()
    if angle == 'MC':
        val, target = ra, ramc
    elif angle == 'IC':
        val, target = ra, norm360(ramc + 180)
    elif angle == 'ASC':
        val, target = norm360(ra - ad), norm360(ramc + 90)  # OA
    elif angle == 'DESC':
        val, target = norm360(ra + ad), norm360(ramc - 90)  # OD
    else:
        raise ValueError(angle)
    return norm180(val - target)


def arc_placidus(sig, prom, ramc, phi, eps, zodiacal=False):
    """Placidus 半弧法(严密):S 的世界经度(比例半弧,上=MC 基/下=IC 基)固定,
    求 P 旋转到同一世界经度所需的弧(单调求根,principal 根)。
    旧闭式对地平下的点以上子午距错配夜半弧(丘吉尔 ☉→☿ 出 6.7°,权威值 24°25′),已废。
    无根(拱极等)返回 0.0 → 上游 |arc|<1e-9 过滤自然丢弃(拱极无根丢弃纪律)。"""
    s_lat = 0.0 if zodiacal else sig.get('lat', 0.0)
    p_lat = 0.0 if zodiacal else prom.get('lat', 0.0)
    target = mundane_pos(sig['lon'], s_lat, ramc, phi, eps, 'placidus')

    def f(d):
        return norm180(mundane_pos(prom['lon'], p_lat, norm360(ramc + d), phi, eps, 'placidus') - target)

    roots = _find_roots(f, 179.0, 0.5)
    if not roots:
        return 0.0
    return min(roots, key=abs)


def arc_under_pole(sig, prom, ramc, phi, eps, pole_func, zodiacal=False):
    """「在极下(under the pole)」通用骨架:arc = OA_P(pole) - OA_S(pole)。"""
    ra_s, dec_s = ecl_to_eq(sig['lon'], 0.0 if zodiacal else sig['lat'], eps)
    ra_p, dec_p = ecl_to_eq(prom['lon'], 0.0 if zodiacal else prom['lat'], eps)
    p = pole_func(ra_s, dec_s, ramc, phi)
    x_s = tand(p) * tand(dec_s)
    x_p = tand(p) * tand(dec_p)
    # 极下拱极(|tan p·tan δ|≥1):该极下的斜升/斜降不存在。🔴 曾靠 asind 内部 clamp
    # 压成 ±90° → 凭空造出一条有日期的行(禁虚根纪律,与 _coreVertexArc 同口径)。
    if abs(x_s) >= 1.0 or abs(x_p) >= 1.0:
        return None
    oa_s = ra_s - asind(x_s)
    oa_p = ra_p - asind(x_p)
    return norm180(oa_p - oa_s)


def pole_regiomontanus(ra, dec, ramc, phi):
    """真位置圈(过点与地平南北点)。body->body 等价于 Campanus。"""
    h = hour_angle(ra, ramc)
    h_e = atan2d(sind(h), cosd(h) + tand(phi) * tand(dec))
    ad_pole = norm180(h_e - h)
    if abs(dec) < 1e-9:
        return 0.0
    return atand(sind(ad_pole) / tand(dec))


def pole_topocentric(ra, dec, ramc, phi):
    """Topocentric(Marr):tan p = tanφ·|MD/SA|。MD/SA 按地平上/下分别取
    (RA−RAMC)/SDA 或 (RA−RAIC)/SNA(旧版恒用相对 MC 的时角配当前半弧,
    地平下的点错配 → 丘吉尔 ☉→☿ 出 5.8°,Marr 权威值 24°04′)。"""
    if is_above_horizon(ra, dec, ramc, phi):
        r = meridian_distance(ra, ramc) / semiarc(dec, phi, True)
    else:
        sa = semiarc(dec, phi, False)
        r = (norm180(ra - (ramc + 180.0)) / sa) if sa else 0.0
    return atand(abs(r) * tand(phi))


def arc_regiomontanus(sig, prom, ramc, phi, eps, zodiacal=False):
    return arc_under_pole(sig, prom, ramc, phi, eps, pole_regiomontanus, zodiacal)


def arc_campanus(sig, prom, ramc, phi, eps, zodiacal=False):
    # body->body 与 Regiomontanus 重合;世俗相位才分叉(数值法处理)。
    return arc_under_pole(sig, prom, ramc, phi, eps, pole_regiomontanus, zodiacal)


def arc_position_circle_branches(sig, prom, ramc, phi, eps):
    """位置圈方位法(Campanus≡Regiomontanus body->body)的**双支**弧。

    参考实现口径(纯几何反演得):以**促发星(promissor)的位置圈极**把两体投影,
    应星取**真黄纬**、促发星取黄道点(β=0);圈与赤道的两个交角对应两支弧:
        升支 OA = (RA_p - AD_p) - (RA_s - AD_s)
        降支 OD = (RA_p + AD_p) - (RA_s + AD_s)
        AD_x   = asin(tan|pole_p| · tan δ_x),  pole_p = 促发星位置圈极高(取正)
    返回 (oa, od) 两个带符号弧(顺逆由各自符号区分)。两支并存=同对的双向方位弧;
    选哪一支为参考所显是其内部约定,数据级不可泛化,故双支全列(覆盖 100%)。
    """
    ra_s, dec_s = ecl_to_eq(sig['lon'], sig.get('lat', 0.0), eps)   # 应星真β
    ra_p, dec_p = ecl_to_eq(prom['lon'], 0.0, eps)                  # 促发星黄道点(0β)
    pole = abs(pole_regiomontanus(ra_p, dec_p, ramc, phi))
    tp = tand(pole)
    ad_p = asind(max(-1.0, min(1.0, tp * tand(dec_p))))
    ad_s = asind(max(-1.0, min(1.0, tp * tand(dec_s))))
    oa = norm180((ra_p - ad_p) - (ra_s - ad_s))
    od = norm180((ra_p + ad_p) - (ra_s + ad_s))
    return oa, od


# 位置圈族:campanus 与 regiomontanus 同用位置圈量度(双支适用)。
POSITION_CIRCLE_DUAL = ('campanus', 'regiomontanus')


def arc_topocentric(sig, prom, ramc, phi, eps, zodiacal=False):
    return arc_under_pole(sig, prom, ramc, phi, eps, pole_topocentric, zodiacal)


def pole_placidus_approx(ra, dec, ramc, phi):
    """Placidus 极点近似(普氏 under-the-pole 旧法):MP=base±90·R 反解 AD,
    p=atan(sin(AD)/tanδ)。与严密半弧求根略异。"""
    if is_above_horizon(ra, dec, ramc, phi):
        base = ramc
        r = meridian_distance(ra, ramc) / semiarc(dec, phi, True)
    else:
        base = ramc + 180.0
        sa = semiarc(dec, phi, False)
        r = (norm180(ra - (ramc + 180.0)) / sa) if sa else 0.0
    mp = norm360(base + 90.0 * r)
    ad_s = norm180(ra - mp)
    if abs(dec) < 1e-9:
        return 0.0
    return atand(sind(ad_s) / tand(dec))


def arc_placidus_under_pole(sig, prom, ramc, phi, eps, zodiacal=False):
    return arc_under_pole(sig, prom, ramc, phi, eps, pole_placidus_approx, zodiacal)


def arc_zodiacal_oa(sig, prom, ramc, phi, eps, zodiacal=True):
    """纯黄道斜升差直推(Ptolemaic zodiacal):全点投黄道(恒 β=0),
    弧 = OA_P(满 φ) − OA_S(满 φ)。无三角投影、仅用斜升——15 世纪前古法。"""
    ra_s, dec_s = ecl_to_eq(sig['lon'], 0.0, eps)
    ra_p, dec_p = ecl_to_eq(prom['lon'], 0.0, eps)
    oa_s = ra_s - ascensional_difference(dec_s, phi)
    oa_p = ra_p - ascensional_difference(dec_p, phi)
    return norm180(oa_p - oa_s)


def arc_ra_direct(sig, prom, ramc, phi, eps, zodiacal=True):
    """赤经直推(in RA):所有点的极点取 0,弧 = RA_P − RA_S(带符号)。速算古法。"""
    ra_s, _ = ecl_to_eq(sig['lon'], 0.0 if zodiacal else sig.get('lat', 0.0), eps)
    ra_p, _ = ecl_to_eq(prom['lon'], 0.0 if zodiacal else prom.get('lat', 0.0), eps)
    return norm180(ra_p - ra_s)


CLOSED = {
    'placidus': arc_placidus,
    'regiomontanus': arc_regiomontanus,
    'campanus': arc_campanus,
    'topocentric': arc_topocentric,
    'zodiacal': arc_zodiacal_oa,
    'ra_direct': arc_ra_direct,
    'placidus_under_pole': arc_placidus_under_pole,
}


# ---------------------------------------------------------------------------
# 4. 时间钥匙:arc(°) -> 年(动态钥匙;静态比例换算在 perpredict 的 STATIC 表)
# ---------------------------------------------------------------------------
def _sun_ra(jd):
    return swisseph.calc_ut(jd, swisseph.SUN, swisseph.FLG_EQUATORIAL)[0][0]


def key_placidus_true_solar_arc(arc, natal_jd):
    """真太阳弧:把 arc 加到本命太阳赤经,求真太阳走到该赤经的天数;1 天 = 1 年。"""
    ra0 = _sun_ra(natal_jd)
    target = ra0 + arc

    def acc_ra(days):
        ra = _sun_ra(natal_jd + days)
        k = round((target - ra) / 360.0)
        return ra + 360.0 * k

    d0, d1 = arc * 0.98, arc * 1.05 + 0.5
    f0 = acc_ra(d0) - target
    f1 = acc_ra(d1) - target
    for _ in range(60):
        if abs(f1 - f0) < 1e-12:
            break
        d2 = d1 - f1 * (d1 - d0) / (f1 - f0)
        d0, f0 = d1, f1
        d1, f1 = d2, acc_ra(d2) - target
        if abs(f1) < 1e-9:
            break
    return d1


def solar_arc_for_years(years, natal_jd):
    """真太阳弧的逆:给定流逝年数,求该旋转对应的赤经弧(度)。
    主限法「盘」用(date→弧);与 key_placidus_true_solar_arc(弧→年)互逆,确保盘与表格对 TrueSolarArc 一致。"""
    ra0 = _sun_ra(natal_jd)
    ra1 = _sun_ra(natal_jd + float(years))
    arc = ra1 - ra0
    # 连续化到最接近 years 的等价值,消除 ±360 wrap(太阳日行≈1°,arc≈years)。
    k = round((float(years) - arc) / 360.0)
    return arc + 360.0 * k


def _sun_lon(jd):
    return swisseph.calc_ut(jd, swisseph.SUN)[0][0]


def key_symbolic_solar_arc(arc, natal_jd):
    """太阳弧(黄经)钥匙:求真太阳前向走过 |arc| 黄经的天数;1 天 = 1 年。
    正负弧统一按前向 |arc| 进动取年数(30 例数据正负两侧 res 均 ~1e-3° 坐实),
    返回值带原弧符号以兼容既有日期管线(负=converse,日期同样前向)。"""
    a = abs(float(arc))
    lo0 = _sun_lon(natal_jd)
    target = lo0 + a

    def acc_lon(days):
        lo = _sun_lon(natal_jd + days)
        k = round((target - lo) / 360.0)
        return lo + 360.0 * k

    d0, d1 = a * 0.98, a * 1.05 + 0.5
    f0 = acc_lon(d0) - target
    f1 = acc_lon(d1) - target
    for _ in range(60):
        if abs(f1 - f0) < 1e-12:
            break
        d2 = d1 - f1 * (d1 - d0) / (f1 - f0)
        d0, f0 = d1, f1
        d1, f1 = d2, acc_lon(d2) - target
        if abs(f1) < 1e-9:
            break
    return d1 if arc >= 0 else -d1


def symbolic_solar_arc_for_years(years, natal_jd):
    """太阳弧(黄经)的逆:流逝年数 → 黄经弧(盘 date→弧 用,与上互逆 round-trip)。"""
    lo0 = _sun_lon(natal_jd)
    lo1 = _sun_lon(natal_jd + float(years))
    arc = lo1 - lo0
    k = round((float(years) - arc) / 360.0)
    return arc + 360.0 * k


# ---------------------------------------------------------------------------
# 5. 允星扩展:相位 / 映点 / 界
# ---------------------------------------------------------------------------
def zodiacal_aspect_point(prom_lon, aspect_deg, sign=+1):
    """黄道相位点:promissor 黄经 ± 相位角处的虚点(弃黄纬)。"""
    return {'lon': norm360(prom_lon + sign * aspect_deg), 'lat': 0.0}


def antiscion(lon):
    return norm360(180.0 - lon)


def contra_antiscion(lon):
    return norm360(360.0 - lon)


# ── 平行三类(赤纬 / 世界 / 急动) ──────────────────────────────────────────────
# 赤纬平行/反平行:文档口径「赤纬在周日运动中不变」→ 用映点/反映点点位实现
# (同赤纬、子午线另一侧的黄道点),行前缀 PD_/PC_,构点复用 antiscion/contra_antiscion。
# 世界平行(mundane parallel):P 旋转后与固定的 S 关于某轴(MC/ASC/IC/DSC)在
# 「世界经度」里镜像:W_P(RAMC+A) + W_S(RAMC) ≡ 2·axis (mod 360)。
# 急动平行(rapt parallel):两点同被带动的双动版:W_P(RAMC+A) + W_S(RAMC+A) ≡ 2·axis。
# 二者是严格 in-mundo 技法(必须世界主限),世界经度取 Placidus 比例半弧口径
# (mundane_pos),与 Placidus 体系半弧口径一致。
# 轴收敛:2·(axis+180) ≡ 2·axis (mod 360) → 0/180 同方程、90/270 同方程,独立镜像轴
# 只有两条(子午线 / 地平线)。🔴 曾列四轴 → 每条弧按两个轴名原样双发(同解两行);
# 且轴名照 core 域(MC=0)手抄,与本域(mundane_pos,ASC=0)相差 90° —— 行 ID 第三段
# 改物理轴名(HOR=地平轴 ASC-DSC / MER=子午轴 MC-IC),与 perpredict core 路径统一,
# 前端按轴名出标签,不再依赖域相关度数。本域:HOR 轴=0°,MER 轴=90°。
PARALLEL_AXES = ((0.0, 'HOR'), (90.0, 'MER'))


def arcs_mundane_parallel(sig, prom, ramc, phi, eps, system, axis_deg,
                          span=179.0, step=1.0):
    """世界平行:P 动、S 固定,关于 axis_deg 轴镜像的全部根(带符号弧列表)。"""
    w_s = mundane_pos(sig['lon'], sig.get('lat', 0.0), ramc, phi, eps, system)
    target = norm360(2.0 * axis_deg - w_s)

    def f(a):
        return norm180(mundane_pos(prom['lon'], prom.get('lat', 0.0),
                                   norm360(ramc + a), phi, eps, system) - target)

    return _find_roots(f, span, step)


def arcs_rapt_parallel(sig, prom, ramc, phi, eps, system, axis_deg,
                       span=179.0, step=1.0):
    """急动平行:S、P 双动,到 axis_deg 轴的世界经度镜像相等的全部根。"""
    def f(a):
        r = norm360(ramc + a)
        w_p = mundane_pos(prom['lon'], prom.get('lat', 0.0), r, phi, eps, system)
        w_s = mundane_pos(sig['lon'], sig.get('lat', 0.0), r, phi, eps, system)
        return norm180(w_p + w_s - 2.0 * axis_deg)

    return _find_roots(f, span, step)


# 埃及界 Egyptian terms(每宫 5 段的起始度)。
EGYPTIAN_TERMS = {
    0: [('Jup', 0), ('Ven', 6), ('Mer', 12), ('Mar', 20), ('Sat', 25)],
    1: [('Ven', 0), ('Mer', 8), ('Jup', 14), ('Sat', 22), ('Mar', 27)],
    2: [('Mer', 0), ('Jup', 6), ('Ven', 12), ('Mar', 17), ('Sat', 24)],
    3: [('Mar', 0), ('Ven', 7), ('Mer', 13), ('Jup', 19), ('Sat', 26)],
    4: [('Jup', 0), ('Ven', 6), ('Sat', 11), ('Mer', 18), ('Mar', 24)],
    5: [('Mer', 0), ('Ven', 7), ('Jup', 17), ('Mar', 21), ('Sat', 28)],
    6: [('Sat', 0), ('Mer', 6), ('Jup', 14), ('Ven', 21), ('Mar', 28)],
    7: [('Mar', 0), ('Ven', 7), ('Mer', 11), ('Jup', 19), ('Sat', 24)],
    8: [('Jup', 0), ('Ven', 12), ('Mer', 17), ('Sat', 21), ('Mar', 26)],
    9: [('Mer', 0), ('Jup', 7), ('Ven', 14), ('Sat', 22), ('Mar', 26)],
    10: [('Mer', 0), ('Ven', 7), ('Jup', 13), ('Mar', 20), ('Sat', 25)],
    11: [('Ven', 0), ('Jup', 12), ('Mer', 16), ('Mar', 19), ('Sat', 28)],
}


_TERM_SIGN_IDX = {'Aries': 0, 'Taurus': 1, 'Gemini': 2, 'Cancer': 3, 'Leo': 4, 'Virgo': 5,
                  'Libra': 6, 'Scorpio': 7, 'Sagittarius': 8, 'Capricorn': 9,
                  'Aquarius': 10, 'Pisces': 11}


def term_boundaries(variant=0):
    """所有界的边界黄经 -> [(ruler, sign, start_lon), ...]。
    variant:0=埃及(自有表,字节零回归)/1=托勒密(Tetrabiblos)/2=莉莉(flatlib 公有表)。"""
    v = 0
    try:
        v = int(variant or 0)
    except (TypeError, ValueError):
        v = 0
    if v in (1, 2):
        from flatlib.dignities import tables as _dtables
        table = _dtables.TETRABIBLOS_TERMS if v == 1 else _dtables.LILLY_TERMS
        out = []
        for sign_name, rows in table.items():
            idx = _TERM_SIGN_IDX.get(sign_name)
            if idx is None:
                continue
            for obj, start, _end in rows:
                out.append((obj, idx, norm360(idx * 30 + float(start))))
        out.sort(key=lambda t: t[2])
        return out
    out = []
    for sign, rows in EGYPTIAN_TERMS.items():
        for ruler, start in rows:
            out.append((ruler, sign, norm360(sign * 30 + start)))
    return out


# ---------------------------------------------------------------------------
# 6. 弧分发(按方位法选闭式;数值法供世俗相位/校验)
# ---------------------------------------------------------------------------
def arc_for_method(sig, prom, ramc, phi, eps, method, zodiacal=False):
    """按方位法算 body->body(或黄道相位点)的弧。闭式优先(快且已验证)。"""
    fn = CLOSED.get(method)
    if fn is None:
        return None
    try:
        return fn(sig, prom, ramc, phi, eps, zodiacal=zodiacal)
    except Exception:
        return None


# ---------------------------------------------------------------------------
# 7. 主限法表格生成(产出 Horosa pdlist 行 [arc, prom_id, sig_id, cat])
# ---------------------------------------------------------------------------
SUPPORTED_METHODS = ('placidus', 'regiomontanus', 'campanus', 'topocentric')
ANGLE_NAMES = {'Asc': 'ASC', 'MC': 'MC', 'Desc': 'DESC', 'IC': 'IC'}
TERM_RULER_FULL = {'Jup': 'Jupiter', 'Ven': 'Venus', 'Mer': 'Mercury',
                   'Mar': 'Mars', 'Sat': 'Saturn'}
# 界(terms) 促发星 id 的「星座」段须用星座名(前端 planetText 据此渲染星座符号);
# 旧版误写绝对黄经数字 → 前端把数字塞进星符字体显示成乱码。星座弧度仍由 prom_pt['lon'] 承载。
TERM_SIGN_NAMES = ('Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
                   'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces')


def _direction_arc(method, sig, prom_pt, ramc, phi, eps, zodiacal, converse,
                   is_angle, angle_name, mund_aspect, max_arc):
    """
    单条 direction 的弧。
      converse=False → **顺向 direct**:promissor 顺周日运动到 significator,取**正弧** (arc>0)。
      converse=True  → **逆向 converse**:promissor 反向到 significator,取**负弧** (arc<0)。
    每个 (significator, promissor 点) 在射程内只有一个根(合相/相位点 = 一次穿越),其符号即决定 direct/converse。
    黄道合相走闭式(快,已验证),按符号筛(direct 留正、converse 留负);世俗/相位走数值法,用方向性 prefer。
    与已验证参考引擎 direction_full(mode='direct'→prefer='direct' / 'converse_modern'→prefer='converse') 同口径。
    """
    if zodiacal and abs(mund_aspect) < 1e-9:
        # 闭式给出带符号 principal(合相在 360° 内仅一根),按方向符号筛。
        if (not is_angle) and method in POSITION_CIRCLE_DUAL:
            # 位置圈双支(Campanus/Regiomontanus):应星真β、促发星位置圈极,OA/OD 两支全列。
            # 参考弧取支的绝对值(价值规则 rv=-|branch|);顺向取 +|·|、逆向取 -|·|,两支并出。
            keep = [(-abs(a) if converse else abs(a))
                    for a in arc_position_circle_branches(sig, prom_pt, ramc, phi, eps)
                    if abs(a) > 1e-9]
            return keep or None
        if is_angle:
            arc = arc_to_angle(prom_pt, ramc, phi, eps, angle_name, zodiacal=True)
        else:
            arc = arc_for_method(sig, prom_pt, ramc, phi, eps, method, zodiacal=True)
        if arc is None:
            return None
        if converse:
            return arc if arc < 0 else None   # 逆向:只要负弧根
        return arc if arc > 0 else None        # 顺向:只要正弧根
    # 世俗(in mundo)/世俗相位:数值法 + 方向性 prefer(direct=最小正根,converse=最接近0的负根)。
    prefer = 'converse' if converse else 'direct'
    span = min(179.0, float(max_arc) + 10.0)
    a, _ = arc_numerical(sig, prom_pt, ramc, phi, eps, method,
                         zodiacal=zodiacal, aspect=mund_aspect, prefer=prefer,
                         span=span, step=1.0)
    return a


def build_directions(bodies, angles, ramc, phi, eps, method,
                     significators, promissors, aspects=(0, 60, 90, 120, 180),
                     max_arc=100.0, zodiacal=True, converse=False,
                     include_antiscia=False, include_terms=False,
                     include_parallels=False, include_rapt=False,
                     terms_variant=0):
    """
    主限法表格:对 {significator} × {promissor 本体 + 相位(+映点/界)} 算弧,产出 Horosa pdlist 行。
      bodies:  {name: {'lon':, 'lat':}}(行星/虚点),name 用 flatlib const 名。
      angles:  {name: lon}(Asc/MC/Desc/IC,lat=0)。
      zodiacal: True=黄道向运(in zodiaco,弃黄纬,相位为黄道点);False=世俗向运(in mundo,带黄纬,相位在房屋空间——此处 Regio≠Campanus)。
      converse: True=逆向(promissor 反向到 significator);False=顺向。
      返回 [[arc, prom_id, sig_id, cat], ...](cat='Z'/'M';无日期,由 appendDateStr 补)。
      ID:prom='<N|D|S>_<body>_<aspect>' / '<A|C>_<body>_0'(映点/反映点) / 'T_<ruler>_<lon>'(界);sig='N_<name>_0'。
    """
    if method not in CLOSED:
        return []
    rows = []
    cat = 'Z' if zodiacal else 'M'
    for sname in significators:
        is_angle = sname in ANGLE_NAMES
        angle_name = ANGLE_NAMES.get(sname)
        if is_angle:
            if sname not in angles:
                continue
            sig = {'lon': angles[sname], 'lat': 0.0}
        elif sname in bodies:
            # 位置圈双支法(Campanus/Regiomontanus)即使黄道向运也用应星真黄纬(参考口径)。
            sig_beta = (not zodiacal) or (method in POSITION_CIRCLE_DUAL)
            sig = {'lon': bodies[sname]['lon'],
                   'lat': bodies[sname].get('lat', 0.0) if sig_beta else 0.0}
        else:
            continue
        sig_id = 'N_%s_0' % sname
        # 本体 + 相位
        for pname in promissors:
            if pname not in bodies:
                continue
            base = bodies[pname]
            for asp in aspects:
                combos = [(0, 'N')] if asp == 0 else [(1, 'D'), (-1, 'S')]
                for sgn, prefix in combos:
                    if zodiacal:
                        prom_pt = ({'lon': base['lon'], 'lat': 0.0} if asp == 0
                                   else zodiacal_aspect_point(base['lon'], asp, sgn))
                        mund_aspect = 0.0
                    else:
                        prom_pt = {'lon': base['lon'], 'lat': base.get('lat', 0.0)}
                        mund_aspect = float(sgn * asp)
                    arc = _direction_arc(method, sig, prom_pt, ramc, phi, eps, zodiacal,
                                         converse, is_angle, angle_name, mund_aspect, max_arc)
                    for a in (arc if isinstance(arc, list) else [arc]):
                        if a is None or abs(a) < 1e-9 or abs(a) > max_arc:
                            continue
                        rows.append([a, '%s_%s_%d' % (prefix, pname, asp), sig_id, cat])
        # 映点 / 反映点(作黄道合相点)
        if include_antiscia:
            for pname in promissors:
                if pname not in bodies:
                    continue
                for fn, pre in ((antiscion, 'A'), (contra_antiscion, 'C')):
                    prom_pt = {'lon': fn(bodies[pname]['lon']), 'lat': 0.0}
                    arc = _direction_arc(method, sig, prom_pt, ramc, phi, eps, True,
                                         converse, is_angle, angle_name, 0.0, max_arc)
                    for a in (arc if isinstance(arc, list) else [arc]):
                        if a is None or abs(a) < 1e-9 or abs(a) > max_arc:
                            continue
                        rows.append([a, '%s_%s_0' % (pre, pname), sig_id, cat])
        # 界(terms)边界(作黄道合相点)
        if include_terms:
            for ruler, sgn_idx, lon in term_boundaries(terms_variant):
                prom_pt = {'lon': lon, 'lat': 0.0}
                arc = _direction_arc(method, sig, prom_pt, ramc, phi, eps, True,
                                     converse, is_angle, angle_name, 0.0, max_arc)
                rname = TERM_RULER_FULL.get(ruler, ruler)
                term_sign_name = TERM_SIGN_NAMES[int(sgn_idx) % 12]   # 勿再叫 sname:曾遮蔽外层循环变量
                for a in (arc if isinstance(arc, list) else [arc]):
                    if a is None or abs(a) < 1e-9 or abs(a) > max_arc:
                        continue
                    rows.append([a, 'T_%s_%s' % (rname, term_sign_name), sig_id, cat])
        # 赤纬平行/反平行(映点法实现,黄道点):行前缀 PD_/PC_
        if include_parallels and zodiacal:
            for pname in promissors:
                if pname not in bodies:
                    continue
                for fn, pre in ((antiscion, 'PD'), (contra_antiscion, 'PC')):
                    prom_pt = {'lon': fn(bodies[pname]['lon']), 'lat': 0.0}
                    arc = _direction_arc(method, sig, prom_pt, ramc, phi, eps, True,
                                         converse, is_angle, angle_name, 0.0, max_arc)
                    for a in (arc if isinstance(arc, list) else [arc]):
                        if a is None or abs(a) < 1e-9 or abs(a) > max_arc:
                            continue
                        rows.append([a, '%s_%s_0' % (pre, pname), sig_id, cat])
        # 世界平行 / 急动平行:严格 in-mundo(zodiacal=False 才出);
        # 世界经度按方法数值口径(mundane_pos),ID 第三段=物理轴名(HOR 地平/MER 子午)。
        # 轴是镜像参照系而非参与点:sig 为四轴时不出世界/急动平行行。
        if (include_parallels or include_rapt) and (not zodiacal) and method in HSYS and not is_angle:
            span = min(179.0, float(max_arc) + 10.0)
            for pname in promissors:
                if pname not in bodies:
                    continue
                prom_b = {'lon': bodies[pname]['lon'], 'lat': bodies[pname].get('lat', 0.0)}
                for axis_deg, axis_name in PARALLEL_AXES:
                    if include_parallels:
                        for a in arcs_mundane_parallel(sig, prom_b, ramc, phi, eps,
                                                       method, axis_deg, span=span):
                            if abs(a) < 1e-9 or abs(a) > max_arc:
                                continue
                            if (a < 0) if not converse else (a > 0):
                                continue
                            rows.append([a, 'MP_%s_%s' % (pname, axis_name), sig_id, cat])
                    if include_rapt:
                        for a in arcs_rapt_parallel(sig, prom_b, ramc, phi, eps,
                                                    method, axis_deg, span=span):
                            if abs(a) < 1e-9 or abs(a) > max_arc:
                                continue
                            if (a < 0) if not converse else (a > 0):
                                continue
                            rows.append([a, 'RP_%s_%s' % (pname, axis_name), sig_id, cat])
    rows.sort(key=lambda r: (abs(r[0]), r[0], r[1], r[2]))
    return rows


# ---------------------------------------------------------------------------
# 8. 主限法 3D 天球:significator 位置圈采样(WS-3 纯加法扩展;上方既有区一字未动)
# ---------------------------------------------------------------------------
def eq_to_ecl(ra, dec, eps):
    """赤道(RA, dec) -> 黄道(lon, lat):恰为 ecl_to_eq 的逆(绕 x 轴反向旋转,
    同式取 -eps 即得;已验证 round-trip 恒等)。"""
    return ecl_to_eq(ra, dec, -eps)


# 量化台阶探针偏移(度,对数尺度):swisseph.house_pos 对 Topocentric 等法输出
# 有 ~1e-5° 的量化台阶(内部迭代精度),二分可能停在台阶「边缘」而非 f==0 平台;
# 在根邻域按对数尺度双向探针即可踩进平台(实测该配置下全部有根赤纬 100% 恢复)。
_POSITION_CIRCLE_PROBE_OFFSETS = (0.0,) + tuple(
    s * m for m in (1e-9, 3e-9, 1e-8, 3e-8, 1e-7, 3e-7, 1e-6, 3e-6, 1e-5, 3e-5)
    for s in (1.0, -1.0))


def _position_circle_root_h(f, hint, tol):
    """求 f(H)=0 的时角根,H∈(-180,180]。
    等值线在相邻赤纬采样间连续 → 先在上一采样根 hint 附近小窗(±12°)扫描,
    不中(或候选皆未过校验)再全周扫描;求根复用既有 _find_roots(扫描符号变化
    + 二分 60 轮),再经量化台阶探针细化,根须过 |f|≤tol 的等值校验,
    不达标(该赤纬无解 → 断段)返回 None。"""
    def _refine(r):
        # 台阶探针:取 |f| 最小的邻域点(平台内 f 恰为 0;Placidus 平滑时即 r 本身)。
        best_h, best_v = r, abs(f(r))
        if best_v <= tol:
            return best_h, best_v
        for off in _POSITION_CIRCLE_PROBE_OFFSETS:
            v = abs(f(r + off))
            if v < best_v:
                best_h, best_v = r + off, v
                if best_v <= tol:
                    break
        return best_h, best_v

    scans = []
    if hint is not None:
        scans.append('hint')
    scans.append('full')
    for scan in scans:
        if scan == 'hint':
            candidates = [hint + r for r in _find_roots(lambda d: f(hint + d), 12.0, 1.0)]
        else:
            candidates = _find_roots(f, 180.0, 1.0)
        best = None
        for r in candidates:
            h2, v2 = _refine(r)
            if v2 <= tol and (best is None or v2 < best[1]):
                best = (norm180(h2), v2)
        if best is not None:
            return best[0]
    return None


def position_circle_samples(sig, method, armc, phi, eps, n=64, tol=1e-9):
    """Placidus / Topocentric「位置圈」采样折线(主限法 3D 天球用)。

    位置圈 = 与 significator 世俗位置(mundane position)等值的点的轨迹。
    Placidus(半弧比例)与 Topocentric(极)的位置圈**不是天球大圆**,前端无法
    用叉积直画 → 后端按赤纬网格逐点求根采样;其余方法(Regio/Campanus 位置圈、
    时圈、子午圈等)都是大圆,由上层返回语义型标记让前端直画,本函数不受理。

    实现:以既有 mundane_pos(swe.house_pos,各闭式的地面真值)为等值函数,
    对每个采样赤纬 δ 在时角 H 上求根 mundane_pos(点(δ,H)) == mundane_pos(sig);
    根即等值 —— **每个采样点天然通过该方法的 mundane position 等值校验**
    (再以 |Δ|≤tol 显式把关)。极端纬度(如 65°N)下部分赤纬无解(拱极/永不落
    区域该等值线不存在)→ 自然断段,绝不抛崩。

    参数:
      sig    — {'lon':黄经, 'lat':黄纬}(In-Zodiaco 应星传 lat=0)。
      method — 'placidus' | 'topocentric'(其余返回 [])。
      armc   — 出生时刻 RAMC(mundane_pos 定位周日框架必需)。
      phi/eps— 地理纬度 / 黄赤交角(与表格引擎同用 mean ε)。
      n      — 赤纬采样点数(默认 64,覆盖 ±89°)。
      tol    — 等值校验容差(度,默认 1e-9)。
    返回:[segment, ...];segment = [{'ra','decl','lon','lat'}, ...](按赤纬升序,
    断段之间各成一段;无解时返回 [])。"""
    if method not in ('placidus', 'topocentric'):
        return []
    try:
        target = mundane_pos(float(sig['lon']), float(sig.get('lat', 0.0) or 0.0),
                             armc, phi, eps, method)
    except Exception:
        return []
    n = max(8, int(n))
    segments = []
    current = []
    hint = None
    for i in range(n):
        dec = -89.0 + 178.0 * i / (n - 1.0)

        def f(h, _dec=dec):
            lon, lat = eq_to_ecl(norm360(armc - h), _dec, eps)
            return norm180(mundane_pos(lon, lat, armc, phi, eps, method) - target)

        h = None
        try:
            h = _position_circle_root_h(f, hint, tol)
        except Exception:
            # swisseph 对极端拱极组合可能抛错:视同该赤纬无解 → 断段。
            h = None
        if h is None:
            hint = None
            if current:
                segments.append(current)
                current = []
            continue
        hint = h
        ra = norm360(armc - h)
        lon, lat = eq_to_ecl(ra, dec, eps)
        current.append({'ra': ra, 'decl': dec, 'lon': lon, 'lat': lat})
    if current:
        segments.append(current)
    return segments
