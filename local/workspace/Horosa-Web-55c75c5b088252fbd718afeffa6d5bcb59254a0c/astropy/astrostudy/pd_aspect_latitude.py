# -*- coding: utf-8 -*-
"""黄道制(In Zodiaco)迫星相位点的黄纬口径。

黄道制主限里,迫星的相位点按惯例取在黄道上(黄纬 0);行星本体却带黄纬,于是「相位点该不该带黄纬、带多少」
有几种传统做法(都只作用于迫星的相位点,应星照旧用自己的黄纬):
  0 在黄道上(缺省):所有相位点黄纬 0。
  1 合冲带黄纬:合点取迫星黄纬 β、冲点取 −β,其余相位仍在黄道上
    (Gouchon 的实证口径:合 / 冲用黄纬效果好,其余相位不用)。
  2 余弦递减:相位点取在「以迫星为顶点、倾角 β 的大圆」上黄经差 a 处,tan(黄纬) = tan β · cos a
    (Gouchon 第二式;合 β、四分 0、冲 −β;大圆过迫星且在迫星处与黄道平行,离迫星黄经 90° 处与黄道相交)。
  3 线性递减:相位点黄纬 = β · (1 − a / 90)(Bianchini 式;合 β、六合 β/3、四分 0、三分 −β/3、冲 −β,余弦的线性化)。
  4 按宫位:相位点仍在黄经 λ + a 上,黄纬取得让它在所选方位法的宫位度量里、相对自己黄道垂足的偏移
    与迫星本体相对其黄道垂足的偏移相等 —— U(λ+a, β′) − U(λ+a, 0) = U(λ, β) − U(λ, 0)
    (见 house_position_latitude)。合点 β′ = β、冲点 β′ = −β 自然成立;其余相位的 β′ 随宫位度量而定,
    Placidus 用半弧比例位置、Regiomontanus / Campanus 用位置圈世俗角、Alcabitius / Meridian 用各自的赤道分段、
    Horizontal 用方位角、Koch 用出生地斜升 / 斜降量出的 Koch 世俗角、Topocentric 用 Polich–Page 宫位。
    宫位只由黄经定的方法(Porphyry、黄道等宫、Morinus)黄纬本就不改变宫位,相位点留在黄道上;
    时圈等宫、Edmund Jones、沿黄道等其余方法同样留在黄道上。
a 为相位角(0 … 180,左右相位同值;第 4 档带符号,右旋取负)。世俗制(In Mundo)与 Field Plane 用天体真位置,不受此项影响。
第 2 档按黄经差取点(相位点本来就定义在黄经 λ + a 上),所以用正切式;若按大圆弧长量 a 则是
asin(sin β · cos a),黄纬小时两式几乎相同,黄纬大的星(冥王星 ±15° 上下)六合 / 三分点差到 0.2° 量级。
"""
import math

MODES = (0, 1, 2, 3, 4)
HOUSE_POSITION_MODE = 4
DEFAULT_MODE = 0


def normalize_mode(value):
    try:
        v = int(value)
    except (TypeError, ValueError):
        return DEFAULT_MODE
    return v if v in MODES else DEFAULT_MODE


def aspect_point_latitude(mode, beta, aspect):
    """迫星相位点的黄纬(度)。beta = 迫星本体黄纬,aspect = 相位角(取绝对值)。"""
    a = abs(float(aspect))
    b = float(beta or 0.0)
    if mode == 1:
        if a < 1e-9:
            return b
        if abs(a - 180.0) < 1e-9:
            return -b
        return 0.0
    if mode == 2:
        return math.degrees(math.atan(math.tan(math.radians(b)) * math.cos(math.radians(a))))
    if mode == 3:
        return b * (1.0 - a / 90.0)
    return 0.0


def _wrap180(x):
    return (x + 180.0) % 360.0 - 180.0


def house_position_latitude(lam_p, beta, aspect, metric, step=0.5, limit=89.5):
    """第 4 档(按宫位):相位点 (λ+a, β′) 的 β′。metric(λ, b) → 该方法的宫位度量(度,MC=0 起算)或 None。
    条件 U(λ+a, β′) − U(λ+a, 0) = U(λ, β) − U(λ, 0)(均按 ±180 归一)。从 β·cos a 起向两侧逐步找变号区间再二分,
    取离起点最近的根(合 = β、冲 = −β、四分 ≈ 0 的那一支);任何纬度都达不到所需偏移时取迫星本体黄纬 β。"""
    b = float(beta or 0.0)
    if abs(b) < 1e-12:
        return 0.0
    lam_q = (float(lam_p) + float(aspect)) % 360.0
    up, u0, ua = metric(lam_p, b), metric(lam_p, 0.0), metric(lam_q, 0.0)
    if up is None or u0 is None or ua is None:
        return b
    want = _wrap180(up - u0)

    def f(x):
        v = metric(lam_q, x)
        return None if v is None else _wrap180(v - ua) - want

    start = max(-limit, min(limit, b * math.cos(math.radians(float(aspect)))))
    f0 = f(start)
    if f0 is not None and abs(f0) < 1e-12:
        return start
    k = 1
    while True:
        moved = False
        for side in (1.0, -1.0):
            x1 = start + side * (k - 1) * step
            x2 = start + side * k * step
            if abs(x2) > limit:
                continue
            moved = True
            f1, f2 = f(x1), f(x2)
            if f1 is None or f2 is None or f1 * f2 > 0.0 or abs(f1 - f2) > 60.0:
                continue
            lo, hi, flo = (x1, x2, f1)
            for _ in range(60):
                mid = 0.5 * (lo + hi)
                fm = f(mid)
                if fm is None:
                    break
                if flo * fm <= 0.0:
                    hi = mid
                else:
                    lo, flo = mid, fm
            return 0.5 * (lo + hi)
        if not moved:
            return b
        k += 1


def house_position_metric(kind, ramc, lat, eps, eq, dsa_asc=None, ad_mc=None):
    """按宫位档的宫位度量 U(λ, b)(度):eq(λ, b) → (赤经, 赤纬) 由调用方给(与引擎同一套换算)。
    kind ∈ placidus / regiomontanus / campanus / alcabitius / meridian / horizontal(方位角)/ koch(Koch 世俗角)/
    topocentric(Polich–Page 宫位),
    其余返回 None(相位点留在黄道上)。
    Placidus 的拱极点按升差截到 ±90°(半弧取 180° / 0°)取极限位置,不在拱极处断开。"""
    from astrostudy import pd_mundane as _pm
    ramc = float(ramc)
    lat = float(lat)
    if kind == 'meridian':
        return lambda lon, b: (eq(lon, b)[0] - ramc) % 360.0
    if kind == 'alcabitius':
        if dsa_asc is None or not (0.0 < dsa_asc < 180.0):
            return None
        return lambda lon, b: _pm.alcabitius_mundane_position(eq(lon, b)[0], ramc, dsa_asc)
    if kind == 'topocentric':
        # Topocentric(Polich–Page)宫位:点 X 的比例 q 满足 X 落在极 tan p = q·tan φ 的斜升圈上、该圈斜升 = RAMC + 90q
        # (宫首 q = 1/3、2/3、1 即 11、12、1 宫),由星历库按此定义求(house_pos 'T',带黄纬)
        import swisseph as _swe

        def _tp(lon, b):
            try:
                return (_swe.house_pos(ramc, lat, eps, (float(lon), float(b)), b'T') - 1.0) * 30.0
            except Exception:
                return None
        return _tp
    if kind == 'horizontal':
        from astrostudy import pd_semiarc_pole as _sp
        return lambda lon, b: _sp.azimuth(*eq(lon, b), ramc, lat)
    if kind == 'koch':
        if ad_mc is None:
            return None
        return lambda lon, b: _pm.koch_mundane_position(*eq(lon, b), ramc, lat, ad_mc)
    if kind in ('regiomontanus', 'campanus'):
        def _pc(lon, b):
            ra, decl = eq(lon, b)
            return _pm.position_circle_mundane_position(ra, decl, ramc, lat, kind)
        return _pc
    if kind == 'placidus':
        tl = math.tan(math.radians(lat))

        def _pl(lon, b):
            ra, decl = eq(lon, b)
            x = max(-1.0, min(1.0, math.tan(math.radians(decl)) * tl))
            ad = math.degrees(math.asin(x))
            dsa, nsa = 90.0 + ad, 90.0 - ad
            md = _wrap180(ra - ramc)
            if abs(md) <= dsa:
                q = abs(md) / dsa if dsa > 1e-12 else 0.0
                t = ((4.0 - q) % 4.0) if md > 0 else q
            else:
                q = (180.0 - abs(md)) / nsa if nsa > 1e-12 else 0.0
                t = (2.0 + q) if md > 0 else (2.0 - q)
            return t * 90.0
        return _pl
    return None
