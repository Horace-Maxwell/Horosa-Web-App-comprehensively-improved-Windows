# 从历表取「不在盘上的点」(8 颗虚星等)时,按本盘的黄道制与岁差制取 —— 与盘上行星、四轴同一个零点。
# 回归盘:标志与不传时相同,结果逐字节不变。恒星盘:此前不传标志,取回的是回归黄经,与同盘行星整体差一个岁差。
from flatlib.ephem import ephem as flatlib_ephem
from flatlib.ephem import swe


def chart_flags(perchart):
    return getattr(perchart.chart, 'flags', swe.SEDEFAULT_FLAG)


def ephem_object(perchart, oid, date=None, pos=None):
    """按 perchart 的黄道制取一颗历表点;date / pos 缺省用本盘的(戴维森盘传时空中点)。"""
    chart = perchart.chart
    with chart._siderealContext():
        return flatlib_ephem.getObject(oid, date or perchart.dateTime, pos or perchart.pos, flags=chart_flags(perchart))


def ephem_houses(perchart, date, pos, hsys):
    """按 perchart 的黄道制在指定时空起宫(返回 houses, angles)。"""
    chart = perchart.chart
    sid = chart_flags(perchart) & swe.SEFLG_SIDEREAL
    with chart._siderealContext():
        if sid:
            return flatlib_ephem.getHouses(date, pos, hsys, 150, swe.swisseph.FLG_SIDEREAL)
        return flatlib_ephem.getHouses(date, pos, hsys)
