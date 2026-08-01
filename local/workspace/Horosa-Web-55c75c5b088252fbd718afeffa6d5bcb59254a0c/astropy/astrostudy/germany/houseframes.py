# -*- coding: utf-8 -*-
"""量化盘 六大宫框(定局法)—— compute_house_frames(perchart, pts)。

六框各以不同锚点起 1 宫头,把同一组点重新分宫,读「该点落第几宫」的象限/角宫结构。
五框走「等宫」(每宫整 30°,锚点=1 宫头);唯独「子午局」走赤道分宫(不等距),
直连 swisseph.houses_ex(jd,lat,lon,b'X') 读裸 ascmc[4](东点)作 1 宫头、ascmc[1](MC)作 10 宫头。

🔴 子午局/东点必走 houses_ex(...,b'X') 读裸 ascmc[4]/ascmc[1],绝不走 flatlib sweHouses
   —— 后者把东点(ascmc[4])当 ASC 的赤经误转成黄经(见 flatlib/ephem/swe.py 的 cotrans),会算错。

六框锚点:
  - 子午局 meridian : 1 宫头=东点 ascmc[4]、10 宫头=MC ascmc[1](赤道分宫,等距=False)。
  - 上升局 ascendant: Asc=1 宫头(等宫)。
  - 太阳局 sun      : ☉=4 宫 ⇒ 1 宫头=☉−90°(等宫)。
  - 月亮局 moon     : ☽=10 宫 ⇒ 1 宫头=☽+90°(等宫)。
  - 交点局 node     : 北交=1 宫头(等宫)。
  - 地球局 earth    : 0°巨蟹(=90°)=MC ⇒ 1 宫头固定 180°、与生时无关(等宫)。

本模块只读不写:不改 perchart、不改 MidPoint 任何输出;由端点在 midpoint() 组装后追加 houseFrames 字段。
"""

import swisseph
from flatlib import const


def _meridian_cusps(jd, lat, lon):
    """子午局:赤道分宫(Axial rotation / Meridian houses, hsys=X)。
    返回 (cusps[12] 已 %360, 东点 ascmc[4]%360, MC ascmc[1]%360)。
    直连 houses_ex 读裸 ascmc——不经 flatlib sweHouses(它会把东点当 ASC 赤经误转)。"""
    cusps, ascmc = swisseph.houses_ex(jd, float(lat), float(lon), b'X')
    # ascmc[3]=Vertex:同一调用顺带带出(B7 前端可选点),零新计算;锚点语义(ascmc[4]/[1])不变。
    return [c % 360 for c in cusps], ascmc[4] % 360, ascmc[1] % 360, ascmc[3] % 360


def _equal_cusps(first):
    """等宫:1 宫头=first,其后每 30° 一宫,共 12 个宫头。"""
    f = first % 360
    return [(f + 30 * i) % 360 for i in range(12)]


def _house_of(lon, cusps):
    """点 lon 落第几宫(1..12)。按弧长口径判断,跨 0° 安全;不等距(子午局)同样适用。
    宫 i 区间 = [cusps[i], cusps[i+1]),用模 360 弧长比较,落最后兜底 12。"""
    L = lon % 360
    for i in range(12):
        a, b = cusps[i], cusps[(i + 1) % 12]
        if (L - a) % 360 < (b - a) % 360:
            return i + 1
    return 12


def _lon_of(pts, oid):
    """从 pts 取某 id 的黄经(找不到返回 None)。"""
    for p in pts:
        if p.get('id') == oid:
            return p.get('lon')
    return None


def _placements(pts, cusps):
    """组装 {id -> 落宫(1..12)}(逐点过 _house_of)。"""
    out = {}
    for p in pts:
        L = p.get('lon')
        if L is None:
            continue
        out[p['id']] = _house_of(L, cusps)
    return out


def _frame(cusps, equal, pts, first=None, tenth=None):
    """单框响应:cusps[12] / equal 标志 / firstCusp / tenthCusp / placements。"""
    fc = cusps[0] if first is None else first % 360
    tc = cusps[9] if tenth is None else tenth % 360
    return {
        'cusps': [c % 360 for c in cusps],
        'equal': bool(equal),
        'firstCusp': fc % 360,
        'tenthCusp': tc % 360,
        'placements': _placements(pts, cusps),
    }


def compute_house_frames(perchart, pts):
    """六大宫框总装。pts=[{id,lon},...](行星+Asc/MC+8 TNP+白羊点,复用 midpoint.objects 口径 + 白羊点)。

    返回 {
      frames: { meridian, ascendant, sun, moon, node, earth },   # 各为 _frame(...)
      eastPoint, mc, asc                                          # 顶层锚点参考(度)
    }
    纯读:不改 perchart / 不改 MidPoint 输出。
    """
    jd = perchart.dateTime.jd
    lat = perchart.pos.lat
    lon = perchart.pos.lon

    # —— 子午局:赤道分宫(不等距),直连 houses_ex(b'X') 读裸 ascmc[4]/ascmc[1] ——
    mer_cusps, east_point, mc, vertex = _meridian_cusps(jd, lat, lon)

    # 上升 Asc(从 pts 取;pts 含 midpoint.objects 的 Asc,与盘一致)。
    asc = _lon_of(pts, const.ASC)
    sun = _lon_of(pts, const.SUN)
    moon = _lon_of(pts, const.MOON)
    node = _lon_of(pts, const.NORTH_NODE)

    frames = {}
    # 子午局:不等距,1=东点、10=MC。
    frames['meridian'] = _frame(mer_cusps, False, pts, first=east_point, tenth=mc)
    # 上升局:Asc=1 宫头(等宫)。Asc 缺失时回退东点,保证总能出框。
    asc_first = asc if asc is not None else east_point
    frames['ascendant'] = _frame(_equal_cusps(asc_first), True, pts, first=asc_first)
    # 太阳局:☉=4 宫 ⇒ 1 宫头=☉−90°。
    if sun is not None:
        frames['sun'] = _frame(_equal_cusps(sun - 90), True, pts, first=(sun - 90) % 360)
    # 月亮局:☽=10 宫 ⇒ 1 宫头=☽+90°。
    if moon is not None:
        frames['moon'] = _frame(_equal_cusps(moon + 90), True, pts, first=(moon + 90) % 360)
    # 交点局:北交=1 宫头。
    if node is not None:
        frames['node'] = _frame(_equal_cusps(node), True, pts, first=node % 360)
    # 地球局:0°巨蟹(=90°)=MC ⇒ 1 宫头固定 180°、与生时无关。
    frames['earth'] = _frame(_equal_cusps(180), True, pts, first=180.0)

    return {
        'frames': frames,
        'eastPoint': east_point,
        'vertex': vertex,
        'mc': mc,
        'asc': asc,
    }
