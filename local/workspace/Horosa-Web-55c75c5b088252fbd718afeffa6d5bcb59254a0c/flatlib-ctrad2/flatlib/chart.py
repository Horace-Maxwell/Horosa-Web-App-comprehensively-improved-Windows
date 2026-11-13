"""
    This file is part of flatlib - (C) FlatAngle
    Author: João Ventura (flatangleweb@gmail.com)
    

    This module implements a class to represent an 
    astrology Chart. It provides methods to handle
    the chart, as well as three relevant properties:
    
    - objects: a list with the chart's objects
    - houses: a list with the chart's houses
    - angles: a list with the chart's angles

    Since houses 1 and 10 may not match the Asc and
    MC in some house systems, the Chart class 
    includes the list of angles. The angles should be
    used when you want to deal with angle's longitudes.
    
    There are also methods to access fixed stars.
    
"""

from . import angle
from . import const
from . import utils
from .lists import ObjectList
from .ephem import ephem
from .datetime import Datetime
from .ephem import swe
import swisseph
from flatlib.tools import arabicparts

def getGregoNewStart(zone):
    dateTime = Datetime('1582/10/15', '00:00:00', zone)
    return dateTime

def add10Days(datetime):
    jd = datetime.jd + 10
    newtm = Datetime.fromJD(jd, datetime.utcoffset)
    return newtm

def adjustDays(datetime):
    list = datetime.date.toList()


# ------------------ #
#    Chart Class     #
# ------------------ #

class Chart:
    """ This class represents an astrology chart. """
    
    def __init__(self, date, pos, zodiacal=const.TROPICAL, **kwargs):
        """ Creates an astrology chart for a given
        date and location. 
        
        Optional arguments are:
        - hsys: house system
        - IDs: list of objects to include
        
        """
        # Handle optional arguments
        hsys = kwargs.get('hsys', const.HOUSES_DEFAULT)
        IDs = kwargs.get('IDs', const.LIST_OBJECTS_TRADITIONAL)
        # 存请求天体集:solarReturn 年表转发用(此前年表盘退化为传统集,与单盘模式天体数不齐)。
        self._IDs = IDs

        realdate = date

        self.zodiacal = zodiacal
        self.orgdate = date
        self.date = realdate
        self.pos = pos
        self.hsys = hsys
        self.sidereal_mode = kwargs.get('sidereal_mode', None)

        self.height = kwargs.get('height', 150)
        self.flags = swe.SEDEFAULT_FLAG
        if zodiacal == const.SIDEREAL:
            self.flags = swe.SEDEFAULT_FLAG | swisseph.FLG_SIDEREAL

        with self._siderealContext():
            self.objects = ephem.getObjectList(IDs, self.date, pos, self.height, self.flags)
            if zodiacal == const.SIDEREAL:
                self.houses, self.angles = ephem.getHouses(self.date, pos, hsys, self.height, swisseph.FLG_SIDEREAL)
            else:
                self.houses, self.angles = ephem.getHouses(self.date, pos, hsys, self.height)

        self.needpars = kwargs.get('needpars', True)
        if self.needpars:
            pars = [arabicparts.getPart(ID, self) for ID in arabicparts.LIST_PARS]
            self.pars = ObjectList(pars)
        else:
            self.pars = ObjectList([])

    def copy(self):
        """ Returns a deep copy of this chart. """
        chart = Chart.__new__(Chart)
        chart.zodiacal = self.zodiacal
        chart.flags = self.flags
        chart.sidereal_mode = getattr(self, 'sidereal_mode', None)
        chart.date = self.date
        chart.orgdate = self.orgdate
        chart.pos = self.pos
        chart.hsys = self.hsys
        chart.objects = self.objects.copy()
        chart.houses = self.houses.copy()
        chart.angles = self.angles.copy()
        chart.pars = self.pars.copy()
        chart.halfTurned = getattr(self, 'halfTurned', False)
        chart.labelTurn = getattr(self, 'labelTurn', 0.0)
        return chart
    
    
    # === Properties === #
    
    def getObject(self, ID):
        """ Returns an object from the chart. """
        return self.objects.get(ID)
    
    def getHouse(self, ID):
        """ Returns an house from the chart. """
        return self.houses.get(ID)
    
    def getAngle(self, ID):
        """ Returns an angle from the chart. """
        return self.angles.get(ID)

    def getPars(self, ID):
        """ Returns an par from the chart. """
        return self.pars.get(ID)

    def get(self, ID):
        """ Returns an object, house or angle 
        from the chart.
        
        """
        if ID.startswith('House'):
            return self.getHouse(ID)
        elif ID in const.LIST_ANGLES:
            return self.getAngle(ID)
        elif ID in arabicparts.LIST_PARS:
            return self.getPars(ID)
        else:
            return self.getObject(ID)


    # === Fixed stars === #
    
    # The computation of fixed stars is inefficient,
    # so the access must be made directly to the
    # ephemeris only when needed.
        
    def getFixedStar(self, ID):
        """ Returns a fixed star from the ephemeris. """
        with self._siderealContext():
            return ephem.getFixedStar(ID, self.date, self.pos, self.height, self.flags)

    def getFixedStars(self):
        """ Returns a list with all fixed stars. """
        IDs = const.LIST_FIXED_STARS
        with self._siderealContext():
            return ephem.getFixedStarList(IDs, self.date, self.pos, self.height, self.flags)

    def getFixedStarBeiDou(self):
        """ Returns a list with all fixed stars. """
        IDs = const.LIST_BEIDOU
        with self._siderealContext():
            return ephem.getFixedStarList(IDs, self.date, self.pos, self.height, self.flags)

    def getFixedStarBeiJi(self):
        """ Returns a list with all fixed stars. """
        IDs = const.LIST_BEIJI
        with self._siderealContext():
            return ephem.getFixedStarList(IDs, self.date, self.pos, self.height, self.flags)

    def getFixedStartsSu28(self):
        IDs = const.LIST_FIXED_SU28
        with self._siderealContext():
            stars = ephem.getFixedStarSu28List(IDs, self.date, self.pos, self.height, self.flags)
        return stars


    # === Houses and angles === #
    
    def isHouse1Asc(self):
        """ Returns true if House1 is the same as the Asc. """
        house1 = self.getHouse(const.HOUSE1)
        asc = self.getAngle(const.ASC)
        dist = angle.closestdistance(house1.lon, asc.lon)
        return abs(dist) < 0.0003  # 1 arc-second
    
    def isHouse10MC(self):
        """ Returns true if House10 is the same as the MC. """
        house10 = self.getHouse(const.HOUSE10)
        mc = self.getAngle(const.MC)
        dist = angle.closestdistance(house10.lon, mc.lon)
        return abs(dist) < 0.0003  # 1 arc-second

    def _siderealContext(self):
        mode = self.sidereal_mode if self.zodiacal == const.SIDEREAL else None
        return _SiderealContext(mode)


    # === Other properties === #
    
    def isDiurnal(self):
        """ Returns true if this chart is diurnal. """
        sun = self.getObject(const.SUN)
        mc = self.getAngle(const.MC)
        # 按盘上「此刻」的太阳与天顶黄经判(搬点盘如组合盘随之变);黄→赤用本日真黄赤交角、恒星盘先加回岁差
        # (旧写法固定 23.44°、恒星盘直接拿恒星黄经换)。十三分 / 调波 / 龙盘等派生盘的昼夜另在 reinit_derived 固定成本命。
        jd = self.date.jd
        with self._siderealContext():
            offset = swe.tropicalOffset(jd, self.flags)
        eps = swe.trueObliquity(jd)
        # 南半球盘把全盘黄经整体转了 180°(只换星座标签,天上的位置没动):昼夜是天上的事实,先转回去再换赤道坐标。
        # 不转回的话是拿「对面那一点」去比真实纬度的半日弧,日出日没前后一段时间里昼夜判反。
        turn = 180.0 if getattr(self, 'halfTurned', False) else 0.0
        sunRA, sunDecl = swe.eclipticToEquatorial((sun.lon + turn) % 360.0, sun.lat, eps, offset)
        mcRA = swe.eclipticToEquatorial((mc.lon + turn) % 360.0, 0.0, eps, offset)[0]
        return utils.isAboveHorizon(sunRA, sunDecl, mcRA, self.pos.lat)
    
    def getMoonPhase(self):
        """ Returns the phase of the moon. """
        sun = self.getObject(const.SUN)
        moon = self.getObject(const.MOON)
        dist = angle.distance(sun.lon, moon.lon)
        if dist < 90:
            return const.MOON_FIRST_QUARTER
        elif dist < 180:
            return const.MOON_SECOND_QUARTER
        elif dist < 270:
            return const.MOON_THIRD_QUARTER
        else:
            return const.MOON_LAST_QUARTER
    
    
    # === Solar returns === #
    
    def solarReturn(self, year):
        """ Returns this chart's solar return for a 
        given year. 
        
        """
        sun = self.getObject(const.SUN)
        date = Datetime('{0}/01/01'.format(year),
                        '00:00',
                        self.date.utcoffset)
        srDate = ephem.nextSolarReturn(date, sun.lon, self.flags)
        # 🐛一行修:Chart 第三位置参数是 zodiacal(str),此前误传 self.flags(int)——
        # const.SIDEREAL('Sidereal') 永不等于整数 → 恒星盘用户的 90 年返照年表恒按回归黄道排,
        # 且 sidereal_mode(ayanamsa)/IDs(天体集)双丢。单盘模式(getSolarReturnByDate 族)不走此路不受影响。
        return Chart(srDate, self.pos, self.zodiacal, hsys=self.hsys, IDs=self._IDs,
                     sidereal_mode=self.sidereal_mode, height=self.height)


class _SiderealContext:
    def __init__(self, mode):
        self.mode = mode

    def __enter__(self):
        if self.mode:
            swe.setSiderealContext(
                self.mode.get('mode'),
                self.mode.get('t0', 0.0),
                self.mode.get('ayan_t0', 0.0)
            )
        return self

    def __exit__(self, exc_type, exc, tb):
        swe.clearSiderealContext()
        return False
