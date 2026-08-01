# 戴维森盘(Davison):两人「时间中点 + 地理中点」真实起盘 —— 真实行星位置,
# 与组合中点盘(前端 compositeChart,逐因子取中点)本质不同。
# 独立新文件:绝不触碰 midpoint.py(其 uranian=False 路径受合盘复用字节守护)。
# 仅当 /germany/midpoint 请求显式携带 davison(第二人出生数据)时被调用,只【新增】响应字段。
from flatlib import const
from flatlib.datetime import Datetime
from flatlib.geopos import GeoPos
from flatlib.ephem import ephem as flatlib_ephem

# 戴维森点集:传统体(与量化盘盘面口径同源;黑月/紫气非汉堡因子不入) + 可选 8 TNP;
# Asc/MC 由中点时空真算(getHouses)。
_DAV_PLANETS = [
    const.SUN, const.MOON, const.MERCURY, const.VENUS, const.MARS, const.JUPITER, const.SATURN,
    const.URANUS, const.NEPTUNE, const.PLUTO, const.NORTH_NODE, const.SOUTH_NODE,
]


def lon_midpoint(lon_a, lon_b):
    """经度中点走球面最短弧:先归一到 [-180,180),按带符号最短差取半,再归一。
    跨 ±180° 不可裸算术平均(170°E 与 170°W 的中点是 180°,不是 0°)。东正西负。"""
    a = (float(lon_a) + 180.0) % 360.0 - 180.0
    b = (float(lon_b) + 180.0) % 360.0 - 180.0
    d = ((b - a + 180.0) % 360.0) - 180.0
    m = a + d / 2.0
    return (m + 180.0) % 360.0 - 180.0


def davison_midpoint(perchart_a, perchart_b):
    """时间中点(JD 算术平均,UT 绝对时间轴上正确)+ 纬度算术中点 + 经度最短弧中点。"""
    jd_mid = (perchart_a.dateTime.jd + perchart_b.dateTime.jd) / 2.0
    lat_mid = (float(perchart_a.pos.lat) + float(perchart_b.pos.lat)) / 2.0
    lon_mid = lon_midpoint(perchart_a.pos.lon, perchart_b.pos.lon)
    return jd_mid, lat_mid, lon_mid


def compute_davison(perchart_a, perchart_b, include_tnp=True, hsys=None):
    """两个已构造的 PerChart → 戴维森盘因子表。
    返回 {'jd','utc','lat','lon','points':[{id,lon,lat,lonspeed,sign,signlon}..],'angles':{Asc,MC}};
    个别星历失败进 'errors' 而非整体失败(与 TNP 构建同容错口径)。"""
    jd_mid, lat_mid, lon_mid = davison_midpoint(perchart_a, perchart_b)
    dt = Datetime.fromJD(jd_mid, '+00:00')
    pos = GeoPos(lat_mid, lon_mid)
    ids = list(_DAV_PLANETS) + (list(const.LIST_URANIAN) if include_tnp else [])
    points = []
    errors = []
    for oid in ids:
        try:
            o = flatlib_ephem.getObject(oid, dt, pos)
            points.append({
                'id': o.id, 'lon': o.lon, 'lat': o.lat, 'lonspeed': o.lonspeed,
                'sign': o.sign, 'signlon': o.signlon,
            })
        except Exception as e:
            errors.append({'id': oid, 'msg': '{0}'.format(e)})
    angles = {}
    try:
        _houses, angs = flatlib_ephem.getHouses(dt, pos, hsys or const.HOUSES_PLACIDUS)
        for a in angs:
            if a.id in (const.ASC, const.MC):
                angles[a.id] = a.lon
    except Exception as e:
        errors.append({'id': 'angles', 'msg': '{0}'.format(e)})
    out = {
        'jd': jd_mid, 'utc': '{0}'.format(dt), 'lat': lat_mid, 'lon': lon_mid,
        'points': points, 'angles': angles,
    }
    if errors:
        out['errors'] = errors
    return out
