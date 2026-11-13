"""量化盘「中点坐标」:赤经中点 / 赤纬中点(/germany/midpoint 请求带 mpCoord=ra|decl 时才算,作为【新增】字段下发)。

不改 MidPoint 任何输出(黄经中点表与相位照旧);点集 = 量化盘已算好的 midpoint.objects(行星 + Asc/MC + TNP)。
各点赤经赤纬读 flatlib 已算好的 obj.ra / obj.decl(赤道坐标单源 flatlib/ephem/swe.py:恒星盘先加回岁差,
四轴是黄纬 0 的黄道点、南交取北交对点,虚星按回归黄道直算)。不能拿 obj.lon 现算:恒星盘的 lon 是恒星黄经,
直接换赤道会差一个岁差;而且恒星盘里虚星的 lon 仍是回归黄经,点集两种黄道混在一起,只有赤道坐标是一致的。
对象缺赤道坐标时才按黄经现算兜底(flatlib 盘上的点都带,恒星盘的点不会走到兜底)。

 · 赤经中点:两点赤经的近轴中点(与黄经中点同一取法:离 A 超过 90° 翻到对面);接触 = 某点赤经与中点折叠到
   合 / 刑 / 冲(0 / 90 / 180)在容许度内 —— 与黄经中点相位判定同一套(_getAspectsUranian)。
 · 赤纬中点:两点赤纬的平均;接触 = 某点赤纬与之相等(平行)或互为相反数(反平行),容许度内。
   定义上的对点(南北交)赤纬恒互为相反数,中点恒为 0,不成中点对(与主盘赤纬平行排除同一组对点)。
中点对与接触目标都排除构成该中点的两点本身。
"""
import math

import swisseph

from astrostudy.perchart_parts.aspects import _ANTIPODE_PAIRS


def _finite_pair(ra, decl):
    try:
        ra, decl = float(ra), float(decl)
    except (TypeError, ValueError):
        return None
    if not (math.isfinite(ra) and math.isfinite(decl)):
        return None
    return ra % 360.0, decl


def _eq(obj, eps):
    ra, decl = getattr(obj, 'ra', None), getattr(obj, 'decl', None)
    if ra is not None and decl is not None:
        return _finite_pair(ra, decl)
    try:
        ra, decl = swisseph.cotrans((float(obj.lon), float(getattr(obj, 'lat', 0.0) or 0.0), 1.0), -float(eps))[:2]
    except Exception:
        return None
    return _finite_pair(ra, decl)


def _near_midpoint(a, b):
    mid = (a + b) / 2.0
    if abs(mid - a) > 90:
        mid = (mid + 180.0) % 360.0
    return mid % 360.0


def coord_midpoints(objects, coord, orb, jd_ut):
    """objects:flatlib 对象表(含 id / lon / lat);coord:'ra' | 'decl';jd_ut:出生时刻(取真黄赤交角)。
    返回 {'coord', 'midpoints', 'contacts'}。
    midpoints:[{idA, idB, value}](value = 赤经或赤纬中点);contacts:[{idA, idB, id, aspect, delta}]
    (赤经:aspect ∈ 0 / 90 / 180;赤纬:'parallel' / 'contraParallel')。"""
    if coord not in ('ra', 'decl'):
        return None
    eps = swisseph.calc_ut(float(jd_ut), swisseph.ECL_NUT)[0][0]
    pts = []
    for o in objects or []:
        e = _eq(o, eps)
        if e is not None:
            pts.append((o.id, e[0] if coord == 'ra' else e[1]))
    mids = []
    n = len(pts)
    for i in range(n):
        for j in range(i + 1, n):
            ida, va = pts[i]
            idb, vb = pts[j]
            if coord == 'decl' and frozenset((ida, idb)) in _ANTIPODE_PAIRS:
                continue
            value = _near_midpoint(va, vb) if coord == 'ra' else (va + vb) / 2.0
            mids.append({'idA': ida, 'idB': idb, 'value': value})
    contacts = []
    for m in mids:
        for pid, v in pts:
            if pid in (m['idA'], m['idB']):
                continue
            if coord == 'ra':
                d = abs(v - m['value']) % 360.0
                if d > 180.0:
                    d = 360.0 - d
                for asp in (0.0, 90.0, 180.0):
                    if abs(d - asp) < orb:
                        contacts.append({'idA': m['idA'], 'idB': m['idB'], 'id': pid, 'aspect': int(asp), 'delta': abs(d - asp)})
                        break
            else:
                if abs(v - m['value']) <= orb:
                    contacts.append({'idA': m['idA'], 'idB': m['idB'], 'id': pid, 'aspect': 'parallel', 'delta': abs(v - m['value'])})
                elif abs(v + m['value']) <= orb:
                    contacts.append({'idA': m['idA'], 'idB': m['idB'], 'id': pid, 'aspect': 'contraParallel', 'delta': abs(v + m['value'])})
    mids.sort(key=lambda x: x['value'])
    contacts.sort(key=lambda x: x['delta'])
    return {'coord': coord, 'midpoints': mids, 'contacts': contacts}
