# -*- coding: utf-8 -*-
"""主限法 · 半弧法(Placidus)、极下法(Regiomontanus / Campanus)与黄极圈法(Morinus)的本体弧。

口径:传统逆向 —— 应星(带真黄纬)被周日运动带到迫星相位点(黄纬 0)的位置。
- 极下法:位置圈 = 过地平南北点与迫星相位点的大圆;应星沿周日圈转到迫星点所在的那个半圆上。
  Campanus 与 Regiomontanus 的位置圈同为过地平南北点的大圆,本体弧相同。
- 半弧法:应星沿自身周日圈走到迫星相位点的比例位置(比例见下)。
- 黄极圈法:位置圈是过黄极与迫星相位点的大圆(即该点的黄经圈,黄道取出生时刻);应星取黄经上的点(黄纬 0)
  沿自身赤纬圈走到这个圆上。圆不经过地平与子午圈,弧与 RAMC、地理纬度都无关。

子午线判定:一律用真实时角(RA − RAMC 取最短角距,东为正),与赤经 0° 落在哪里无关。
  半弧法:地平之上从 MC 量、除以昼半弧,地平之下从 IC 量、除以夜半弧(地平上的点离 IC 更近时也照此)。
  极下法:位置圈 = 过地平南北点与迫星点的大圆,取迫星点所在的那个半圆(北点 → 迫星点 → 南点);
  应星沿周日圈转到这个半圆上所需的赤经转角即弧,带正负(正 = 顺)。
  弧一律归一到 (−180°, 180°],更远的整圈由复发行扩展处理。

全部角度单位为度;RA / RAMC 取 [0, 360)。函数无副作用,无解(拱极等)返回 None。
"""
import math

_D = math.degrees
_R = math.radians


def _n180(x):
    return ((x + 180.0) % 360.0) - 180.0


def ascensional_difference(decl, lat):
    x = math.tan(_R(decl)) * math.tan(_R(lat))
    if abs(x) >= 1.0:
        return None
    return _D(math.asin(x))


def _vec(hour_angle, decl):
    """时角(西为正)/ 赤纬 → 单位向量:x 指子午圈上的赤道点、y 指西、z 指北天极。"""
    h, d = _R(hour_angle), _R(decl)
    return (math.cos(d) * math.cos(h), math.cos(d) * math.sin(h), math.sin(d))


def _cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def _dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def placidus_position(ra, decl, ramc, lat):
    """半弧象限比例位置 T ∈ [0,4)(MC=0 → DSC=1 → IC=2 → ASC=3,西向递增);拱极返回 None。"""
    ad = ascensional_difference(decl, lat)
    if ad is None:
        return None
    dsa, nsa = 90.0 + ad, 90.0 - ad
    md = _n180(ra - ramc)
    if abs(md) <= dsa:
        q = abs(md) / dsa
        return ((4.0 - q) % 4.0) if md > 0 else q
    q = (180.0 - abs(md)) / nsa
    return (2.0 + q) if md > 0 else (2.0 - q)


def placidus_position_ra(t, decl, ramc, lat):
    """比例位置 t(取模 4)按该点自身半弧换回赤经(未取模)。"""
    ad = ascensional_difference(decl, lat)
    if ad is None:
        return None
    dsa, nsa = 90.0 + ad, 90.0 - ad
    raic = ramc + 180.0
    t %= 4.0
    if t <= 1.0:
        return ramc - t * dsa
    if t <= 2.0:
        return raic + (2.0 - t) * nsa
    if t <= 3.0:
        return raic - (t - 2.0) * nsa
    return ramc + (4.0 - t) * dsa


def pole_circle_arc(ra_p, decl_p, ra_s, decl_s, ramc, lat):
    """极下法本体弧(Regiomontanus / Campanus)。迫星点 (ra_p, decl_p) 为黄纬 0 的相位点。"""
    north = (-math.sin(_R(lat)), 0.0, math.cos(_R(lat)))   # 地平北点
    q = _vec(ramc - ra_p, decl_p)
    m = _cross(north, q)
    nm = math.sqrt(_dot(m, m))
    if nm < 1e-12:
        return None
    m = (m[0] / nm, m[1] / nm, m[2] / nm)
    # m·S(H) = 0 ⇔ A·cosH + B·sinH = C
    cd, sd = math.cos(_R(decl_s)), math.sin(_R(decl_s))
    a_, b_, c_ = m[0] * cd, m[1] * cd, -m[2] * sd
    rr = math.hypot(a_, b_)
    if rr < 1e-12 or abs(c_) > rr:
        return None
    base = math.atan2(b_, a_)
    off = math.acos(max(-1.0, min(1.0, c_ / rr)))
    hs = ramc - ra_s
    best = None
    for h in (base + off, base - off):
        x = _vec(_D(h), decl_s)
        if _dot(_cross(north, x), m) > 0.0:        # 与迫星点同一个半圆
            arc = _n180(_D(h) - hs)
            if best is None or abs(arc) < abs(best):
                best = arc
    return best


def semiarc_arc(ra_p, decl_p, ra_s, decl_s, ramc, lat):
    """半弧法本体弧(Placidus):应星沿自身周日圈走到迫星点的比例位置。"""
    t = placidus_position(ra_p, decl_p, ramc, lat)
    if t is None:
        return None
    ra_t = placidus_position_ra(t, decl_s, ramc, lat)
    if ra_t is None:
        return None
    return _n180(ra_s - ra_t)


def ecliptic_pole_circle_arc(lon_p, ra_s, decl_s, eps):
    """黄极圈法本体弧(Morinus)。lon_p = 迫星相位点黄经;(ra_s, decl_s) = 应星黄经点(黄纬 0)的赤道坐标。
    黄经圈 λ=lon_p 上的点 (λ, β) 赤纬满足 sinδ = sinβ·cosε + cosβ·sinε·sinλ = A·sin(β + φ0),
    取与应星赤纬相等、靠近黄道的那一支交点,弧 = RA应 − RA交点。"""
    ce = math.cos(_R(eps))
    se = math.sin(_R(eps))
    sl = math.sin(_R(lon_p))
    amp = math.hypot(ce, se * sl)
    v = math.sin(_R(decl_s)) / amp
    if abs(v) > 1.0:
        return None
    beta = math.asin(v) - math.atan2(se * sl, ce)
    cb = math.cos(beta)
    ra_t = _D(math.atan2(sl * cb * ce - math.sin(beta) * se, math.cos(_R(lon_p)) * cb))
    return _n180(ra_s - ra_t)


# ── 极下法通式 + 两种取极法(Topocentric / Placidus 极下)───────────────────────────
# 任一大圆都可写成某个「虚拟纬度」p 的斜升圈:点 X 在圈上 ⇔ RA_X − asin(tan p·tan δ_X) = 常数。
# p 带号:东半(上升侧)取正 = 斜升,西半取负 = 斜降。目标点 t 的位置圈取 t 自己的极,
# 动点 m 走到该圈所需的赤经转角 = OA_p(m) − OA_p(t)(与 pole_circle_arc 同一正负约定;
# 代入 Regiomontanus 的极与 pole_circle_arc 逐值相同)。

def _oblique_ascension(ra, decl, pole):
    x = math.tan(_R(pole)) * math.tan(_R(decl))
    if abs(x) >= 1.0:
        return None
    return ra - _D(math.asin(x))


def under_pole_arc(pole, ra_t, decl_t, ra_m, decl_m):
    if pole is None:
        return None
    a = _oblique_ascension(ra_m, decl_m, pole)
    b = _oblique_ascension(ra_t, decl_t, pole)
    if a is None or b is None:
        return None
    return _n180(a - b)


def _meridian_ratio(ra, decl, ramc, lat):
    """(东西号 +1 东 / −1 西, 离最近子午轴的半弧比例 q ∈ [0, 1]);地平之上从 MC 量、除以昼半弧,之下从 IC 量、除以夜半弧。"""
    ad = ascensional_difference(decl, lat)
    if ad is None:
        return None
    dsa, nsa = 90.0 + ad, 90.0 - ad
    md = _n180(ra - ramc)            # 正 = 东(上升侧)
    sign = 1.0 if md > 0 else -1.0
    if abs(md) <= dsa:
        return sign, abs(md) / dsa
    return sign, (180.0 - abs(md)) / nsa


def topocentric_pole(ra, decl, ramc, lat):
    """Topocentric(Polich–Page)极:tan p = tan φ × 子午距 / 半弧;东半取正(斜升)、西半取负(斜降)。"""
    r = _meridian_ratio(ra, decl, ramc, lat)
    if r is None:
        return None
    sign, q = r
    return sign * _D(math.atan(math.tan(_R(lat)) * q))


def placidus_pole(ra, decl, ramc, lat):
    """Placidus 极下法的极:点在半弧比例 q 处,其「Placidus 位置」的斜升 / 斜降 = 子午轴赤经 ± 90°·q
    (东上:RAMC + 90q;东下:RAIC − 90q;西上:RAMC − 90q;西下:RAIC + 90q),由此反解极 p。"""
    r = _meridian_ratio(ra, decl, ramc, lat)
    if r is None:
        return None
    sign, q = r
    ad = ascensional_difference(decl, lat)
    above = abs(_n180(ra - ramc)) <= 90.0 + ad
    base = ramc if above else ramc + 180.0
    target = base + sign * 90.0 * q * (1.0 if above else -1.0)
    ad_p = _n180(ra - target)
    if abs(decl) < 1e-9:
        return 0.0
    return _D(math.atan(math.sin(_R(ad_p)) / math.tan(_R(decl))))


def azimuth(ra, decl, ramc, lat):
    """方位角(自北向东,0 … 360)。"""
    h, d, f = _R(ramc - ra), _R(decl), _R(lat)
    x = -math.sin(h) * math.cos(d)
    y = math.cos(f) * math.sin(d) - math.sin(f) * math.cos(d) * math.cos(h)
    return _D(math.atan2(x, y)) % 360.0


def horizon_to_eq(az, alt, ramc, lat):
    """地平坐标(方位 az 自北向东、高度 alt)→ (赤经, 赤纬)。"""
    f, a, h = _R(lat), _R(az), _R(alt)
    north, east, up = (-math.sin(f), 0.0, math.cos(f)), (0.0, -1.0, 0.0), (math.cos(f), 0.0, math.sin(f))
    v = [math.cos(h) * math.cos(a) * north[i] + math.cos(h) * math.sin(a) * east[i] + math.sin(h) * up[i] for i in range(3)]
    return (ramc - _D(math.atan2(v[1], v[0]))) % 360.0, _D(math.asin(max(-1.0, min(1.0, v[2]))))


def _altitude(ra, decl, ramc, lat):
    h, d, f = _R(ramc - ra), _R(decl), _R(lat)
    return _D(math.asin(max(-1.0, min(1.0, math.sin(f) * math.sin(d) + math.cos(f) * math.cos(d) * math.cos(h)))))


def horizontal_pole(ra, decl, ramc, lat):
    """Horizontal(地平经圈)极:过该点与天顶的地平经圈写成极下斜升圈 OA = RA − asin(tan p · tan δ),
    |p| = asin(cos φ · |sin A|)(圈的法向是地平上与方位 A 垂直的方向,其赤纬的绝对值即 |p|)。
    同一大圆有 (p, c) 与 (−p, c + 180°) 两种写法、各管一支;正负取让该点与同方位邻点(高度差 0.5°)落在同一支的那个
    —— 中高纬多为 sin p = −sgn φ · cos φ · sin A,低纬靠近赤纬极值处会换号。弧不靠它(见 vertical_circle_arc)。"""
    a = azimuth(ra, decl, ramc, lat)
    p = _D(math.asin(min(1.0, math.cos(_R(lat)) * abs(math.sin(_R(a))))))
    sg = 1.0 if float(lat) >= 0 else -1.0
    first = -sg * (1.0 if math.sin(_R(a)) >= 0 else -1.0) * p
    alt = _altitude(ra, decl, ramc, lat)
    ra2, de2 = horizon_to_eq(a, alt + (0.5 if alt < 89.0 else -0.5), ramc, lat)
    for cand in (first, -first):
        o1, o2 = _oblique_ascension(ra, decl, cand), _oblique_ascension(ra2, de2, cand)
        if o1 is not None and o2 is not None and abs(_n180(o1 - o2)) < 1e-6:
            return cand
    return first


def koch_pole(ra, decl, ramc, lat):
    """Koch(出生地法)极:位置圈 = 过该点的出生地斜升圈,东半取 +φ(斜升)、西半取 −φ(斜降)。"""
    return float(lat) if _n180(ra - ramc) > 0 else -float(lat)


def vertical_circle_arc(az_t, ra_m, decl_m, ramc, lat):
    """动点沿自身周日圈走到方位角 = az_t 的那半条地平经圈(天顶—地平点—天底)所需的赤经转角(正 = 顺,动点赤经减小)。
    地平经圈所在平面的法向 = 地平上方位 az_t + 90° 的方向;与周日圈两交点里取方位角等于 az_t 的那一个。"""
    f, a = _R(lat), _R(az_t + 90.0)
    north = (-math.sin(f), 0.0, math.cos(f))
    east = (0.0, -1.0, 0.0)
    n = tuple(math.cos(a) * north[i] + math.sin(a) * east[i] for i in range(3))
    cd, sd = math.cos(_R(decl_m)), math.sin(_R(decl_m))
    a_, b_, c_ = n[0] * cd, n[1] * cd, -n[2] * sd
    rr = math.hypot(a_, b_)
    if rr < 1e-12 or abs(c_) > rr:
        return None
    base, off = math.atan2(b_, a_), math.acos(max(-1.0, min(1.0, c_ / rr)))
    best = None
    for h in (base + off, base - off):
        ra_new = ramc - _D(h)
        if abs(_n180(azimuth(ra_new, decl_m, ramc, lat) - az_t)) > 1e-6:
            continue
        arc = _n180(ra_m - ra_new)
        if best is None or abs(arc) < abs(best):
            best = arc
    return best


def horizontal_arc(ra_t, decl_t, ra_m, decl_m, ramc, lat):
    """Horizontal 本体弧:动点走到目标点所在的那半条地平经圈(方位角与目标点相同)。"""
    return vertical_circle_arc(azimuth(ra_t, decl_t, ramc, lat), ra_m, decl_m, ramc, lat)


def koch_arc(ra_t, decl_t, ra_m, decl_m, ramc, lat):
    """Koch 本体弧:动点走到目标点的出生地斜升 / 斜降圈。"""
    return under_pole_arc(koch_pole(ra_t, decl_t, ramc, lat), ra_t, decl_t, ra_m, decl_m)


def topocentric_arc(ra_t, decl_t, ra_m, decl_m, ramc, lat):
    """Topocentric 本体弧:动点走到目标点的 Topocentric 位置圈(目标点自己的极)。"""
    return under_pole_arc(topocentric_pole(ra_t, decl_t, ramc, lat), ra_t, decl_t, ra_m, decl_m)


def placidus_pole_arc(ra_t, decl_t, ra_m, decl_m, ramc, lat):
    """Placidus 极下法本体弧:动点走到目标点 Placidus 位置所在的位置圈(目标点自己的极)。"""
    return under_pole_arc(placidus_pole(ra_t, decl_t, ramc, lat), ra_t, decl_t, ra_m, decl_m)
