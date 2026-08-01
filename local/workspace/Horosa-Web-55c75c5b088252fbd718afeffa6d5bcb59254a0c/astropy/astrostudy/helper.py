import jsonpickle
import datetime
from flatlib import const

from astrostudy.guostarsect.guostarsect import GuoStarSect

PD_SYNC_REV = 'pd_method_sync_v15'


def includePrimaryDirection(data):
    if data is None:
        return False
    val = data.get('includePrimaryDirection', False)
    if isinstance(val, str):
        return val.strip().lower() in ['1', 'true', 'yes', 'y', 'on']
    return bool(val)


def getPredictivesObj(data, perchart):
    if not ('predictive' in data.keys() and data['predictive']):
        return None

    perpredict = perchart.getPredict()
    predictives = {
        'firdaria': perpredict.getFirdaria(),
        'yearsystem129': perpredict.getYearSystem129()
    }
    if includePrimaryDirection(data):
        predictives['primaryDirection'] = perpredict.getPrimaryDirection()
    return predictives


def getChartDate(date):
    parts = date.split('/')
    if len(parts) == 1:
        parts = date.split('-')
    year = parts[0]
    month = parts[1]
    day = parts[2]
    return '{0}/{1}/{2}'.format(year, month, day)

def getMiddleDate(date1, time1, date2, time2, zone1=None, zone2=None):
    """时间中点(儒略日算术)。
    🔴 旧版三病根:①丢时区——两地钟面时直接平均,时差 13h 的配对中点可偏 6.5h(ASC ~97°);
    ②datetime 承载负年抛 ValueError → BC 盘的时空中点/马克斯盘被上游裸 except 吞成
    「点了没反应」;③fromtimestamp 按服务器本机时区解释,跨 DST 还会漂。
    现实现:两端各按自身 zone 归 UT → 取 JD 中点(分钟级取整,旧格式只有 HH:MM)→ 按
    zone1 口径回落当地。负年沿用「前导负号=负年」编码,swe.julday/revjul 原生支持,
    输入输出同一历法域(proleptic Gregorian,与旧 datetime 域一致)往返闭合。
    zone 缺省(旧调用方兼容)= 两端同区假定,行为等于旧版钟面平均(仅去掉 Date 病根)。"""
    import swisseph as swe

    def _zh(z):
        try:
            s = str(z if z is not None else '+00:00').strip()
            sign = -1.0 if s.startswith('-') else 1.0
            hp = (s.lstrip('+-').split(':') + ['0'])[:2]
            return sign * (float(hp[0]) + float(hp[1]) / 60.0)
        except Exception:
            return 0.0

    def _parts(d, t):
        ds = str(d).strip()
        neg = ds.startswith('-')
        p = ds.lstrip('-').replace('/', '-').split('-')
        tp = (str(t).split(':') + ['0', '0'])[:3]
        return (int(p[0]) * (-1 if neg else 1), int(p[1]), int(p[2]),
                int(tp[0]), int(tp[1]))

    y1, m1, d1, hh1, mi1 = _parts(date1, time1)
    y2, m2, d2, hh2, mi2 = _parts(date2, time2)
    z1, z2 = _zh(zone1), _zh(zone2)
    jd1 = swe.julday(y1, m1, d1, hh1 + mi1 / 60.0 - z1)
    jd2 = swe.julday(y2, m2, d2, hh2 + mi2 / 60.0 - z2)
    jdm = (jd1 + jd2) / 2.0 + z1 / 24.0           # 回落 zone1 当地钟面
    jdm = round(jdm * 1440.0) / 1440.0            # 分钟级取整
    yy, mm, dd, ut = swe.revjul(jdm)
    hh = int(ut + 1e-6)
    mi = int(round((ut - hh) * 60.0))
    if mi == 60:
        yy, mm, dd, ut = swe.revjul(jdm + 30.0 / 86400.0)
        hh = int(ut + 1e-6)
        mi = 0
    return {
        'date': '%04d/%02d/%02d' % (yy, mm, dd),   # 年补零 4 位与 strftime('%Y') 同宽(AD 1-999 中点盘日期串曾缩成 1-3 位)
        'time': '%02d:%02d' % (hh, mi),
        'zone': zone1,
    }

def convertLatStrToDegree(lat):
    # 数值型纬度(十进制度)直接返回;无 n/s 方向字母的十进制字符串亦容错为浮点。
    # 否则 lat.lower()/索引会对地图选点存的浮点经纬度(部分命盘 record lat/lon 为 number)崩溃。
    if isinstance(lat, (int, float)):
        return float(lat)
    latstr = str(lat).lower()
    if ('n' not in latstr) and ('s' not in latstr):
        try:
            return float(latstr)
        except (TypeError, ValueError):
            return 0.0
    positive = 1
    parts = latstr.split('n')
    if len(parts) == 1:
        parts = latstr.split('s')
        positive = -1
    # 标准 度+分/60。原实现 `deg + 1.0/min`(应为 min/60) + else 分支 `*10` 均错
    # ('39n54'→39.0185 而非 39.9),致真太阳时经度差/时空中点盘定位偏。
    # 与前端 AstroHelper.convertLatStrToDegree、perpredict._coreParseCoord 同口径。
    try:
        min = int(parts[1]) if parts[1] else 0
    except ValueError:
        min = 0
    deg = int(parts[0])
    return (deg + min / 60.0) * positive


def convertLonStrToDegree(lon):
    # 数值型经度(十进制度)直接返回;无 e/w 方向字母的十进制字符串亦容错为浮点。
    # 否则 lon.lower()/索引会对地图选点存的浮点经纬度崩溃(合盘「'float' object has no attribute 'lower'」真因)。
    if isinstance(lon, (int, float)):
        return float(lon)
    lonstr = str(lon).lower()
    if ('e' not in lonstr) and ('w' not in lonstr):
        try:
            return float(lonstr)
        except (TypeError, ValueError):
            return 0.0
    positive = 1
    parts = lonstr.split('e')
    if len(parts) == 1:
        parts = lonstr.split('w')
        positive = -1
    # 标准 度+分/60(同 convertLatStrToDegree 的修正,'116e24'→116.4 而非 116.04)。
    try:
        min = int(parts[1]) if parts[1] else 0
    except ValueError:
        min = 0
    deg = int(parts[0])
    return (deg + min / 60.0) * positive

def splitDegree(degree):
    res = []
    deg = int(degree)
    minute = int(round((degree - deg) * 60))
    # 59.99′ 四舍五入到 60 时进位,防序列化出 '39n60' 这类非法分值
    if minute >= 60:
        deg += 1
        minute -= 60
    elif minute <= -60:
        deg -= 1
        minute += 60
    res.append(deg)
    res.append(minute)
    return res

def convertLatToStr(degree):
    deg = splitDegree(degree)
    latdeg = deg[0] if deg[0] >= 0 else -deg[0]
    latmin = deg[1] if deg[1] >= 0 else -deg[1]
    dir = 'n' if deg[0] >= 0 else 's'
    # >= 10:原 `> 10` 把恰好 10 分串成 '010'(3 位),回读解析错位
    latmin = str(latmin) if latmin >= 10 else '0' + str(latmin)
    return str(latdeg) + dir + str(latmin)

def convertLonToStr(degree):
    deg = splitDegree(degree)
    londeg = deg[0] if deg[0] >= 0 else -deg[0]
    lonmin = deg[1] if deg[1] >= 0 else -deg[1]
    dir = 'e' if deg[0] >= 0 else 'w'
    lonmin = str(lonmin) if lonmin >= 10 else '0' + str(lonmin)
    return str(londeg) + dir + lonmin


def getMiddleSpace(lat1, lon1, lat2, lon2):
    latdeg1 = convertLatStrToDegree(lat1)
    londeg1 = convertLonStrToDegree(lon1)
    latdeg2 = convertLatStrToDegree(lat2)
    londeg2 = convertLonStrToDegree(lon2)

    latdeg = (latdeg1 + latdeg2) / 2
    # 经度须取短弧中点(纬度值域 ±90 无回绕语义,直接平均即可)。
    # 🔴 曾直接平均:跨 ±180° 反子午线的配对(如东京+火奴鲁鲁)中点落到地球对侧,
    # 时空中点/马克斯盘 ASC/十二宫整体错误且无报错——组合盘 chartcomposite 早已
    # 做了短弧修正,此处是同型第二份实现漂移。
    d = ((londeg2 - londeg1 + 540.0) % 360.0) - 180.0
    londeg = ((londeg1 + d / 2.0 + 540.0) % 360.0) - 180.0
    obj = {
        'lat': convertLatToStr(latdeg),
        'lon': convertLonToStr(londeg)
    }
    return obj



def getChartObj(data, perchart):
    guostar = GuoStarSect(perchart)

    obj = {
        'params': {
            'birth': perchart.getBirthStr(),
            'ad': -1 if perchart.isBC else 1,
            'lat': data['lat'],
            'lon': data['lon'],
            'hsys': data['hsys'],
            'zone': data['zone'],
            'tradition': perchart.tradition,
            'zodiacal': perchart.zodiacal,
            'siderealAyanamsa': perchart.siderealAyanamsa,
            'doubingSu28': perchart.su28Mode,
            'showPdBounds': data.get('showPdBounds', 1),
            'pdtype': perchart.pdtype,
            'pdMethod': perchart.pdMethod,
            'pdTimeKey': perchart.pdTimeKey,
            'pdSyncRev': PD_SYNC_REV,
        },
        'chart': perchart.getChartObj(),
        'receptions': perchart.getReceptions(),
        'mutuals': perchart.getMutuals(),
        'declParallel': perchart.getParallel(),
        'aspects': {
            'normalAsp': perchart.getAspects(),
            'immediateAsp': perchart.getImmediateAspects(),
            'signAsp': perchart.getSignAspects()
        },
        'lots': perchart.getPars(perchart.chart),
        'surround': {
            'planets': perchart.surroundPlanets(),
            'attacks': perchart.surroundAttacks(),
            'houses': perchart.surroundHouses()
        },
        'guoStarSect': {
            'houses': guostar.allTerm()
        }
    }

    if 'name' in data.keys():
        obj['params']['name'] = data['name']

    # 古典口径键条件回显(请求带了才回显=默认响应字节零变)。
    # 🔴 为什么是全量 22 键而不只界系三键:前端 AstroExtraCommon.chartParams() 从
    # chartObj.params 条件透传这批键给全部派生盘(调波/龙盘/重置/推运族/世俗盘,25+ 调用点),
    # 白名单缺谁,谁在派生链就静默回落后端默认 —— 主盘改「三分集/福点反转/空亡口径/恒星
    # 容许度/文档序反转…」后派生盘全部与主盘分叉,且缓存键同因丢维不重取。
    for _vk in ('termsVariant', 'leoBoundFirst', 'geminiBoundEmended',
                'triplicity', 'lotReversal', 'westNodeType', 'sectBuffer',
                'houseCuspAdvance', 'cazimiOrb', 'combustOrb', 'underBeamsOrb',
                'vocMode', 'vocIncludeOuter', 'starOrb', 'starOrbMode',
                'antisciaOrb', 'viaCombustaVariant',
                'lotsDocReverse', 'nodeExaltation', 'saturnExalt20',
                'orbs', 'orbScale'):
        if data.get(_vk) is not None:
            obj['params'][_vk] = data.get(_vk)

    predictives = getPredictivesObj(data, perchart)
    if predictives is not None:
        obj['predictives'] = predictives

    return obj

def getChartJson(data, perchart):
    obj = getChartObj(data, perchart)
    res = jsonpickle.encode(obj, unpicklable=False)
    return res

def distance(ang1, ang2):
    # 有符号最短弧 ang1-ang2,范围 (-180, 180]。
    # 原实现只在 270°/90° 两个窗口做回绕,中段大分离(如 100,300)返回 -200 而非 +160,
    # 致日返寻根从年初种子倒走、收敛到上一年返照。本式对原正确分支逐值相等,只救中段。
    return (ang1 - ang2 + 180) % 360 - 180

def absDistance(ang1, ang2):
    # ang1 → ang2 的顺行弧长 [0, 360)。原通用分支即此语义,但第二窗口
    # `360-ang2-ang1` 把 +ang1 误写成 -ang1(如 (10,350) 得 0 而非 340),
    # 致月返寻根在该窗口种子步长归零、把种子时间当返照返回。本式对原正确分支逐值相等。
    return (ang2 - ang1) % 360

def isLeap(year):
    if year == 4:
        return False
    if year <= 1582:
        if year % 4 == 0:
            return True
        else:
            return False
    else:
        if year % 4 == 0:
            if year % 400 == 0:
                return True
            if year % 100 == 0:
                return False
            return True
        else:
            return False

def calRealDate(isBC, startDate, endDate):
    res = {
        'isBC': isBC,
        'date': datetime.datetime(endDate.year, endDate.month, endDate.day, endDate.hour, endDate.minute, endDate.second)
    }
    if isBC == False:
        return res

    isNowBC = isBC
    y = startDate.year
    ydelta = endDate.year - y
    m = endDate.month
    d = endDate.day
    date = res['date']
    if ydelta == 0:
        isNowBC = True
    elif ydelta < y:
        ny = endDate.year - y
        if isLeap(ny) == False and m == 2 and d == 29:
            m = 3
            d = 1
        date = datetime.datetime(ny, m, d, endDate.hour, endDate.minute, endDate.second)
        isNowBC = True
    else:
        offdelta = 1 if y == 1 else y + 1
        ny = endDate.year - offdelta
        if isLeap(ny) == False and m == 2 and d == 29:
            m = 3
            d = 1
        date = datetime.datetime(ny, m, d, endDate.hour, endDate.minute, endDate.second)
        isNowBC = False

    res['isBC'] = isNowBC
    res['date'] = date
    return res


def getSignLon(sign):
    idx = const.LIST_SIGNS.index(sign)
    lon = idx * 30
    return lon
