# -*- coding: utf-8 -*-
"""websrv 入口共享守卫。

排盘入口此前对坐标零校验:gpsLat=200/gpsLon=500 会被静默接受并出盘
(swisseph 拿 200° 纬度算宫位 → 垃圾盘面,无任何报错,比崩溃更糟)。
这里只做边界合法性,不做任何业务取舍;astrostudy 核心层不动。
"""


def validate_geo(data):
    """坐标校验。非法返回结构化错误 dict(调用方直接 jsonpickle 返回),合法返回 None。

    两层：
    ① 数值型 gpsLat/gpsLon 范围校验(主用坐标)。字段缺失/非数值不在此拦(兼容旧请求形态)。
    ② lat/lon 可解析性预检：用与排盘同一套 flatlib geopos.toFloat 试解——十进制串('31.2')/
       DMS 串('26n04'/'121e30')/数值均合法(geopos 已支持十进制串直读,历史上 '31.2' 这类串会在
       PerChart→GeoPos 抛原始 ValueError → Java 泛化 param error,用户只看到误导性的
       「本地服务未就绪」弹窗)。真垃圾('abc')在此返回结构化 invalid_coordinates;范围钳
       [-90,90]/[-180,180]。
    """
    try:
        lat = data.get('gpsLat', None)
        lon = data.get('gpsLon', None)
        if lat is not None:
            lat = float(lat)
            if lat < -90.0 or lat > 90.0:
                return {'err': 'invalid_coordinates',
                        'detail': 'gpsLat must be within [-90, 90], got {0}'.format(lat)}
        if lon is not None:
            lon = float(lon)
            if lon < -180.0 or lon > 180.0:
                return {'err': 'invalid_coordinates',
                        'detail': 'gpsLon must be within [-180, 180], got {0}'.format(lon)}
    except (TypeError, ValueError):
        # 非数值 gps 坐标:不在此误杀,lat/lon 预检在下方兜底。
        pass
    # ② lat/lon 可解析性 + 范围预检(与 GeoPos 同一解析器,行为恒一致)
    from flatlib import geopos as _geopos
    for key, lo, hi in (('lat', -90.0, 90.0), ('lon', -180.0, 180.0)):
        raw = data.get(key, None)
        if raw is None or raw == '':
            continue
        try:
            val = _geopos.toFloat(raw)
        except Exception:
            return {'err': 'invalid_coordinates',
                    'detail': '{0} is not a parsable coordinate: {1!r}'.format(key, raw)}
        if val < lo or val > hi:
            return {'err': 'invalid_coordinates',
                    'detail': '{0} must be within [{1}, {2}], got {3}'.format(key, lo, hi, val)}
    return None
