"""广义行星时相位:相位不看黄经差,看两星在周日运动里相隔几「时」。

一圈 24 时:上升 0、中天 6、下降 12、下中天 18。六合差 4 时、刑 6、拱 8、冲 12,容许不足 1 时。
改进档用半弧比例;经典档用极角与纬度成线性的写法。
"""
import math

import swisseph
from flatlib import const

ASPECT_HOURS = ((0.0, 0), (4.0, 60), (6.0, 90), (8.0, 120), (12.0, 180))
ASPECT_ORB = 1.0
BODIES = ((const.SUN, swisseph.SUN), (const.MOON, swisseph.MOON), (const.MERCURY, swisseph.MERCURY), (const.VENUS, swisseph.VENUS),
          (const.MARS, swisseph.MARS), (const.JUPITER, swisseph.JUPITER), (const.SATURN, swisseph.SATURN),
          (const.URANUS, swisseph.URANUS), (const.NEPTUNE, swisseph.NEPTUNE), (const.PLUTO, swisseph.PLUTO))
VARIANTS = ('improved', 'classic')
ROOT_GRID_STEP = 0.25
ROOT_GRID_COUNT = 721


def _wrap(value):
    return (value + 180.0) % 360.0 - 180.0


def _clamped_asin(value):
    return math.degrees(math.asin(max(-1.0, min(1.0, value))))


def _day_semi_arc(lat, dec):
    return 90.0 + _clamped_asin(math.tan(math.radians(lat)) * math.tan(math.radians(dec)))


def hour_improved(hour_angle, dec, lat):
    """半弧比例:地平之上从中天量、除以昼半弧,地平之下从下中天量、除以夜半弧。"""
    day = _day_semi_arc(lat, dec)
    if abs(hour_angle) < day:
        return (6.0 + 6.0 * hour_angle / day) % 24.0 if day > 0 else 6.0
    night = 180.0 - day
    return (18.0 + 6.0 * _wrap(hour_angle - 180.0) / night) % 24.0 if night > 0 else 18.0


def _classic_root(reduced, tan_reduced, lat):
    """E = H₀ − asin(tan δ′ · tan(φ · E / 90)),E 限定在 ±90°(半弧的两端)。
    迭代在近地平处发散、还会收敛到半弧以外的假根,所以直接在半弧内找变号再二分。
    高纬有多个根时取离半弧等比位置最近的。"""
    phi = math.radians(lat)

    def residual(value):
        return value - reduced + _clamped_asin(tan_reduced * math.tan(phi * value / 90.0))

    semi_arc = 90.0 + _clamped_asin(tan_reduced * math.tan(phi))
    guess = reduced * 90.0 / semi_arc if semi_arc > 0.0 else 0.0
    best = None
    grid = [-90.0 + index * ROOT_GRID_STEP for index in range(ROOT_GRID_COUNT)]
    previous = residual(grid[0])
    for low, high in zip(grid, grid[1:]):
        current = residual(high)
        if previous * current <= 0.0:
            left, right = low, high
            for _ in range(50):
                middle = (left + right) / 2.0
                if residual(left) * residual(middle) <= 0.0:
                    right = middle
                else:
                    left = middle
            root = (left + right) / 2.0
            if best is None or abs(root - guess) < abs(best - guess):
                best = root
        previous = current
    return guess if best is None else best


def hour_classic(hour_angle, dec, lat):
    """线性极角:E = H₀ − asin(tan δ′ · tan(φ · E / 90)) 的解。"""
    tan_dec = math.tan(math.radians(dec))
    if abs(hour_angle) < _day_semi_arc(lat, dec):
        base, reduced, tan_reduced = 6.0, hour_angle, tan_dec
    else:
        base, reduced, tan_reduced = 18.0, _wrap(hour_angle - 180.0), -tan_dec
    return (base + _classic_root(reduced, tan_reduced, lat) / 15.0) % 24.0


HOUR_OF = {'improved': hour_improved, 'classic': hour_classic}


def hour_gap(first, second):
    return abs((first - second + 12.0) % 24.0 - 12.0)


def aspect_of(gap):
    """时位差落在哪个相位:(相位度数, 差几时);都不在容许内回 None。"""
    for hours, degrees in ASPECT_HOURS:
        if abs(gap - hours) < ASPECT_ORB:
            return degrees, abs(gap - hours)
    return None


def build_hour_aspects(jd, lat, lon, variant='improved', true_node=False):
    """每星一个时位,每对星一个时位差与相位。纬度取出生地,极圈内半弧退化时仍给数。北交跟盘的真平交点口径。"""
    if variant not in VARIANTS:
        variant = 'improved'
    hour_of = HOUR_OF[variant]
    armc = swisseph.houses_ex(jd, lat, lon, b'O')[1][2]
    bodies = []
    for name, body in BODIES + ((const.NORTH_NODE, swisseph.TRUE_NODE if true_node else swisseph.MEAN_NODE),):
        row = swisseph.calc_ut(jd, body, swisseph.FLG_EQUATORIAL | swisseph.FLG_SWIEPH)[0]
        hour_angle = _wrap(armc - row[0])
        bodies.append({'id': name, 'hourAngle': hour_angle, 'dec': row[1], 'hour': hour_of(hour_angle, row[1], lat)})
    pairs = []
    for index, first in enumerate(bodies):
        for second in bodies[index + 1:]:
            gap = hour_gap(first['hour'], second['hour'])
            hit = aspect_of(gap)
            pairs.append({'a': first['id'], 'b': second['id'], 'gap': gap, 'aspect': hit[0] if hit else None, 'orb': hit[1] if hit else None})
    return {'variant': variant, 'bodies': bodies, 'pairs': pairs}
