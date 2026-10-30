# -*- coding: utf-8 -*-
"""界推运(分配法 / Distributions):发放点随周日运动依次经过其后的各界。

几何:周日运动把黄道各度按黄经递增的顺序带上地平,出生后发放点「走过」的是它后面(黄经更大)的界,
所以从发放点所在之界的余度起,顺黄道逐界推进。

- 分配星期:每一界一期,界主 = 分配星。
- 伙伴星期:七颗古典行星(发放点本身除外)的本体与左右 60° / 90° / 120°、180° 相位点,按发放点到达的先后,
  每一点起一期,到下一点为止(与分配星换界无关)。
- 时间(分配星期与伙伴星期同用一把尺):
  · classical(上升时间,古典):每度年数 = 该星座在出生纬度的上升时间 ÷ 30(星座内均匀);上升时间 = 星座首尾两度的
    斜升差,按出生纬度、当日平黄赤交角精确计算(不查整数纬度的旧表)。
  · exact(斜升差,逐度):走过一段的年数 = 起止两点的斜升差(逐度精确,即在出生纬度下的真实上升时间)。
  · qisma:每度 1 年。
- 年 → 日期:年数 × 年长(回归年 365.2422 / 365 天 / 儒略年 365.25)加到出生时刻上。"""
import math

from flatlib import const
from flatlib.dignities import tables

RELEASERS = ('Asc', 'MC', 'Desc', 'IC', 'Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn',
             'Uranus', 'Neptune', 'Pluto', 'North Node', 'Vertex', 'Pars Fortuna', 'Spirit', 'Syzygy')
DEFAULT_RELEASER = 'Asc'
METHODS = ('classical', 'exact', 'qisma')
DEFAULT_METHOD = 'classical'
YEAR_DAYS = {'tropical': 365.2422, 'egyptian': 365.0, 'julian': 365.25}
DEFAULT_YEAR = 'tropical'
SPANS = (60, 80, 100, 120, 150)
DEFAULT_SPAN = 100

PARTNER_PLANETS = (const.SUN, const.MOON, const.MERCURY, const.VENUS, const.MARS, const.JUPITER, const.SATURN)
# (相位角, 侧):右 = 本体黄经减相位(右旋),左 = 加相位;0 本体、180 冲各只有一点
PARTNER_ASPECTS = ((0, ''), (60, 'D'), (60, 'S'), (90, 'D'), (90, 'S'), (120, 'D'), (120, 'S'), (180, ''))


def normalize(settings):
    s = settings or {}
    releaser = s.get('distReleaser') if s.get('distReleaser') in RELEASERS else DEFAULT_RELEASER
    method = s.get('distMethod') if s.get('distMethod') in METHODS else DEFAULT_METHOD
    year = s.get('distYear') if s.get('distYear') in YEAR_DAYS else DEFAULT_YEAR
    try:
        span = int(s.get('distYears'))
    except (TypeError, ValueError):
        span = DEFAULT_SPAN
    span = span if span in SPANS else DEFAULT_SPAN
    return {'distReleaser': releaser, 'distMethod': method, 'distYear': year, 'distYears': span}


def oblique_ascension(lon, phi, eps):
    """黄道点在纬度 phi 的斜升(度)。"""
    l, e, p = math.radians(lon), math.radians(eps), math.radians(phi)
    ra = math.degrees(math.atan2(math.sin(l) * math.cos(e), math.cos(l))) % 360.0
    decl = math.asin(math.sin(e) * math.sin(l))
    x = max(-1.0, min(1.0, math.tan(p) * math.tan(decl)))
    return ra - math.degrees(math.asin(x))


def sign_rising_time(sign_idx, phi, eps):
    """第 sign_idx 个星座(0 = 白羊)在纬度 phi 的上升时间(赤经度)。"""
    a = oblique_ascension(sign_idx * 30.0, phi, eps)
    b = oblique_ascension(sign_idx * 30.0 + 30.0, phi, eps)
    return (b - a) % 360.0


def terms_list(terms_variant):
    """[(界主, 星座序, 起黄经, 止黄经)],按黄经升序;界系随全局设置(与盘面同一张表)。"""
    tv = int(terms_variant or 0)
    if tv in (3, 4):
        from flatlib.dignities import essential as _essential
        terms = _essential.TERMS
    else:
        terms = (tables.TETRABIBLOS_TERMS if tv == 1
                 else tables.LILLY_TERMS if tv == 2 else tables.EGYPTIAN_TERMS)
    out = []
    for i, sign in enumerate(const.LIST_SIGNS):
        for (ruler, start, end) in terms[sign]:
            out.append((ruler, i, 30.0 * i + float(start), 30.0 * i + float(end)))
    return sorted(out, key=lambda t: t[2])


class Path:
    """发放点之后的黄道路径:路程 d(度,从发放点起)↔ 年数,按 classical / qisma 计。"""

    def __init__(self, start_lon, method, phi, eps):
        self.start = start_lon % 360.0
        self.method = method
        self.phi, self.eps = phi, eps
        self.rate = [1.0] * 12 if method == 'qisma' else [sign_rising_time(i, phi, eps) / 30.0 for i in range(12)]

    def _step_years(self, pos, step):
        if self.method == 'exact':
            return (oblique_ascension(pos + step, self.phi, self.eps) - oblique_ascension(pos, self.phi, self.eps)) % 360.0
        return step * self.rate[int(pos // 30.0) % 12]

    def years_to(self, d):
        """从发放点走 d 度(d ≥ 0,可跨多座)所需年数。"""
        total, pos, left = 0.0, self.start, d
        while left > 1e-12:
            to_end = 30.0 * (math.floor(pos / 30.0) + 1) - pos
            step = min(left, to_end)
            total += self._step_years(pos, step)
            pos = (pos + step) % 360.0
            left -= step
        return total


def compute(start_lon, partners, settings, phi, eps, terms_variant):
    """返回 (distributors, partner_periods),年数从出生起算;settings 已 normalize。"""
    span = float(settings['distYears'])
    path = Path(start_lon, settings['distMethod'], phi, eps)
    start = path.start
    bounds = terms_list(terms_variant)
    # 起点所在之界,再往后逐界(跨 360° 循环)
    n = len(bounds)
    idx = next(i for i, b in enumerate(bounds) if b[2] <= start < b[3])
    dists = []
    d_start = 0.0
    for k in range(idx, idx + 3 * n):
        ruler, sign_idx, _lo, hi = bounds[k % n]
        d_end = hi + 360.0 * (k // n) - start   # 展开后的界终点 − 起点
        y0, y1 = path.years_to(d_start), path.years_to(d_end)
        if y0 >= span:
            break
        dists.append({'ruler': ruler, 'signIdx': sign_idx, 'd0': d_start, 'd1': d_end, 'y0': y0, 'y1': y1})
        d_start = d_end
    pts = []
    for (pid, lon) in partners:
        for asp, side in PARTNER_ASPECTS:
            plon = lon + (asp if side == 'S' or (asp == 180) else -asp if side == 'D' else 0.0)
            d = (plon - start) % 360.0
            if d < 1e-9:
                continue
            pts.append({'planet': pid, 'aspect': asp, 'side': side, 'lon': plon % 360.0, 'd': d})
    pts.sort(key=lambda p: p['d'])
    periods = []
    for i, p in enumerate(pts):
        y0 = path.years_to(p['d'])
        if y0 >= span:
            break
        d_next = pts[i + 1]['d'] if i + 1 < len(pts) else 360.0
        periods.append(dict(p, y0=y0, y1=path.years_to(d_next)))
    return dists, periods
