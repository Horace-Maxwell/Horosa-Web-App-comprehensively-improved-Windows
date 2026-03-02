import jsonpickle
import datetime
from flatlib import const

from astrostudy.guostarsect.guostarsect import GuoStarSect


def getChartDate(date):
    parts = date.split('/')
    if len(parts) == 1:
        parts = date.split('-')
    year = parts[0]
    month = parts[1]
    day = parts[2]
    return '{0}/{1}/{2}'.format(year, month, day)

def getMiddleDate(date1, time1, date2, time2):
    parts1 = date1.split('/')
    if len(parts1) == 1:
        parts1 = date1.split('-')
    tmpart1 = time1.split(':')
    parts2 = date2.split('/')
    if len(parts2) == 1:
        parts2 = date2.split('-')
    tmpart2 = time2.split(':')

    dt1 = datetime.datetime(int(parts1[0]),
                           int(parts1[1]),
                           int(parts1[2]),
                           int(tmpart1[0]),
                           int(tmpart1[1]))
    dt2 = datetime.datetime(int(parts2[0]),
                           int(parts2[1]),
                           int(parts2[2]),
                           int(tmpart2[0]),
                           int(tmpart2[1]))
    tm = (dt1.timestamp() + dt2.timestamp()) / 2
    dt = datetime.datetime.fromtimestamp(tm)
    date = dt.strftime('%Y/%m/%d')
    time = dt.strftime('%H:%M')
    obj = {
        'date': date,
        'time': time
    }
    return obj

def convertLatStrToDegree(lat):
    positive = 1
    latstr = lat.lower()
    parts = latstr.split('n')
    if len(parts) == 1:
        parts = latstr.split('s')
        positive = -1
    min = parts[1]
    if len(parts[1]) == 2:
        if parts[1][0:1] == '0':
            min = min[1:3]
        min = int(min)
    else:
        min = int(min) * 10
    deg = int(parts[0])
    if min != 0:
        deg = deg + (1.0 / min)
    return deg * positive


def convertLonStrToDegree(lon):
    positive = 1
    lonstr = lon.lower()
    parts = lonstr.split('e')
    if len(parts) == 1:
        parts = lonstr.split('w')
        positive = -1
    min = parts[1]
    if len(parts[1]) == 2:
        if parts[1][0:1] == '0':
            min = min[1:3]
        min = int(min)
    else:
        min = int(min) * 10
    deg = int(parts[0])
    if min != 0:
        deg = deg + (1.0 / min)
    return deg * positive

def splitDegree(degree):
    res = []
    res.append(int(degree))
    minute = (degree - res[0]) * 60
    res.append(int(round(minute)))
    return res

def convertLatToStr(degree):
    deg = splitDegree(degree)
    latdeg = deg[0] if deg[0] >= 0 else -deg[0]
    latmin = deg[1] if deg[1] >= 0 else -deg[1]
    dir = 'n' if deg[0] >= 0 else 's'
    latmin = str(latmin) if latmin > 10 else '0' + str(latmin)
    return str(latdeg) + dir + str(latmin)

def convertLonToStr(degree):
    deg = splitDegree(degree)
    londeg = deg[0] if deg[0] >= 0 else -deg[0]
    lonmin = deg[1] if deg[1] >= 0 else -deg[1]
    dir = 'e' if deg[0] >= 0 else 'w'
    lonmin = str(lonmin) if lonmin > 10 else '0' + str(lonmin)
    return str(londeg) + dir + lonmin


def getMiddleSpace(lat1, lon1, lat2, lon2):
    latdeg1 = convertLatStrToDegree(lat1)
    londeg1 = convertLonStrToDegree(lon1)
    latdeg2 = convertLatStrToDegree(lat2)
    londeg2 = convertLonStrToDegree(lon2)

    latdeg = (latdeg1 + latdeg2) / 2
    londeg = (londeg1 + londeg2) / 2
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
            'doubingSu28': perchart.isDoubingSu28,
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

    if 'predictive' in data.keys() and data['predictive']:
        perpredict = perchart.getPredict()
        pdlist = perpredict.getPrimaryDirection()
        obj['predictives'] = {
            'primaryDirection': pdlist,
            'firdaria': perpredict.getFirdaria()
        }

    return obj

def getChartJson(data, perchart):
    obj = getChartObj(data, perchart)
    res = jsonpickle.encode(obj, unpicklable=False)
    return res

def distance(ang1, ang2):
    if ang1 >= 270 and ang2 <= 90:
        delta = 360 - ang1 + ang2
        return -delta

    if ang2 >= 270 and ang1 <= 90:
        delta = 360 - ang2 + ang1
        return delta

    return ang1 - ang2

def absDistance(ang1, ang2):
    if ang1 >= 270 and ang2 <= 90:
        delta = 360 - ang1 + ang2
        return delta

    if ang2 >= 270 and ang1 <= 90:
        delta = 360 - ang2 - ang1
        return delta

    if ang1 < ang2:
        return ang2 - ang1
    else:
        return 360 - ang1 + ang2

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


