import copy
import flatlib
import datetime
import math
import traceback
from multiprocessing.dummy import Pool as ThreadPool
from flatlib.datetime import Datetime
from flatlib.geopos import GeoPos
from flatlib.chart import Chart
from flatlib import const
from flatlib import aspects
from flatlib.dignities import essential
from flatlib.dignities import tables
from flatlib.tools.chartdynamics import ChartDynamics
from flatlib import props
from flatlib import utils
from flatlib.tools import arabicparts
from flatlib.ephem import swe
from astrostudy.helper import distance
from astrostudy.jieqi.realsuntime import getOffsetByDate

from astrostudy.perpredict import PerPredict
from astrostudy.guostarsect import guotables

dayerStar = [
    const.SUN,
    const.MOON,
    const.MARS,
    const.MERCURY,
    const.JUPITER,
    const.VENUS,
    const.SATURN,
]

dayofweekStr = [
    '周日', '周一', '周二', '周三', '周四', '周五', '周六',
]

timerStar = [
    const.SATURN,
    const.JUPITER,
    const.MARS,
    const.SUN,
    const.VENUS,
    const.MERCURY,
    const.MOON
]


def excludeBad(x):
    return x != 'exile' and x != 'fall'

def isStrongGood(x):
    return x == 'exalt' or x == 'ruler'

custHouse_Equal_MC_Middle = 'Equal_MC_Middle'

hsys=[
    const.HOUSES_WHOLE_SIGN,
    const.HOUSES_ALCABITUS,
    const.HOUSES_REGIOMONTANUS,
    const.HOUSES_PLACIDUS,
    const.HOUSES_KOCH,
    const.HOUSES_VEHLOW_EQUAL,
    const.HOUSES_POLICH_PAGE,
    const.HOUSES_SRIPATI,
    custHouse_Equal_MC_Middle
]

LOTS = [
    const.PARS_FORTUNA,
    arabicparts.PARS_SPIRIT,
    arabicparts.PARS_FAITH,
    arabicparts.PARS_SUBSTANCE,
    arabicparts.PARS_WEDDING_MALE,
    arabicparts.PARS_WEDDING_FEMALE,
    arabicparts.PARS_SONS,
    arabicparts.PARS_FATHER,
    arabicparts.PARS_MOTHER,
    arabicparts.PARS_BROTHERS,
    arabicparts.PARS_DISEASES,
    arabicparts.PARS_DEATH,
    arabicparts.PARS_TRAVEL,
    arabicparts.PARS_FRIENDS,
    arabicparts.PARS_ENEMIES,
    arabicparts.PARS_SATURN,
    arabicparts.PARS_JUPITER,
    arabicparts.PARS_MARS,
    arabicparts.PARS_VENUS,
    arabicparts.PARS_MERCURY,
    arabicparts.PARS_HORSEMANSHIP,
    arabicparts.PARS_LIFE,
    arabicparts.PARS_RADIX,
]

LIST_OBJECTS_NOCHIRON = [
    const.SUN, const.MOON, const.MERCURY, const.VENUS, const.MARS, const.JUPITER, const.SATURN,
    const.URANUS, const.NEPTUNE, const.PLUTO, const.NORTH_NODE,
    const.SOUTH_NODE, const.SYZYGY, const.PARS_FORTUNA, const.DARKMOON, const.PURPLE_CLOUDS,
]


def getHSys(house):
    if house < 0 or house >= len(hsys):
        return const.HOUSES_WHOLE_SIGN
    return hsys[house]


def takeDelta(obj):
    return obj['delta']

def takeAsp(obj):
    return obj['asp']

def takeRa(obj):
    return obj.ra

def takeDecl(obj):
    return obj.decl

def takeLon(obj):
    return obj.lon

def takeAttackDelta(stars):
    delta = (stars[1]['lon'] - stars[0]['lon'] + 360) % 360
    return delta

class PerChart:

    def __init__(self, data):
        self.data = data

        date = data['date']
        self.time = data['time']
        self.zone = data['zone']
        self.lat = data['lat']
        self.lon = data['lon']

        parts = date.split('/')
        if len(parts) == 1:
            parts = date.split('-')
        if len(parts) == 4:
            self.year = '-{0}'.format(parts[1])
            self.month = parts[2]
            self.day = parts[3]
        else:
            self.year = parts[0]
            self.month = parts[1]
            self.day = parts[2]

        self.date = '{0}/{1}/{2}'.format(self.year, self.month, self.day)

        self.pdaspects = const.MAJOR_ASPECTS
        self.tradition = False
        self.house = const.HOUSES_WHOLE_SIGN
        self.strongRecption = True
        self.virtualPointReceiveAsp = False
        self.simpleAsp = False
        self.pdtype = 0

        self.isBC = False
        if 'ad' in data.keys():
            if int(data['ad']) == 1:
                self.isBC = False
            else:
                self.isBC = True
                if self.date[0:1] != '-':
                    self.date = '-{0}'.format(self.date)
                    self.year = '-{0}'.format(self.year)

        if self.year[0:1] == '-':
            self.isBC = True

        if 'strongRecption' in data.keys():
            self.strongRecption = data['strongRecption']

        if 'virtualPointReceiveAsp' in data.keys():
            self.virtualPointReceiveAsp = data['virtualPointReceiveAsp']
        if 'simpleAsp' in data.keys():
            self.simpleAsp = data['simpleAsp']

        self.houseCust = None
        if 'hsys' in data.keys():
            self.house = getHSys(data['hsys'])
            if self.house == custHouse_Equal_MC_Middle:
                self.house = const.HOUSES_ALCABITUS
                self.houseCust = custHouse_Equal_MC_Middle

        if 'pdaspects' in data.keys():
            self.pdaspects = data['pdaspects']

        self.southchart = False
        if 'southchart' in data.keys():
            self.southchart = data['southchart']

        if 'pdtype' in data.keys():
            self.pdtype = data['pdtype']

        self.zodiacal = const.TROPICAL
        if 'zodiacal' in data.keys():
            if data['zodiacal'] == 1 or data['zodiacal'] == const.SIDEREAL:
                self.zodiacal = const.SIDEREAL

        self.dateTime = Datetime(self.date, self.time, self.zone)
        self.pos = GeoPos(self.lat, self.lon)

        self.objlists = []

        jd = self.dateTime.jd
        if jd > 3419437.5 or jd < 1967601.5:
            self.objlists.extend(LIST_OBJECTS_NOCHIRON)
        else:
            self.objlists.extend(const.LIST_OBJECTS)

        if 'objlists' in data.keys():
            self.objlists = data['objlists']
        objset = set(self.objlists)
        self.hasSun = const.SUN in objset
        self.hasMoon = const.MOON in objset
        if not self.hasMoon:
            self.objlists.append(const.MOON)
        if not self.hasSun:
            self.objlists.append(const.SUN)

        self.eastRa = None
        if 'doubingSu28' in data.keys():
            self.isDoubingSu28 = data['doubingSu28']
        else:
            self.isDoubingSu28 = False

        self.needpars = True
        if 'needpars' in data.keys():
            self.needpars = False

        ids = []
        ids.extend(self.objlists)

        if self.tradition:
            self.chart = Chart(self.dateTime, self.pos, self.zodiacal, hsys=self.house, needpars=self.needpars)
        else:
            self.chart = Chart(self.dateTime, self.pos, self.zodiacal,
                               hsys=self.house, IDs=ids, needpars=self.needpars)
        if const.SATURN in objset and const.MARS in objset and const.JUPITER in objset and const.VENUS in objset:
            self.objlists.extend(const.LIST_MIDDLE_POINTS)

        self.custHouse()

        if self.southchart and self.pos.lat < 0:
            self.setupSouthChart()
        else:
            self.reinit()

    def custHouse(self):
        if self.houseCust == None:
            return

        if self.houseCust == custHouse_Equal_MC_Middle:
            mc = self.chart.getAngle(const.MC)
            startlon = (mc.lon - 15 + 360) % 360
            houses_list = [
                const.HOUSE10, const.HOUSE11, const.HOUSE12,
                const.HOUSE1, const.HOUSE2, const.HOUSE3,
                const.HOUSE4, const.HOUSE5, const.HOUSE6,
                const.HOUSE7, const.HOUSE8, const.HOUSE9
            ]
            for obj in houses_list:
                house = self.chart.getHouse(obj)
                house.relocate(startlon)
                house.size = 30
                house.hsys = custHouse_Equal_MC_Middle
                ra, decl = utils.eqCoords(house.lon, house.lat)
                house.ra = ra
                house.decl = decl
                startlon = (startlon + 30) % 360

    def clone(self, objlists, hid=const.HOUSES_WHOLE_SIGN, needpars=True):
        data = copy.deepcopy(self.data)
        data['objlists'] = objlists
        data['hid'] = hsys.index(hid)
        data['needpars'] = needpars
        perchart = PerChart(data)
        return perchart

    def reinit(self):
        self.orientOccident = None
        self.orientOccidentHouses = None
        self.dynchart = ChartDynamics(self.chart)
        self.dynchart.simpleAsp = self.simpleAsp
        self.setupPlanets()
        self.setupDignities()

    def relocateSouthChart(self, obj):
        lon = (obj.lon + 180) % 360
        obj.relocate(lon)

    def relocateSouthObjects(self, objs):
        if (not self.southchart) or self.pos.lat >= 0:
            return

        pool = ThreadPool(8)
        results = pool.map(self.relocateSouthChart, objs)
        pool.close()
        pool.join()

    def setupSouthChart(self):
        if (not self.southchart) or self.pos.lat >= 0:
            return

        self.relocateSouthObjects(self.chart.houses)
        self.relocateSouthObjects(self.chart.angles)
        self.relocateSouthObjects(self.chart.objects)
        self.relocateSouthObjects(self.chart.pars)

        self.reinit()


    def setupSpecial(self, star):
        if 208 <= star.lon < 217:
           star.isViaCombust = True
        if 178 <= star.lon < 186:
            star.isViaRepression = True

    def setupPlanets(self):
        self.isDiurnal = self.chart.isDiurnal()
        suobjs = const.LIST_OBJECTS_TRADITIONAL.copy()
        objs = const.LIST_OBJECTS_TRADITIONAL
        planets = const.LIST_SEVEN_PLANETS.copy()
        if not self.tradition:
            planets.append(const.URANUS)
            planets.append(const.NEPTUNE)
            planets.append(const.PLUTO)
            objs = self.objlists
            suobjs = self.objlists.copy()

        asc = self.chart.getAngle(const.ASC)
        ascsign = asc.sign
        sidx = const.LIST_SIGNS.index(ascsign)

        suobjs.extend(const.LIST_ANGLES)
        for obj in suobjs:
            planet = self.chart.get(obj)
            term = guotables.TERM_SU27[planet.sign]
            for pos in term:
                if pos[1] <= planet.signlon < pos[2]:
                    planet.su = pos[0]
                    break

        for obj in const.LIST_ANGLES:
            angle = self.chart.get(obj)
            antipnt = angle.antiscia()
            cantipnt = angle.cantiscia()
            angle.antisciaPoint = {
                'sign': antipnt.sign,
                'signlon': antipnt.signlon,
                'lon': antipnt.lon
            }
            angle.cantisciaPoint = {
                'sign': cantipnt.sign,
                'signlon': cantipnt.signlon,
                'lon': cantipnt.lon
            }
            house = self.chart.houses.getHouseByLon(angle.lon)
            angle.house = house.id
            self.setupSpecial(angle)

        for obj in const.LIST_HOUSES:
            house = self.chart.getHouse(obj)
            house.planets = []
            house.exalt = None

        for obj in objs:
            planet = self.chart.get(obj)
            self.setupSpecial(planet)
            planet.movedir = planet.movement()
            antipnt = planet.antiscia()
            cantipnt = planet.cantiscia()
            planet.antisciaPoint = {
                'sign': antipnt.sign,
                'signlon': antipnt.signlon,
                'lon': antipnt.lon
            }
            planet.cantisciaPoint = {
                'sign': cantipnt.sign,
                'signlon': cantipnt.signlon,
                'lon': cantipnt.lon
            }
            planethouse = self.chart.houses.getHouseByLon(planet.lon)
            planet.house = planethouse.id
            if obj in props.object.meanMotion.keys():
                planet.meanSpeed = planet.meanMotion()
                self.hayyiz(planet, self.isDiurnal)

            if obj not in planets:
                continue

            planet.ruleHouses = []
            i = 0
            for elm in range(sidx, sidx + 12):
                sign = const.LIST_SIGNS[elm % 12]
                ruler = tables.ESSENTIAL_DIGNITIES[sign]['ruler']
                exalt = tables.ESSENTIAL_DIGNITIES[sign]['exalt'][0]
                houseid = const.LIST_HOUSES[i]
                house = self.chart.getHouse(houseid)
                if exalt == obj:
                    planet.exaltHouse = houseid
                    house.exalt = obj
                if ruler == obj:
                    planet.ruleHouses.append(houseid)
                    house.ruler = obj
                if planethouse.id == houseid:
                    house.planets.append(obj)

                i = i +1

    def setupDignities(self):
        res = {}
        planets = const.LIST_SEVEN_PLANETS.copy()
        if not self.tradition:
            planets.append(const.URANUS)
            planets.append(const.NEPTUNE)
            planets.append(const.PLUTO)

        sun = self.chart.get(const.SUN)
        signplanets = {}
        for obj in planets:
            try:
                pla = self.chart.getObject(obj)
            except:
                continue
            if pla.sign not in signplanets.keys():
                signplanets[pla.sign] = []
            signplanets[pla.sign].append(obj)

        for itemA in planets:
            try:
                obj = self.chart.get(itemA)
            except:
                continue
            dig = essential.getInfo(obj.sign, obj.signlon)
            govidx = (const.LIST_SIGNS.index(obj.sign) - 3 + len(const.LIST_SIGNS)) % len(const.LIST_SIGNS)
            govsign = const.LIST_SIGNS[govidx]
            govplanets = []
            if govsign in signplanets.keys():
                govplanets = signplanets[govsign]

            obj.score = essential.score(itemA, obj.sign, obj.signlon)
            obj.dignities = dig
            obj.selfDignity = self.takePlanetDignity(itemA, dig)
            obj.isPeregrining = essential.isPeregrine(itemA, obj.sign, obj.signlon)
            obj.governSign = govsign
            obj.governPlanets = govplanets
            if itemA == const.MOON:
                obj.isVOC = self.dynchart.isVOC(itemA)
                obj.moonPhase = self.chart.getMoonPhase()

    def takePlanetDignity(self, planetId, dignities):
        res = []
        if dignities['ruler'] == planetId:
            res.append('ruler')
        if dignities['exalt'] == planetId:
            res.append('exalt')
        if dignities['dayTrip'] == planetId:
            res.append('dayTrip')
        if dignities['nightTrip'] == planetId:
            res.append('nightTrip')
        if dignities['partTrip'] == planetId:
            res.append('partTrip')
        if dignities['term'] == planetId:
            res.append('term')
        if dignities['face'] == planetId:
            res.append('face')
        if dignities['fall'] == planetId:
            res.append('fall')
        if dignities['exile'] == planetId:
            res.append('exile')

        return res


    def getChart(self):
        return self.chart

    def getChartObj(self):
        chart = self.chart
        houses = []
        objs = []
        for key in chart.houses.content.keys():
            houses.append(chart.houses.content[key])
        for key in chart.objects.content.keys():
            if (key == const.SUN and not self.hasSun) or (key == const.MOON and not self.hasMoon):
                continue
            objs.append(chart.objects.content[key])
        for key in chart.angles.content.keys():
            objs.append(chart.angles.content[key])

        houses.sort(key=takeLon)
        objs.sort(key=takeLon)

        res = {
            'zodiacal': self.zodiacal,
            'date': self.chart.orgdate,
            'geo': self.chart.pos,
            'hsys': self.house,
            'houses': houses,
            'objects': objs,
            'isDiurnal': self.isDiurnal,
            'antiscias': self.getAntiscia(),
            'stars': self.getStars(),
            'orientOccident': self.orientalOccidental(),
            'fixedStarSu28': self.getFixedStarSu28(),
            'fixedStars': self.getFixedStars(),
            'signsRA': self.getSignsRA(),
            'signsRaDoubingSu28': self.getDoubingSu28SignsRA(),
            'su28Adjust': self.getAdjustFixedStarSu28(),
            'su28Virtual': self.getVirtualFixedStarSu28(),
            'beidou': self.getBeiDou(),
            'beiji': self.getBeiJi(),
            'timerStar': self.getTimerStar(),
            'dayerStar': self.getDayerStar(),
            'dayofweek': dayofweekStr[self.dateTime.date.dayofweek()],
            'sunRiseTime': self.getSunRiseTime()['timeStr'],
        }
        return res

    def getDoubingSu28SignsRA(self):
        res = []
        if not self.isDoubingSu28:
            return res

        deg = (self.eastRa - 225 + 360) % 360
        for i in range(12):
            sigid = const.LIST_SIGNS[i]
            sig = {
                'id': sigid,
                'ra': (deg + i * 30) % 360,
                'decl': 0
            }
            res.append(sig)
        return res

    def getSignsRA(self):
        res = []
        for i in range(12):
            sigid = const.LIST_SIGNS[i]
            deg = i * 30
            sig = {
                'id': sigid,
                'ra': deg,
                'decl': 0
            }
            res.append(sig)
        return res

    def getChartOnlyObj(self):
        chart = self.chart
        houses = []
        objs = []
        for key in chart.houses.content.keys():
            houses.append(chart.houses.content[key])
        for key in chart.objects.content.keys():
            if (key == const.SUN and not self.hasSun) or (key == const.MOON and not self.hasMoon):
                continue
            objs.append(chart.objects.content[key])
        for key in chart.angles.content.keys():
            objs.append(chart.angles.content[key])

        houses.sort(key=takeLon)
        objs.sort(key=takeLon)

        res = {
            'hsys': self.house,
            'houses': houses,
            'objects': objs,
            'isDiurnal': self.isDiurnal
        }
        return res

    def getPredict(self):
        return PerPredict(self)


    def getReceptions(self):
        res = {
            'normal': [],
            'abnormal': []
        }
        planets = const.LIST_SEVEN_PLANETS.copy()
        if self.tradition == False:
            planets.append(const.URANUS)
            planets.append(const.NEPTUNE)
            planets.append(const.PLUTO)

        for itemA in planets:
            for itemB in planets:
                if itemA != itemB:
                    try:
                        planetB = self.chart.getObject(itemB)
                        rec = self.dynchart.receives(itemA, itemB)
                    except:
                        continue
                    if len(rec) > 0:
                        filter_ = ['exile', 'fall']
                        list = []
                        for ele in rec:
                            if ele not in filter_:
                                list.append(ele)

                        dig = planetB.selfDignity
                        if ('exalt' in list or 'ruler' in list) or (len(list) > 1 and self.strongRecption == False):
                            obj = {
                                'beneficiary': itemB,
                                'supplier': itemA,
                                'beneficiaryDignity': dig,
                                'supplierRulerShip': rec
                            }
                            if 'exile' in dig or 'fall' in dig:
                                res['abnormal'].append(obj)
                            else:
                                res['normal'].append(obj)

        return res

    def getMutuals(self):
        res = []
        planets = const.LIST_SEVEN_PLANETS.copy()
        if self.tradition == False:
            planets.append(const.URANUS)
            planets.append(const.NEPTUNE)
            planets.append(const.PLUTO)

        for itemA in planets:
            for itemB in planets:
                if itemA != itemB:
                    flag = False
                    for obj in res:
                        if itemA in obj['mutual'] and itemB in obj['mutual']:
                            flag = True
                            break
                    if flag:
                        continue
                    try:
                        orgab = self.dynchart.inDignities(itemA, itemB)
                        orgba = self.dynchart.inDignities(itemB, itemA)
                        ablist = list(filter(excludeBad, orgab))
                        balist = list(filter(excludeBad, orgba))
                        abgood = list(filter(isStrongGood, ablist))
                        bagood = list(filter(isStrongGood, balist))
                        if self.strongRecption:
                            if len(abgood) > 0 and len(bagood) > 0:
                                obj = {
                                    'mutual': [itemA, itemB],
                                    'dignity': [balist, ablist]
                                }
                                res.append(obj)
                        elif (len(ablist) > 1 and len(balist) > 1) or (len(abgood) > 0 and len(bagood) > 0) \
                                or (len(abgood) > 0 and len(balist) > 1) or (len(ablist) > 1 and len(bagood) > 0):
                            obj = {
                                'mutual': [itemA, itemB],
                                'dignity': [orgba, orgab]
                            }
                            res.append(obj)
                    except:
                        continue

        mobj = {
            'normal': [],
            'abnormal': []
        }
        for elm in res:
            elmobj = {
                'planetA': {
                    'id': elm['mutual'][0],
                    'rulerShip': elm['dignity'][0]
                },
                'planetB': {
                    'id': elm['mutual'][1],
                    'rulerShip': elm['dignity'][1]
                }
            }
            foundabnormal = False
            for elmdig in elm['dignity'][0]:
                if elmdig == 'exile' or elmdig == 'fall':
                    foundabnormal = True
                    break
            for elmdig in elm['dignity'][1]:
                if elmdig == 'exile' or elmdig == 'fall':
                    foundabnormal = True
                    break
            if foundabnormal:
                mobj['abnormal'].append(elmobj)
            else:
                mobj['normal'].append(elmobj)

        return mobj

    def getImmediateAspects(self):
        virPoints = const.LIST_VIRTUAL_POINTS
        res = {}
        planets = const.LIST_OBJECTS_TRADITIONAL
        if self.tradition == False:
            planets = self.objlists

        asplist = const.MAJOR_ASPECTS
        excludeVirpnt = not self.virtualPointReceiveAsp
        for itemA in planets:
            if not self.virtualPointReceiveAsp and itemA in virPoints:
                continue
            try:
                asp = self.dynchart.immediateAspects(itemA, asplist, excludeVirpnt)
                if asp[0] != None and asp[1] != None:
                    res[itemA] = asp
            except:
                continue
        return res


    def getAspects(self):
        virPoints = const.LIST_VIRTUAL_POINTS.copy()
        virPoints.extend(arabicparts.LIST_PARS)
        res = {}
        planets = const.LIST_OBJECTS_TRADITIONAL
        if self.tradition == False:
            planets = self.objlists
        planets = planets.copy()
        planets.extend(const.LIST_ANGLES)
        planets.extend(arabicparts.LIST_PARS)
        planets.extend(const.LIST_MIDDLE_POINTS)

        asplist = const.MAJOR_ASPECTS.copy()
        asplist.append(45)
        excludeVirpnt = not self.virtualPointReceiveAsp
        for itemA in planets:
            if not self.virtualPointReceiveAsp and itemA in virPoints:
                continue
            try:
                item = self.chart.get(itemA)
            except:
                continue
            if item.type == const.OBJ_ARABIC_PART:
                continue

            asp = self.dynchart.aspectsByCat(itemA, asplist, excludeVirpnt)
            asp['Obvious'] = []
            for obj in asp['Exact']:
                asp['Obvious'].append(obj)
                if itemA == const.SUN and obj['asp'] == 0:
                    try:
                        plobj = self.chart.get(obj['id'])
                    except:
                        continue
                    if obj['orb'] < 17/60:
                        plobj.sunPos = 'Cazimi'
                    elif 17/60 <= obj['orb'] < 8.5:
                        plobj.sunPos = 'Combust'
                    elif 8.5 <= obj['orb'] < 17:
                        plobj.sunPos = 'Sunbeams'

            for obj in asp['Applicative']:
                if obj['orb'] <= aspects.MAX_MINOR_ASP_ORB:
                    asp['Obvious'].append(obj)
                if itemA == const.SUN and obj['asp'] == 0:
                    try:
                        plobj = self.chart.get(obj['id'])
                    except:
                        continue
                    if obj['orb'] < 17 / 60:
                        plobj.sunPos = 'Cazimi'
                    elif 17 / 60 <= obj['orb'] < 8.5:
                        plobj.sunPos = 'Combust'
                    elif 8.5 <= obj['orb'] < 17:
                        plobj.sunPos = 'Sunbeams'

            for obj in asp['None']:
                if obj['orb'] <= aspects.MAX_MINOR_ASP_ORB:
                    asp['Obvious'].append(obj)
                if itemA == const.SUN and obj['asp'] == 0:
                    try:
                        plobj = self.chart.get(obj['id'])
                    except:
                        continue
                    if obj['orb'] < 17/60:
                        plobj.sunPos = 'Cazimi'
                    elif 17/60 <= obj['orb'] < 8.5:
                        plobj.sunPos = 'Combust'
                    elif 8.5 <= obj['orb'] < 17:
                        plobj.sunPos = 'Sunbeams'

            for obj in asp['Separative']:
                if obj['orb'] <= aspects.MAX_MINOR_ASP_ORB:
                    asp['Obvious'].append(obj)
                if itemA == const.SUN and obj['asp'] == 0:
                    try:
                        plobj = self.chart.get(obj['id'])
                    except:
                        continue
                    if obj['orb'] < 17/60:
                        plobj.sunPos = 'Cazimi'
                    elif 17/60 <= obj['orb'] < 8.5:
                        plobj.sunPos = 'Combust'
                    elif 8.5 <= obj['orb'] < 17:
                        plobj.sunPos = 'Sunbeams'

            res[itemA] = asp


        return res

    def getSimpleAspect(self):
        pass

    def _getSameSignlonObj(self, planets, obj):
        res = []
        for planet in planets:
            if planet != obj.id:
                cmpobj = self.chart.getObject(planet)
                if cmpobj.sign == obj.sign and (abs(cmpobj.signlon - obj.signlon) < 1):
                    res.append(cmpobj)
        for angle in const.LIST_ANGLES:
            cmpobj = self.chart.getAngle(angle)
            if cmpobj.sign == obj.sign and (abs(cmpobj.signlon - obj.signlon) < 1):
                res.append(cmpobj)
        if len(res) > 0:
            return res
        return None

    def getAntiscia(self):
        ares = []
        cares = []
        planets = const.LIST_OBJECTS_TRADITIONAL
        if self.tradition == False:
            planets = self.objlists

        for item in planets:
            planet = self.chart.getObject(item)
            obj = planet.antiscia()
            cobj = planet.cantiscia()
            anti = self._getSameSignlonObj(planets, obj)
            canti = self._getSameSignlonObj(planets, cobj)
            if anti != None:
                flag = True
                for tmp in ares:
                    if item in tmp:
                        flag = False
                        break
                if flag:
                    for antiobj in anti:
                        ares.append([item, antiobj.id, abs(antiobj.signlon - obj.signlon)])

            if canti != None:
                flag = True
                for tmp in cares:
                    if item in tmp:
                        flag = False
                        break
                if flag:
                    for cantiobj in canti:
                        cares.append([item, cantiobj.id, abs(cantiobj.signlon - obj.signlon)])


        res = {
            'antiscia': ares,
            'cantiscia': cares
        }

        return res

    def getStars(self):
        res = []
        planets = const.LIST_OBJECTS_TRADITIONAL
        if self.tradition == False:
            planets = self.objlists
        planets = planets.copy()
        planets.extend(const.LIST_ANGLES)
        stars = self.chart.getFixedStars()
        self.relocateSouthObjects(stars)
        for planet in planets:
            fixstars = {
                'id': planet,
                'stars': []
            }
            for star in stars:
                plaObj = self.chart.get(planet)
                delta = abs(plaObj.lon - star.lon)
                if delta < 1:
                    obj = [star.id, star.sign, star.signlon, delta, star.name]
                    fixstars['stars'].append(obj)
            res.append(fixstars)
        return res

    def surroundPlanet(self, planet):
        oc = self.orientalOccidental()
        ocary = oc[planet.id]
        if len(ocary['occidental']) == 0 or len(ocary['oriental']) == 0:
            return []

        firstOcci = ocary['occidental'][0]
        firstOrient = ocary['oriental'][0]
        if firstOcci['delta'] + firstOrient['delta'] > 90:
            return []

        res = [firstOrient, firstOcci]
        return res


    def surroundSun(self):
        sun = self.chart.getObject(const.SUN)
        return self.surroundPlanet(sun)

    def surroundMoon(self):
        moon = self.chart.getObject(const.MOON)
        return self.surroundPlanet(moon)

    def surroundPlanets(self):
        res = {}
        res[const.SUN] = []
        res[const.MOON] = []
        res['BySunMoon'] = None

        planets = const.LIST_SEVEN_PLANETS.copy()
        # if self.tradition == False:
        #     planets.append(const.URANUS)
        #     planets.append(const.NEPTUNE)
        #     planets.append(const.PLUTO)

        for obj in planets:
            try:
                planet = self.chart.getObject(obj)
            except:
                continue
            surobj = self.surroundPlanet(planet)
            if len(surobj) == 0:
                continue

            if obj == const.SUN or obj == const.MOON:
                res[obj] = surobj
            elif (surobj[0]['id'] == const.SUN and surobj[1]['id'] == const.MOON) or (surobj[1]['id'] == const.SUN and surobj[0]['id'] == const.MOON):
                res[obj] = {
                    'id': obj,
                    'SunMoon': surobj
                }

        return res

    def getSign(self, obj, asp):
        lon = obj.lon + asp
        lon = lon if lon >= 0 else 360 + lon
        lon = lon % 360
        idx = int(lon / 30)
        signlon = lon % 30
        return {
            'sign': const.LIST_SIGNS[idx],
            'signlon': signlon
        }

    def surroundAttack(self, planet):
        aspectlist = [-120, -90, -60, 0, 60, 90, 120, 180]
        alltmp = []
        planets = const.LIST_SEVEN_PLANETS.copy()
        # if self.tradition == False:
        #     planets.append(const.URANUS)
        #     planets.append(const.NEPTUNE)
        #     planets.append(const.PLUTO)

        orb = 27
        edgeOrb = 7

        for objA in planets:
            if objA == planet.id:
                continue
            try:
                planetA = self.chart.getObject(objA)
            except:
                continue
            edgeOrbA = props.object.orb[planetA.id]
            for aspA in aspectlist:
                sigA = self.getSign(planetA, aspA)
                pntA = (planetA.lon + aspA + 360) % 360
                deltaA = (pntA - planet.lon + 360) % 360
                deltaA = deltaA if deltaA <= 180 else 360 - deltaA
                if deltaA > orb:
                    continue

                for objB in planets:
                    if objA == objB or objB == planet.id:
                        continue
                    try:
                        planetB = self.chart.getObject(objB)
                    except:
                        continue
                    edgeOrbB = props.object.orb[planetB.id]
                    orb = edgeOrbA + edgeOrbB
                    for aspB in aspectlist:
                        sigB = self.getSign(planetB, aspB)
                        pntB = (planetB.lon + aspB + 360) % 360
                        deltaB = (pntB - planet.lon + 360) % 360
                        deltaB = deltaB if deltaB <= 180 else 360 - deltaB
                        if deltaA > orb or deltaA > orb:
                            continue

                        deltaAB = (pntA - pntB + 360) % 360
                        deltaAB = deltaAB if deltaAB <= 180 else 360 - deltaAB
                        if deltaAB <= orb and deltaA <= edgeOrbA and deltaB <= edgeOrbB:
                            congPnt = (planet.lon + 180) % 360
                            if (pntA <= planet.lon <= pntB <= congPnt or congPnt <= pntA <= planet.lon <= pntB) or (360-orb <= pntA <= planet.lon <= 360 and 0<= pntB <= orb) or (360-orb <= pntA and 0<= planet.lon <=pntB <= orb):
                                atk = [{
                                    'aspect': aspA,
                                    'id': objA,
                                    'lon': pntA,
                                    'sign': sigA['sign'],
                                    'signlon': sigA['signlon'],
                                    'delta': deltaA
                                }, {
                                    'aspect': aspB,
                                    'id': objB,
                                    'lon': pntB,
                                    'sign': sigB['sign'],
                                    'signlon': sigB['signlon'],
                                    'delta': deltaB
                                }]
                                alltmp.append(atk)
                            elif (pntB <= planet.lon <= pntA <= congPnt or congPnt <= pntB <= planet.lon <= pntA) or (360-orb <= pntB <=planet.lon <= 360 and 0<= pntA <= orb) or (360-orb <= pntB and 0<= planet.lon <=pntA <= orb):
                                atk = [{
                                    'aspect': aspB,
                                    'id': objB,
                                    'lon': pntB,
                                    'sign': sigB['sign'],
                                    'signlon': sigB['signlon'],
                                    'delta': deltaB
                                }, {
                                    'aspect': aspA,
                                    'id': objA,
                                    'lon': pntA,
                                    'sign': sigA['sign'],
                                    'signlon': sigA['signlon'],
                                    'delta': deltaA
                                }]
                                alltmp.append(atk)

        alltmp.sort(key=takeAttackDelta)

        sunMoon = []
        venusJupiter = []
        marsSaturn = []
        for elm in alltmp:
            obj0 = elm[0]
            obj1 = elm[1]
            if (obj0['id'] == const.SUN and obj1['id'] == const.MOON) or (obj0['id'] == const.MOON and obj1['id'] == const.SUN):
                sunMoon = elm
            elif (obj0['id'] == const.VENUS and obj1['id'] == const.JUPITER) or (obj0['id'] == const.JUPITER and obj1['id'] == const.VENUS):
                venusJupiter = elm
            elif (obj0['id'] == const.MARS and obj1['id'] == const.SATURN) or (obj0['id'] == const.SATURN and obj1['id'] == const.MARS):
                marsSaturn = elm

        return {
            'SunMoon': sunMoon,
            'VenusJupiter': venusJupiter,
            'MarsSaturn': marsSaturn,
            'MinDelta': [] if len(alltmp) == 0 else alltmp[0]
        }

    def surroundAttacks(self):
        res = {}
        planets = const.LIST_SEVEN_PLANETS.copy()
        # if self.tradition == False:
        #     planets.append(const.URANUS)
        #     planets.append(const.NEPTUNE)
        #     planets.append(const.PLUTO)

        for obj in planets:
            try:
                planet = self.chart.get(obj)
            except:
                continue
            atk = self.surroundAttack(planet)
            if len(atk['SunMoon']) > 0 or len(atk['VenusJupiter']) > 0 or len(atk['MarsSaturn']) > 0 or len(atk['MinDelta']) > 0:
                res[obj] = atk

        return res


    def surroundHouse(self, houseid):
        oc = self.orientalOccidentalHouses()
        ocary = oc[houseid]
        if len(ocary['occidental']) == 0 or len(ocary['oriental']) == 0 or len(ocary['inHouse']) > 0:
            return []

        idx = const.LIST_HOUSES.index(houseid)
        prevIdx = (12 + idx - 1) % 12
        nextIdx = (12 + idx + 1) % 12
        house = self.chart.getHouse(houseid)
        prevH = self.chart.getHouse(const.LIST_HOUSES[prevIdx])
        nextH = self.chart.getHouse(const.LIST_HOUSES[nextIdx])
        firstOcci = ocary['occidental'][0]
        firstOrient = ocary['oriental'][0]
        if firstOcci['delta'] > house.size + nextH.size or firstOrient['delta'] > prevH.size:
            return []

        res = [{
            'id': firstOrient['id'],
            'delta': firstOrient['delta']
        }, {
            'id': firstOcci['id'],
            'delta': firstOcci['delta'] - house.size
        }]
        return res



    def surroundHouses(self):
        res = {}
        for obj in const.LIST_HOUSES:
            houseRes = self.surroundHouse(obj)
            if len(houseRes) == 0:
                continue
            res[obj] = houseRes

        return res

    def orientalOccidental(self):
        if self.orientOccident != None:
            return self.orientOccident

        res = {}
        planets = const.LIST_SEVEN_PLANETS.copy()
        # if self.tradition == False:
        #     planets.append(const.URANUS)
        #     planets.append(const.NEPTUNE)
        #     planets.append(const.PLUTO)

        for obj in planets:
            try:
                planet = self.chart.getObject(obj)
            except:
                continue
            pntA = planet.lon
            pntB = pntA + 180 if pntA <= 180 else pntA - 180
            res[obj] = {
                'oriental': [],
                'occidental': []
            }
            for elm in planets:
                if obj == elm:
                    continue
                try:
                    planetB = self.chart.getObject(elm)
                except:
                    continue
                if (pntB < planetB.lon < pntA) or (0<= planetB.lon < pntA and pntB > 180) or (pntB > 180 and planetB.lon > pntB):
                    delta = planet.lon - planetB.lon
                    delta = delta if delta >= 0 else delta + 360
                    res[obj]['oriental'].append({
                        'id': elm,
                        'delta': delta
                    })
                else:
                    delta = planetB.lon - planet.lon
                    delta = delta if delta >= 0 else delta + 360
                    res[obj]['occidental'].append({
                        'id': elm,
                        'delta': delta
                    })
            res[obj]['oriental'].sort(key=takeDelta)
            res[obj]['occidental'].sort(key=takeDelta)

        self.orientOccident = res
        return res

    def orientalOccidentalHouses(self):
        if self.orientOccidentHouses != None:
            return self.orientOccidentHouses

        res = {}
        planets = const.LIST_SEVEN_PLANETS.copy()
        # if self.tradition == False:
        #     planets.append(const.URANUS)
        #     planets.append(const.NEPTUNE)
        #     planets.append(const.PLUTO)

        for obj in const.LIST_HOUSES:
            house = self.chart.get(obj)
            pntA = house.lon
            pntB = pntA + 180 if pntA <= 180 else pntA - 180
            res[obj] = {
                'inHouse': [],
                'oriental': [],
                'occidental': []
            }
            for elm in planets:
                try:
                    planetB = self.chart.getObject(elm)
                except:
                    continue
                if elm in house.planets:
                    res[obj]['inHouse'].append({
                        'id': elm,
                        'delta': planetB.lon - house.lon
                    })
                    continue
                if (pntB < planetB.lon < pntA) or (0<= planetB.lon < pntA and pntB > 180) or (pntB > 180 and planetB.lon > pntB):
                    delta = house.lon - planetB.lon
                    delta = delta if delta >= 0 else delta + 360
                    res[obj]['oriental'].append({
                        'id': elm,
                        'delta': delta
                    })
                else:
                    delta = planetB.lon - house.lon
                    delta = delta if delta >= 0 else delta + 360
                    res[obj]['occidental'].append({
                        'id': elm,
                        'delta': delta
                    })
            res[obj]['inHouse'].sort(key=takeDelta)
            res[obj]['oriental'].sort(key=takeDelta)
            res[obj]['occidental'].sort(key=takeDelta)

        self.orientOccidentHouses = res
        return res

    def getSignAspects(self):
        res = {}
        planets = const.LIST_SEVEN_PLANETS.copy()
        if self.tradition == False:
            planets.append(const.URANUS)
            planets.append(const.NEPTUNE)
            planets.append(const.PLUTO)

        for objA in planets:
            try:
                planetA = self.chart.getObject(objA)
            except:
                continue
            signIdxA = const.LIST_SIGNS.index(planetA.sign)

            res[objA] = []
            for objB in planets:
                if objA == objB:
                    continue
                try:
                    planetB = self.chart.getObject(objB)
                except:
                    continue
                signIdxB = const.LIST_SIGNS.index(planetB.sign)
                delta = signIdxA - signIdxB
                delta = delta if delta >= 0 else delta + 12
                if delta == 0:
                    res[objA].append({
                        'asp': 0,
                        'id': objB
                    })
                elif delta == 2:
                    res[objA].append({
                        'asp': 60,
                        'id': objB
                    })
                elif delta == 3:
                    res[objA].append({
                        'asp': 90,
                        'id': objB
                    })
                elif delta == 4:
                    res[objA].append({
                        'asp': 120,
                        'id': objB
                    })
                elif delta == 6:
                    res[objA].append({
                        'asp': 180,
                        'id': objB
                    })
                elif delta == 8:
                    res[objA].append({
                        'asp': 120,
                        'id': objB
                    })
                elif delta == 8:
                    res[objA].append({
                        'asp': 120,
                        'id': objB
                    })
                elif delta == 9:
                    res[objA].append({
                        'asp': 90,
                        'id': objB
                    })
                elif delta == 10:
                    res[objA].append({
                        'asp': 60,
                        'id': objB
                    })
            res[objA].sort(key=takeAsp)

        return res

    def getBirthStr(self):
        str = '{0}-{1}-{2} {3}'.format(self.year, self.month, self.day, self.time)
        return str

    def isAboveHorizon(self, planet):
        mc = self.chart.getAngle(const.MC)

        # Get ecliptical positions and check if the
        # planet is above the horizon.
        lat = self.chart.pos.lat
        mcRA, mcDecl = utils.eqCoords(mc.lon, 0)
        return utils.isAboveHorizon(planet.ra, planet.decl, mcRA, lat)

    def hayyiz(self, planet, isDiunal):
        """
        计算得时失时
        :param planet:
        :param isDiunal:
        :return:
        """
        res = 'None'
        planet.aboveHorizon = self.isAboveHorizon(planet)
        if planet.id in const.LIST_SEVEN_PLANETS:
            if planet.aboveHorizon:
                fact = planet.faction()
                sigidx = const.LIST_SIGNS.index(planet.sign)
                if isDiunal and fact == const.DIURNAL:
                    if sigidx % 2 == 0:
                        res = 'Hayyiz'
                elif isDiunal == False and fact == const.DIURNAL and sigidx % 2 == 1:
                    res = 'InWrongPos'
                elif isDiunal == False and fact == const.NOCTURNAL:
                    if planet.id == const.MARS:
                        if sigidx % 2 == 0:
                            res = 'Hayyiz'
                        else:
                            res = 'DemiHayyiz'
                    else:
                        if sigidx % 2 == 1:
                            res = 'Hayyiz'
                elif isDiunal and fact == const.NOCTURNAL and sigidx % 2 == 0:
                    res = 'InWrongPos'
        planet.hayyiz = res
        return res

    def getPars(self, chart):
        res = []
        for par in chart.pars:
            res.append(par)
        return res

    def getPar(self, lotId):
        return self.chart.get(lotId)

    def getFixedStarSu28ByDouBing(self):
        from astrostudy.guostarsect.guo74 import Guo74
        g74 = Guo74(self)
        res = g74.compute()
        self.relocateSouthObjects(res)
        res.sort(key=takeRa)
        return res

    def getVirtualFixedStarSu28(self):
        from astrostudy.guostarsect.guo74 import Guo74
        g74 = Guo74(self)
        res = g74.virtualSu28()
        self.relocateSouthObjects(res)
        res.sort(key=takeRa)
        return res


    def getAdjustFixedStarSu28(self):
        stars = self.chart.getFixedStartsSu28()
        self.relocateSouthObjects(stars)
        res = []
        delta = 0.004
        y = int(self.year)
        for id in const.LIST_FIXED_SU28:
            star = stars.content[id]
            ra = star.ra

            if star.id == const.START_WEI:
                if y <= 2000:
                    ra = ra - 0.000053625*(y + 2000) - 1.4175
                else:
                    ra = ra - 0.00003*(y - 2000) - 1.632
                star.ra = ra
            elif star.id == const.START_GUI:
                if y <= 2000:
                    ra = ra - 0.000255*(y + 2000) + 0.7425
                else:
                    ra = ra - 0.0001725*(y - 2000) - 0.2775
                star.ra = ra

            if 90 <= star.ra < 270:
                star.ra = star.ra - delta
            else:
                star.ra = star.ra + delta

            res.append(star)
        res.sort(key=takeRa)
        return res

    def getFixedStarSu28(self):
        if self.isDoubingSu28:
            return self.getFixedStarSu28ByDouBing()

        res = self.getAdjustFixedStarSu28()

        obj = const.LIST_ALL_POINTS
        for id in obj:
            try:
                planet = self.chart.get(id)
                self.setPlanetSu28(res, planet)
            except:
                continue

        return res

    def getFixedStars(self):
        stars = self.chart.getFixedStars()
        self.relocateSouthObjects(stars)
        res = []
        for id in const.LIST_FIXED_STARS:
            obj = stars.content[id]
            res.append(obj)
        return res

    def getBeiDou(self):
        stars = self.chart.getFixedStarBeiDou()
        self.relocateSouthObjects(stars)
        res = []
        for id in const.LIST_BEIDOU:
            obj = stars.content[id]
            res.append(obj)
        return res

    def getBeiJi(self):
        stars = self.chart.getFixedStarBeiJi()
        self.relocateSouthObjects(stars)
        res = []
        for id in const.LIST_BEIJI:
            obj = stars.content[id]
            res.append(obj)
        res.sort(key=takeDecl)
        return res

    def setPlanetSu28(self, res, planet):
        starSel = None
        for star in res:
            if star.ra <= planet.ra:
                starSel = star
            else:
                break
        if starSel == None:
            starSel = res[len(res) - 1]
        planet.su28 = starSel.name

    def getBirthBySystime(self):
        tmparts = self.time.split(':')
        y = int(self.year)
        if y < 0:
            y = -y
        return datetime.datetime(y, int(self.month), int(self.day), int(tmparts[0]), int(tmparts[1]))

    def getParallel(self):
        res = {}
        res['parallel'] = []
        res['contraParallel'] = {}

        planets = const.LIST_ALL_POINTS.copy()
        for objA in planets:
            try:
                planetA = self.chart.get(objA)
            except:
                continue
            for objB in planets:
                if objA == objB:
                    continue
                try:
                    planetB = self.chart.get(objB)
                except:
                    continue
                delta = abs(planetA.decl - planetB.decl)
                sameSize = planetA.decl * planetB.decl > 0
                if delta <= 1 and sameSize:
                    found = False
                    for pSet in res['parallel']:
                        if objA in pSet:
                            pSet.add(objB)
                            found = True
                            break
                    if found is False:
                        pSet = set()
                        pSet.add(objA)
                        pSet.add(objB)
                        res['parallel'].append(pSet)
                elif sameSize is False and abs(abs(planetA.decl) - abs(planetB.decl)) <= 1:
                    if objA in res['contraParallel']:
                        res['contraParallel'][objA].add(objB)
                    else:
                        res['contraParallel'][objA] = set()

        return res

    def getDayerStar(self):
        day = self.dateTime.date.dayofweek()
        daystar = dayerStar[day]
        return daystar

    def getSunRiseTime(self):
        dt = Datetime(self.date, "05:00:00", self.zone)
        dist = 99
        speed = 1 / (4 / 60 / 24)
        count = 1
        thredholds = 50
        while abs(dist) > 0.5 and count < thredholds:
            chart = Chart(dt, self.pos, self.zodiacal, hsys=self.house, IDs=[const.SUN], needpars=False)
            asc = chart.getAngle(const.ASC)
            sun = chart.getObject(const.SUN)
            dist = distance(sun.lon, asc.lon) / 2
            deltatm = dist / speed
            newjd = dt.jd + deltatm
            dt = Datetime.fromJD(newjd, self.zone)
            count = count + 1

        if count >= thredholds:
            dt = Datetime(self.date, "05:00:00", self.zone)

        sunT = dt.toCNString()
        parts = sunT.split(' ')
        res = {
            'datetime': dt,
            'timeStr': parts[1]
        }
        return res


    def getTimerStar(self):
        birth = '{0}-{1}-{2}'.format(self.year, self.month, self.day)
        tmoffset = getOffsetByDate(birth, self.zone, self.lon)
        offsetjdn = tmoffset / 3600.0 / 24.0

        dt = Datetime(self.date, self.time, self.zone)
        jdn = dt.jd + offsetjdn
        bdt = Datetime.fromJD(jdn, self.zone)
        bdtstr = bdt.toCNString()
        bdtparts = bdtstr.split(' ')
        birttm = bdtparts[1]

        day = self.dateTime.date.dayofweek()
        daystar = dayerStar[day]
        timerIdx = timerStar.index(daystar)
        parts = birttm.split(':')
        h = int(parts[0]) + float(parts[1])/60
        if len(parts) > 2:
            h = h + float(parts[2])/3600

        sunTObj = self.getSunRiseTime()
        sunjdn = sunTObj['datetime'].jd + offsetjdn
        sundt = Datetime.fromJD(sunjdn, self.zone)
        suntstr = sundt.toCNString()
        tstrparts = suntstr.split(' ')

        sunT = tstrparts[1]
        sunTparts = sunT.split(':')
        sunH = int(sunTparts[0]) + float(sunTparts[1])/60 + float(sunTparts[2])/3600
        delta = int(h) - int(sunH)
        idx = (timerIdx + delta + 28) % 7
        star = timerStar[idx]
        return star

    def getHyleg(self):
        pass

    def getAlcochocen(self):
        pass