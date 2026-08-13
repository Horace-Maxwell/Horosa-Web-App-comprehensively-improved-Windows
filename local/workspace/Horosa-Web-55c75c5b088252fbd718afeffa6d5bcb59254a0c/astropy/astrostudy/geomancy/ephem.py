# -*- coding: utf-8 -*-
"""地占·真实星历盘(按所问之时地起上升与宫头)。

为何单开一文件:地占其余内核(figures/shield/house/reading/chart)全是纯函数、零外部依赖,
可在任何环境直接导入跑不变量。星历要算就必须依赖天体历,故隔离在此,并**惰性导入** ——
未装星历库时本模块的各函数一律如实回 None,内核与哨兵照旧可跑。

诚实交代(务必与显示层口径一致):
  · 传本之「盘式」本不起真实星盘 —— 上升取自图形(一宫之图/另起四行点/法官之图),
    行星按其所主之图落宫。故本模块所出的真实盘是**可选的第四式**,默认不启用,
    启用后才按所选时地起上升度数与宫头。
  · 传本未言明象限当用何家分宫。本模块取**列宫制(Regiomontanus)**,两重理由:
    ① 盘式盛行之世,卜卦通用此法;
    ② 它在**全纬度**皆有解(实测连正负九十度极点亦然),而普拉西德/柯赫入极圈即无解 ——
       故无须另备极区兜底之法,也就不留一段永不触发的死代码。
"""
from __future__ import annotations

from typing import Dict, List, Optional

# 象限宫制:列宫制。全纬度有解,故无极区备用之法(详见本模块开头之说明)。
QUADRANT_PRIMARY = "regiomontanus"
_HSYS = {"regiomontanus": b"R"}

# 真实星历落星取传统七政 + 南北交(与图形落星 PLANET_ORDER 同一星组,便于两法对读)。
EPHEM_BODIES = ["Sun", "Moon", "Venus", "Mercury", "Saturn", "Jupiter", "Mars", "NorthNode", "SouthNode"]
_SWE_ID = {
    "Sun": 0, "Moon": 1, "Mercury": 2, "Venus": 3, "Mars": 4, "Jupiter": 5, "Saturn": 6,
    "NorthNode": 11,   # 平均交点(真交点每日振荡,卜卦取平交点为常法)
}


def _swe():
    """惰性导入星历库;未装即 None(调用方一律按「无真实盘」处理)。"""
    try:
        import swisseph
        return swisseph
    except ImportError:
        return None


def _norm360(x: float) -> float:
    return (x % 360.0 + 360.0) % 360.0


def julian_day(year: int, month: int, day: int, hour: float, zone: float = 0.0) -> Optional[float]:
    """儒略日(世界时)。hour 为当地小时之小数,zone 为时区偏移(东正西负)。
    负年沿仓内既定编码(前导负号=负年),swe.julday 原生即按此办。"""
    swe = _swe()
    if swe is None:
        return None
    try:
        return float(swe.julday(int(year), int(month), int(day), float(hour) - float(zone)))
    except (ValueError, TypeError, OverflowError):
        return None


def real_erection(jd: float, lat: float, lon: float, house_system: str = "whole_sign") -> Optional[dict]:
    """据时地起真实上升与十二宫头。

    回值(仅在真算成时才有,故新键不会污染未启用之响应):
      asc_lon      上升黄经(0-360)
      mc_lon       中天黄经
      cusps        十二宫头黄经(house1..house12);整宫制下为各宫起始星座之 0°
      quadrant_system  实际所用象限宫制名(整宫制下为 None)
    算不成(无星历库/极端参数/星历报错)一律回 None,由调用方如实回落图形取法。"""
    swe = _swe()
    if swe is None:
        return None
    try:
        jd = float(jd)
        lat = float(lat)
        lon = float(lon)
    except (TypeError, ValueError):
        return None
    if not (-90.0 <= lat <= 90.0) or not (-180.0 <= lon <= 180.0):
        return None

    hs = house_system if house_system in ("whole_sign", "quadrant") else "whole_sign"
    quad = QUADRANT_PRIMARY if hs == "quadrant" else None
    try:
        res = swe.houses_ex2(jd, lat, lon, _HSYS[QUADRANT_PRIMARY], 0)
    except Exception:                      # 星历自身报错 → 如实无真实盘,不另换一家充数
        return None
    try:
        raw_cusps = list(res[0])
        ascmc = list(res[1])
    except (IndexError, TypeError):
        return None
    # swisseph 之宫头数组视版本或 0- 或 1- 起算,按长度判定,不猜。
    if len(raw_cusps) >= 13:
        cusps = [_norm360(float(raw_cusps[i])) for i in range(1, 13)]
    elif len(raw_cusps) >= 12:
        cusps = [_norm360(float(raw_cusps[i])) for i in range(0, 12)]
    else:
        return None
    asc_lon = _norm360(float(ascmc[0])) if ascmc else cusps[0]
    mc_lon = _norm360(float(ascmc[1])) if len(ascmc) > 1 else None

    if hs == "whole_sign":
        # 整宫制:上升所在星座即一宫,各宫头为其后各星座之 0°(与既有星座序口径同)。
        base = (int(asc_lon // 30.0) % 12) * 30.0
        cusps = [_norm360(base + 30.0 * k) for k in range(12)]
        quad = None
    return {
        "asc_lon": asc_lon,
        "mc_lon": mc_lon,
        "cusps": cusps,
        "quadrant_system": quad,
    }


def body_longitudes(jd: float) -> Optional[Dict[str, float]]:
    """七政与南北交之真实黄经。南交恒取北交对冲一百八十度(非另算,免二者不自洽)。"""
    swe = _swe()
    if swe is None:
        return None
    try:
        jd = float(jd)
    except (TypeError, ValueError):
        return None
    out: Dict[str, float] = {}
    for body, pid in _SWE_ID.items():
        try:
            res = swe.calc_ut(jd, pid)
        except Exception:
            return None
        try:
            out[body] = _norm360(float(res[0][0]))
        except (IndexError, TypeError, ValueError):
            return None
    if "NorthNode" in out:
        out["SouthNode"] = _norm360(out["NorthNode"] + 180.0)
    return out


def house_of_longitude(lon: float, cusps: List[float]) -> int:
    """黄经落第几宫(1-12)。按宫头逐宫夹逼,跨 0° 之宫照常成立(故不可用朴素大小比较)。"""
    x = _norm360(lon)
    for h in range(12):
        a = _norm360(cusps[h])
        b = _norm360(cusps[(h + 1) % 12])
        span = _norm360(b - a)
        if span == 0.0:                    # 退化宫(理论上不出现)按整宫算三十度
            span = 30.0
        if _norm360(x - a) < span:
            return h + 1
    return 1


def place_bodies_real(jd: float, cusps: List[float]) -> Optional[Dict[str, int]]:
    """真实星历落星:各体按其黄经落入宫头所分之宫。"""
    lons = body_longitudes(jd)
    if not lons or not cusps or len(cusps) < 12:
        return None
    return {b: house_of_longitude(lons[b], cusps) for b in EPHEM_BODIES if b in lons}
