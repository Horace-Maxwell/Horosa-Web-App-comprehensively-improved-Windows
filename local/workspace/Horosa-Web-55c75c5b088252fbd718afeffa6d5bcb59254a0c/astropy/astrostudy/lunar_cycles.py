"""月相回归类日期表:受孕期(日月角距回到出生时的角距)与危机日(月亮自起病时刻每走 45°)。

受孕期:一年里日月角距 (月 − 日) mod 360 回到出生时的角距的各个时刻,约每个朔望月一次;
    当时月亮落阳性星座(火、风)记男,阴性星座(土、水)记女。
危机日:以起盘时刻为起病时刻,月亮从当时的位置起每走 45° 一个节点;90°、180°、270°、360° 是危机日,
    45°、135°、225°、315° 是判断日。
"""
import swisseph

SYNODIC = 29.530588853
SIDEREAL = 27.321661
FLAGS = swisseph.FLG_SWIEPH | swisseph.FLG_SPEED


def _lon(jd, body):
    return swisseph.calc_ut(jd, body, FLAGS)[0][0]


def elongation(jd):
    return (_lon(jd, swisseph.MOON) - _lon(jd, swisseph.SUN)) % 360.0


def _refine(fn, target, jd, rate):
    """fn(jd) 是会绕圈的角度;牛顿迭代到与 target 差不足 1e-7 度。"""
    for _ in range(30):
        diff = (fn(jd) - target + 540.0) % 360.0 - 180.0
        if abs(diff) < 1e-7:
            break
        jd -= diff / rate
    return jd


def fertility_dates(natal_jd, from_jd, days=365.0):
    """从 from_jd 起 days 天内,日月角距回到出生时角距的时刻。"""
    target = elongation(natal_jd)
    first = from_jd + ((target - elongation(from_jd)) % 360.0) / 12.19
    out = []
    jd = _refine(elongation, target, first, 12.19)
    if jd < from_jd:
        jd = _refine(elongation, target, jd + SYNODIC, 12.19)
    while jd < from_jd + days:
        moon = _lon(jd, swisseph.MOON)
        sign = int(moon // 30)
        out.append({'jd': jd, 'moonLon': moon, 'moonSign': sign, 'male': sign % 2 == 0})
        jd = _refine(elongation, target, jd + SYNODIC, 12.19)
    return {'elongation': target, 'rows': out}


def crisis_days(onset_jd, steps=8):
    """月亮自起病时刻的位置起,每走 45° 一个节点,共 steps 个。"""
    moon0 = _lon(onset_jd, swisseph.MOON)
    rows = []
    for k in range(1, steps + 1):
        target = (moon0 + 45.0 * k) % 360.0
        guess = onset_jd + 45.0 * k / 13.176
        jd = _refine(lambda t: _lon(t, swisseph.MOON), target, guess, 13.176)
        rows.append({'step': k, 'arc': 45 * k, 'jd': jd, 'moonLon': target, 'critical': k % 2 == 0, 'days': jd - onset_jd})
    return {'moon': moon0, 'rows': rows}
