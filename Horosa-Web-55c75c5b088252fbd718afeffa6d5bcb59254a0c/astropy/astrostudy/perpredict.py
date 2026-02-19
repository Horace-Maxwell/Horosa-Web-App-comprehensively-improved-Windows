import copy
import swisseph
from flatlib.chart import Chart
from flatlib.datetime import Datetime
from flatlib import const
from flatlib.ephem import swe
from flatlib.predictives.primarydirections import PrimaryDirections
from flatlib.predictives.primarydirections import PDTable
from flatlib.predictives import profections
from flatlib.tools import arabicparts
from astrostudy.signasctime import SignAscTime
from astrostudy import helper
from astrostudy import solararc
from astrostudy import firdaria
from astrostudy import zreleasing

MAX_ERROR = 0.0003

def takeLon(obj):
    return obj.lon

def getChartObjects(chart):
    objs = []
    for key in chart.objects.content.keys():
        objs.append(chart.objects.content[key])
    for key in chart.angles.content.keys():
        objs.append(chart.angles.content[key])
    objs.sort(key=takeLon)
    return objs


def dateSolarReturn(datetime, lon, zodiacal=const.TROPICAL):
    flags = swe.SEDEFAULT_FLAG
    if zodiacal == const.SIDEREAL:
        flags = swe.SEDEFAULT_FLAG | swisseph.FLG_SIDEREAL

    jd = datetime.jd
    sun = swe.sweObjectLon(const.SUN, jd, flags)
    delta = helper.distance(sun, lon)
    while abs(delta) > MAX_ERROR:
        jd = jd - delta / 0.9833  # Sun mean motion
        sun = swe.sweObjectLon(const.SUN, jd, flags)
        delta = helper.distance(sun, lon)
    return Datetime.fromJD(jd, datetime.utcoffset)


def dateLunarReturn(datetime, lon, zodiacal=const.TROPICAL):
    flags = swe.SEDEFAULT_FLAG
    if zodiacal == const.SIDEREAL:
        flags = swe.SEDEFAULT_FLAG | swisseph.FLG_SIDEREAL

    jd = datetime.jd
    moon = swe.sweObjectLon(const.MOON, jd, flags)
    delta = -helper.absDistance(moon, lon)
    while abs(delta) > MAX_ERROR:
        jd = jd - delta / 13.17638889  # Moon mean motion
        moon = swe.sweObjectLon(const.MOON, jd, flags)
        delta = helper.distance(moon, lon)
    return Datetime.fromJD(jd, datetime.utcoffset)



class PerPredict:

    def __init__(self, perchart):
        self.perchart = perchart

    def getAspects(self, pChart, asporb=-1):
        natalObjs = [obj for obj in self.perchart.chart.objects]
        natalObjs.extend([obj for obj in self.perchart.chart.angles])

        objs = [obj for obj in pChart.objects]
        objs.extend([obj for obj in pChart.angles])

        res = []
        for obj in objs:
            asp = {
                'directId': obj.id,
                'objects': []
            }
            for natobj in natalObjs:
                orb = asporb if asporb > 0 else (natobj.orb() + obj.orb()) / 2
                natasp = {
                    'natalId': natobj.id,
                    'aspect': -1
                }
                delta = obj.lon - natobj.lon if obj.lon >= natobj.lon else natobj.lon - obj.lon
                if delta < orb:
                    natasp['aspect'] = 0
                    natasp['delta'] = delta
                elif abs(delta - 60) < orb or abs(delta - 300) < orb:
                    tmpdelta = abs(delta - 60)
                    if tmpdelta > 1:
                        tmpdelta = abs(delta - 300)
                    natasp['aspect'] = 60
                    natasp['delta'] = tmpdelta
                elif abs(delta - 90) < orb or abs(delta - 270) < orb:
                    tmpdelta = abs(delta - 90)
                    if tmpdelta > 1:
                        tmpdelta = abs(delta - 270)
                    natasp['aspect'] = 90
                    natasp['delta'] = tmpdelta
                elif abs(delta - 120) < orb or abs(delta - 240) < orb:
                    tmpdelta = abs(delta - 120)
                    if tmpdelta > 1:
                        tmpdelta = abs(delta - 240)
                    natasp['aspect'] = 120
                    natasp['delta'] = tmpdelta
                elif abs(delta - 180) < orb:
                    natasp['aspect'] = 180
                    natasp['delta'] = abs(delta - 180)
                if natasp['aspect'] >= 0:
                    asp['objects'].append(natasp)
            res.append(asp)
        return res

    def getTermDirection(self, clockwise):
        chart = self.perchart.getChart()
        td = TermDirection(chart, clockwise)
        tdlist = td.getList(self.perchart.pdaspects)
        self.appendDateStr(tdlist, False)
        return tdlist

    def getPrimaryDirection(self):
        pdtype = self.perchart.pdtype
        if pdtype == 0:
            return self.getPrimaryDirectionByZ()
        elif pdtype == 1:
            return self.getPrimaryDirectionByM()
        elif pdtype == 2:
            return self.getTermDirection(True)
        elif pdtype == 3:
            return self.getTermDirection(False)

        chart = self.perchart.getChart()
        pd = PrimaryDirections(chart)
        pdlist = pd.getList(self.perchart.pdaspects)
        self.appendDateStr(pdlist)
        return pdlist

    def getPrimaryDirectionByZ(self):
        chart = self.perchart.getChart()
        pdlist = []
        pd = PrimaryDirections(chart)
        for item in pd.getList(self.perchart.pdaspects):
            if item[3] == 'Z':
                pdlist.append(item)
        self.appendDateStr(pdlist)
        return pdlist

    def getPrimaryDirectionByM(self):
        chart = self.perchart.getChart()
        pdlist = []
        pd = PrimaryDirections(chart)
        for item in pd.getList(self.perchart.pdaspects):
            if item[3] == 'M':
                pdlist.append(item)
        self.appendDateStr(pdlist)
        return pdlist

    def bySignificator(self, ID):
        chart = self.perchart.getChart()
        tbl = PDTable(chart, self.perchart.pdaspects)
        list = tbl.bySignificator(ID)
        self.appendDateStr(list)
        return list


    def byPromissor(self, ID):
        chart = self.perchart.getChart()
        tbl = PDTable(chart, self.perchart.pdaspects)
        list = tbl.byPromissor(ID)
        self.appendDateStr(list)
        return list

    def appendDateStr(self, pdlist, usePD=True):
        chart = self.perchart.getChart()
        for item in pdlist:
            asc = chart.angles.get(const.ASC)
            asctime = SignAscTime(self.perchart.date, self.perchart.time, asc.sign, self.perchart.lat, self.perchart.zone)
            datestr = None
            if usePD:
                datestr = asctime.getDateFromPDArc(item[0])
            else:
                datestr = asctime.getDateFromTermDirArc(item[0])
            item.append(datestr)


    def getProfection(self, nodeRetrograde=False, asporb=-1):
        res = []
        for i in range(1, 100):
            year = int(self.perchart.year) + i
            date = '{0}/{1}/{2}'.format(year, self.perchart.month, self.perchart.day)
            dt = Datetime(date, self.perchart.time, self.perchart.zone)
            chart = profections.compute(self.perchart.chart, dt, False, nodeRetrograde)
            obj = {
                'date': '{0}-{1}-{2}'.format(year, self.perchart.month, self.perchart.day),
                'chart': {
                    'objects': getChartObjects(chart),
                    'aspects': self.getAspects(chart, asporb)
                },
                'lots': self.perchart.getPars(chart)
            }
            res.append(obj)
        return res

    def getProfectionByDate(self, date, zone, nodeRetrograde=False, asporb=-1):
        parts = date.split(' ')
        dt = helper.getChartDate(parts[0])
        tm = parts[1] if len(parts) > 1 else '00:00'
        profDate = Datetime(dt, tm, zone)
        chart = profections.compute(self.perchart.chart, profDate, False, nodeRetrograde)
        obj = {
            'date': date,
            'chart': {
                'objects': getChartObjects(chart),
                'aspects': self.getAspects(chart, asporb)
            },
            'lots': self.perchart.getPars(chart)
        }
        return obj

    def getSolarReturn(self, params, asporb=-1):
        res = []
        st = int(self.perchart.year) + 1
        ed = int(self.perchart.year) + 90
        zone = params['zone']

        for i in range(st, ed):
            chart = self.perchart.chart.solarReturn(i)
            srdt = Datetime.fromJD(chart.date.jd, zone)
            srdtstr = srdt.toCNString()
            dirparts = srdtstr.split(' ')
            cparams = copy.deepcopy(params)
            cparams['date'] = dirparts[0]
            cparams['time'] = dirparts[1]
            obj = {
                'date': srdtstr,
                'chart': {
                    'objects': getChartObjects(chart),
                    'aspects': self.getAspects(chart, asporb)
                },
                'dirParams': cparams,
                'lots': self.perchart.getPars(chart)
            }
            res.append(obj)
        return res

    def getSolarReturnByDate(self, params, date, asporb=-1):
        sun = self.perchart.chart.getObject(const.SUN)
        parts = date.split(' ')
        dt = helper.getChartDate(parts[0])
        tm = parts[1] if len(parts) > 1 else '00:00'
        zone = params['zone']
        returnDate = Datetime(dt, tm, zone)
        srDate = dateSolarReturn(returnDate, sun.lon, self.perchart.zodiacal)
        chart = Chart(srDate, self.perchart.pos, self.perchart.zodiacal, hsys=self.perchart.house, IDs=const.LIST_OBJECTS)
        srdt = Datetime.fromJD(srDate.jd, srDate.utcoffset)
        srdtstr = srdt.toCNString()
        dirparts = srdtstr.split(' ')
        params['date'] = dirparts[0]
        params['time'] = dirparts[1]
        obj = {
            'date': srdtstr,
            'chart': {
                'objects': getChartObjects(chart),
                'aspects': self.getAspects(chart, asporb)
            },
            'dirParams': params,
            'lots': self.perchart.getPars(chart)
        }
        return obj

    def getSolarReturnByDatePos(self, params, date, pos, asporb=-1):
        sun = self.perchart.chart.getObject(const.SUN)
        parts = date.split(' ')
        dt = helper.getChartDate(parts[0])
        tm = parts[1] if len(parts) > 1 else '00:00'
        zone = params['zone']
        returnDate = Datetime(dt, tm, zone)
        srDate = dateSolarReturn(returnDate, sun.lon, self.perchart.zodiacal)
        chart = Chart(srDate, pos, self.perchart.zodiacal, hsys=self.perchart.house, IDs=const.LIST_OBJECTS)
        srdt = Datetime.fromJD(srDate.jd, srDate.utcoffset)
        srdtstr = srdt.toCNString()
        dirparts = srdtstr.split(' ')
        params['date'] = dirparts[0]
        params['time'] = dirparts[1]

        obj = {
            'date': srdtstr,
            'pos': {
                'lat': pos.lat,
                'lon': pos.lon
            },
            'chart': {
                'objects': getChartObjects(chart),
                'aspects': self.getAspects(chart, asporb)
            },
            'dirParams': params,
            'lots': self.perchart.getPars(chart)
        }
        return obj

    def getLunarReturn(self, params, date, pos, asporb=-1):
        moon = self.perchart.chart.getObject(const.MOON)
        parts = date.split(' ')
        dt = helper.getChartDate(parts[0])
        parts = dt.split('/')
        dt = '{0}/{1}/01'.format(parts[0], parts[1])
        tm = '00:00'
        zone = params['zone']
        returnDate = Datetime(dt, tm, zone)
        lrDate = dateLunarReturn(returnDate, moon.lon, self.perchart.zodiacal)
        chart = Chart(lrDate, pos, self.perchart.zodiacal, hsys=self.perchart.house, IDs=const.LIST_OBJECTS)
        srdt = Datetime.fromJD(lrDate.jd, lrDate.utcoffset)
        srdtstr = srdt.toCNString()
        dirparts = srdtstr.split(' ')
        params['date'] = dirparts[0]
        params['time'] = dirparts[1]

        obj = {
            'date': srdtstr,
            'pos': {
                'lat': pos.lat,
                'lon': pos.lon
            },
            'chart': {
                'objects': getChartObjects(chart),
                'aspects': self.getAspects(chart, asporb)
            },
            'dirParams': params,
            'lots': self.perchart.getPars(chart)
        }

        parts = dirparts[0].split('-')
        m = parts[1]
        if int(parts[2]) < 5:
            dt = '{0}/{1}/21'.format(parts[0], parts[1])
            tm = '00:00'
            zone = params['zone']
            returnDate = Datetime(dt, tm, zone)
            seclrDate = dateLunarReturn(returnDate, moon.lon, self.perchart.zodiacal)
            secchart = Chart(seclrDate, pos, self.perchart.zodiacal, hsys=self.perchart.house, IDs=const.LIST_OBJECTS)
            srdt = Datetime.fromJD(seclrDate.jd, seclrDate.utcoffset)
            srdtstr1 = srdt.toCNString()
            dirparts1 = srdtstr1.split(' ')
            params1 = copy.deepcopy(params)
            params1['date'] = dirparts1[0]
            params1['time'] = dirparts1[1]
            parts = dirparts1[0].split('-')
            if parts[1] == m:
                obj1 = {
                    'date': srdtstr1,
                    'pos': {
                        'lat': pos.lat,
                        'lon': pos.lon
                    },
                    'chart': {
                        'objects': getChartObjects(secchart),
                        'aspects': self.getAspects(secchart, asporb)
                    },
                    'dirParams': params1,
                    'lots': self.perchart.getPars(chart)
                }
                obj['secLuneReturn'] = obj1

        return obj

    def getGivenYear(self, params, date, pos, asporb=-1):
        parts = date.split(' ')
        dt = helper.getChartDate(parts[0])
        tm = parts[1]
        zone = params['zone']
        givenDate = Datetime(dt, tm, zone)
        chart = Chart(givenDate, pos, self.perchart.zodiacal, hsys=self.perchart.house, IDs=const.LIST_OBJECTS)
        params['date'] = parts[0]
        params['time'] = parts[1]

        obj = {
            'date': date,
            'pos': {
                'lat': pos.lat,
                'lon': pos.lon
            },
            'chart': {
                'objects': getChartObjects(chart),
                'aspects': self.getAspects(chart, asporb)
            },
            'dirParams': params,
            'lots': self.perchart.getPars(chart)
        }
        return obj

    def getSolarArc(self, asporb, nodeRetrograde=False):
        res = []
        for i in range(1, 100):
            year = int(self.perchart.year) + i
            date = '{0}/{1}/{2}'.format(year, self.perchart.month, self.perchart.day)
            dt = Datetime(date, self.perchart.time, self.perchart.zone)
            chart = solararc.compute(self.perchart.chart, dt, asporb, nodeRetrograde)
            objs = chart['objects']
            objs.sort(key=takeLon)
            obj = {
                'date': '{0}-{1}-{2}'.format(year, self.perchart.month, self.perchart.day),
                'chart': {
                    'objects': objs,
                    'aspects': chart['aspects']
                },
                'lots': self.perchart.getPars(chart['chart'])
            }
            res.append(obj)
        return res

    def getSolarArcByDate(self, date, asporb, nodeRetrograde=False):
        parts = date.split(' ');
        dt = helper.getChartDate(parts[0])
        tm = parts[1] if len(parts) > 1 else '00:00'
        saDate = Datetime(dt, tm, self.perchart.zone)
        chart = solararc.compute(self.perchart.chart, saDate, asporb, nodeRetrograde)
        objs = chart['objects']
        objs.sort(key=takeLon)
        obj = {
            'date': date,
            'chart': {
                'objects': objs,
                'aspects': chart['aspects']
            },
            'natalChart': {
                'chart': self.perchart.getChartOnlyObj(),
                'aspects': {
                    'normalAsp': self.perchart.getAspects(),
                    'immediateAsp': self.perchart.getImmediateAspects(),
                    'signAsp': self.perchart.getSignAspects()
                }
            },
            'lots': self.perchart.getPars(chart['chart'])
        }
        return obj


    def getFirdaria(self):
        return firdaria.compute(self.perchart.chart)

    def getZodiacalRelease(self, startSign, stopLevelIdx=3):
        return zreleasing.compute(self.perchart, startSign, stopLevelIdx)

    def getDiceChart(self, planet, sign, house):
        aspects = self.perchart.getAspects()
        planetobj = self.perchart.chart.get(planet)
        siglon = planetobj.signlon
        newlon = helper.getSignLon(sign) + siglon
        hidx = 0
        for hobj in self.perchart.chart.houses:
            if hobj.lon <= newlon and newlon <= hobj.lon + hobj.size:
                hidx = int(hobj.id[5:7]) - 1
                break

        objs = set()
        objs.add(planet)
        try:
            asp = aspects[planet]
            for aspobj in asp['Applicative']:
                objs.add(aspobj['id'])
            for aspobj in asp['Exact']:
                objs.add(aspobj['id'])
            for aspobj in asp['None']:
                objs.add(aspobj['id'])
            for aspobj in asp['Obvious']:
                objs.add(aspobj['id'])
            for aspobj in asp['Separative']:
                objs.add(aspobj['id'])
        except:
            pass

        for parid in arabicparts.LIST_PARS:
            if parid in objs:
                objs.remove(parid)
        for parid in const.LIST_ANGLES:
            if parid in objs:
                objs.remove(parid)

        objlist = []
        for objid in objs:
            objlist.append(objid)

        perchart = self.perchart.clone(objlist, const.HOUSES_WHOLE_SIGN, False)

        housedelta = hidx - house
        delta = housedelta * 30 + 360

        asc = perchart.chart.getAngle(const.ASC)
        mc = perchart.chart.getAngle(const.MC)
        desc = perchart.chart.getAngle(const.DESC)
        ic = perchart.chart.getAngle(const.IC)

        asc.relocate((asc.lon + delta) % 360)
        mc.relocate((mc.lon + delta) % 360)
        desc.relocate((desc.lon + delta) % 360)
        ic.relocate((ic.lon + delta) % 360)

        for hobj in perchart.chart.houses:
            hobj.relocate((hobj.lon + delta) % 360)

        planetobj = perchart.chart.getObject(planet)
        planetobj.relocate(newlon)

        perchart.reinit()
        return perchart


